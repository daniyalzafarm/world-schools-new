import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { WsServerEvent } from '@world-schools/wc-types'
import { WebSocketService } from '../websocket/websocket.service'
import { WsInternalEvent } from '../websocket/ws-internal-events'
import { MessagesService } from './services/messages.service'
import { ConversationsService } from './services/conversations.service'
import { TypingService } from './services/typing.service'
import { PresenceService } from './services/presence.service'
import { PrismaService } from '../../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'

/**
 * Messaging WebSocket Event Handler
 *
 * Handles messaging-related WebSocket events routed from the
 * global WebSocket gateway via EventEmitter2.
 *
 * This replaces the tightly-coupled MessagingGateway with a
 * loosely-coupled event handler that receives events from the
 * global gateway and uses the WebSocketService for responses.
 *
 * Uses createMessageViaWebSocket() which:
 * - Validates sender is a participant
 * - Determines sender type (USER/PROVIDER) from participant data
 * - Applies rate limiting (10 messages per minute)
 */
@Injectable()
export class MessagingWebSocketHandler {
  private readonly logger = new Logger(MessagingWebSocketHandler.name)

  constructor(
    private readonly wsService: WebSocketService,
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly typingService: TypingService,
    private readonly presenceService: PresenceService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService
  ) {}

  /**
   * Verify that a user has access to a conversation before allowing a WebSocket
   * operation. Mirrors the two-layer check in ConversationAccessGuard:
   *   1. Direct participant record
   *   2. Provider-org member for USER_PROVIDER conversations
   *
   * Result is cached in Redis for 30 seconds to avoid repeated DB queries on
   * every send/read/delivered event in an active conversation.
   *
   * Returns true if access is granted, false otherwise (caller should log & return early).
   * Never throws — WS handlers must not throw unhandled exceptions.
   */
  private async canAccessConversation(userId: string, conversationId: string): Promise<boolean> {
    const cacheKey = `conv:access:${userId}:${conversationId}`
    try {
      // Check cache first
      const cached = await this.redisService.get(cacheKey)
      if (cached !== null) return cached === '1'

      const result = await this.checkConversationAccess(userId, conversationId)

      // Cache the result — 30s is long enough to cover burst activity but short enough
      // to react to participant removals within a reasonable window.
      await this.redisService.setex(cacheKey, 30, result ? '1' : '0')

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`canAccessConversation check failed: ${msg}`)
      return false
    }
  }

  private async checkConversationAccess(userId: string, conversationId: string): Promise<boolean> {
    // Fast path: direct participant
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    })
    if (participant) return true

    // Slow path: provider-org member on a USER_PROVIDER conversation
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true, metadata: true },
    })
    if (conversation?.type !== 'USER_PROVIDER') return false

    const meta = conversation.metadata as { providerId?: string } | null
    if (!meta?.providerId) return false

    const userProviderId = await this.conversationsService.getProviderIdForUser(userId)
    return userProviderId === meta.providerId
  }

  /**
   * Handle send_message event from client
   * Validates participant, determines sender type, creates message in DB,
   * confirms to sender, broadcasts to room
   */
  @OnEvent(WsInternalEvent.SendMessage)
  async handleSendMessage(payload: {
    userId: string
    conversationId: string
    content: string
    tempId: string
    attachmentIds?: string[]
  }) {
    try {
      // Create message via WebSocket-specific method with validation and rate limiting
      const message = await this.messagesService.createMessageViaWebSocket({
        conversationId: payload.conversationId,
        senderId: payload.userId,
        content: payload.content,
        tempId: payload.tempId,
        attachmentIds: payload.attachmentIds,
      })

      // Confirm to sender with the persisted message and tempId for optimistic deduplication.
      // message:new delivery to all other participants is handled exclusively by
      // RedisPubSubService (messages:new channel) which uses the Redis adapter for
      // cross-replica broadcasting. Emitting here too would cause double delivery since
      // wsService.emitToUser() also goes through the Redis adapter.
      this.wsService.emitToUser(payload.userId, WsServerEvent.MessageCreated, {
        message,
        tempId: payload.tempId,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to send message: ${errorMessage}`)
      this.wsService.emitToUser(payload.userId, WsServerEvent.MessageError, {
        tempId: payload.tempId,
        error: errorMessage,
      })
    }
  }

  /**
   * Handle join_conversation event.
   * Adds the user to the conversation room and registers bidirectional
   * presence subscriptions so presence updates are targeted (not broadcast to all).
   */
  @OnEvent(WsInternalEvent.JoinConversation)
  async handleJoinConversation(payload: { userId: string; conversationId: string }) {
    // Security: verify the user has access before joining the conversation room.
    // Without this check any authenticated socket could join any room (IDOR).
    const hasAccess = await this.canAccessConversation(payload.userId, payload.conversationId)
    if (!hasAccess) {
      this.logger.warn(
        `Blocked unauthorized join_conversation: user=${payload.userId} conversation=${payload.conversationId}`
      )
      return
    }

    this.wsService.joinRoom(payload.userId, `conversation:${payload.conversationId}`)
    this.logger.log(`User ${payload.userId} joined conversation ${payload.conversationId}`)

    // Register presence subscriptions between this user and all other participants
    // so future presence updates are delivered only to users who share a conversation.
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: payload.conversationId },
        select: { participants: { select: { userId: true } } },
      })
      if (!conversation) return

      const otherUserIds = conversation.participants
        .map(p => p.userId)
        .filter(id => id !== payload.userId)

      await Promise.all(
        otherUserIds.flatMap(otherId => [
          // Joining user cares about others' presence
          this.presenceService.addPresenceSubscription(otherId, payload.userId),
          // Others care about joining user's presence
          this.presenceService.addPresenceSubscription(payload.userId, otherId),
        ])
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to register presence subscriptions: ${msg}`)
    }
  }

  /**
   * Handle leave_conversation event.
   * Removes the user from the conversation room and cleans up presence subscriptions
   * for users who no longer share any other conversations.
   */
  @OnEvent(WsInternalEvent.LeaveConversation)
  async handleLeaveConversation(payload: { userId: string; conversationId: string }) {
    this.wsService.leaveRoom(payload.userId, `conversation:${payload.conversationId}`)
    this.logger.log(`User ${payload.userId} left conversation ${payload.conversationId}`)

    // Remove presence subscriptions with participants of the left conversation.
    // Note: if users share other conversations, the subscription will be re-added
    // when they next join those rooms. This is acceptable — presence targeting
    // uses best-effort delivery; missing a presence update is non-critical.
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: payload.conversationId },
        select: { participants: { select: { userId: true } } },
      })
      if (!conversation) return

      const otherUserIds = conversation.participants
        .map(p => p.userId)
        .filter(id => id !== payload.userId)

      await Promise.all(
        otherUserIds.flatMap(otherId => [
          this.presenceService.removePresenceSubscription(otherId, payload.userId),
          this.presenceService.removePresenceSubscription(payload.userId, otherId),
        ])
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to remove presence subscriptions: ${msg}`)
    }
  }

  /**
   * Handle typing:start event
   * Rate-limited to 1 event per 3 seconds per user per conversation.
   * Stores typing indicator in Redis and broadcasts to conversation room (excluding sender).
   */
  @OnEvent(WsInternalEvent.TypingStart)
  async handleTypingStart(payload: { userId: string; conversationId: string }) {
    try {
      // Rate limit: max 1 typing:start per 3 seconds per user per conversation.
      // SET NX EX is atomic — no race between INCR and EXPIRE that could leave a key without TTL.
      const rateLimitKey = `ratelimit:typing:${payload.userId}:${payload.conversationId}`
      const redis = this.redisService.getClient()
      const acquired = await redis.set(rateLimitKey, '1', 'EX', 3, 'NX')
      if (!acquired) return // Already within rate limit window — silently drop

      await this.typingService.startTyping(payload.conversationId, payload.userId)

      // Broadcast to conversation room excluding sender
      this.wsService.emitToRoomExcluding(
        `conversation:${payload.conversationId}`,
        payload.userId,
        WsServerEvent.TypingStart,
        {
          conversationId: payload.conversationId,
          userId: payload.userId,
        }
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to handle typing start: ${errorMessage}`)
    }
  }

  /**
   * Handle typing:stop event
   * Clears typing indicator in Redis and broadcasts to conversation room (excluding sender)
   */
  @OnEvent(WsInternalEvent.TypingStop)
  async handleTypingStop(payload: { userId: string; conversationId: string }) {
    try {
      await this.typingService.stopTyping(payload.conversationId, payload.userId)

      // Broadcast to conversation room excluding sender
      this.wsService.emitToRoomExcluding(
        `conversation:${payload.conversationId}`,
        payload.userId,
        WsServerEvent.TypingStop,
        {
          conversationId: payload.conversationId,
          userId: payload.userId,
        }
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to handle typing stop: ${errorMessage}`)
    }
  }

  /**
   * Handle presence:update event
   * Rate-limited to 1 update per 5 seconds per user.
   * Updates user presence in Redis and broadcasts to user's room.
   */
  @OnEvent(WsInternalEvent.PresenceUpdate)
  async handlePresenceUpdate(payload: { userId: string; status: 'online' | 'away' | 'offline' }) {
    try {
      // Rate limit: max 1 presence update per 5 seconds per user.
      // SET NX EX is atomic — no race between INCR and EXPIRE that could leave a key without TTL.
      const rateLimitKey = `ratelimit:presence:${payload.userId}`
      const redis = this.redisService.getClient()
      const acquired = await redis.set(rateLimitKey, '1', 'EX', 5, 'NX')
      if (!acquired) return // Already within rate limit window — silently drop

      if (payload.status === 'online') {
        await this.presenceService.setOnline(payload.userId)
      } else if (payload.status === 'away') {
        await this.presenceService.setAway(payload.userId)
      } else if (payload.status === 'offline') {
        await this.presenceService.setOffline(payload.userId)
      }

      const presencePayload = {
        userId: payload.userId,
        status: payload.status,
        lastSeenAt: new Date().toISOString(),
      }

      // Targeted delivery: only emit to users who share a conversation with this user.
      // Replaces the previous server.emit() O(n) broadcast.
      const subscribers = await this.presenceService.getPresenceSubscribers(payload.userId)
      for (const subscriberId of subscribers) {
        this.wsService.emitToUser(subscriberId, WsServerEvent.PresenceUpdate, presencePayload)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to handle presence update: ${errorMessage}`)
    }
  }

  /**
   * Handle heartbeat:pong — client response to server's 2-minute heartbeat:ping.
   * Refreshes the user's presence TTL so idle-but-connected users stay online.
   */
  @OnEvent(WsInternalEvent.HeartbeatPong)
  async handleHeartbeatPong(payload: { userId: string }) {
    try {
      await this.presenceService.refreshPresence(payload.userId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to refresh presence on heartbeat: ${errorMessage}`)
    }
  }

  /**
   * Handle message:read event
   * Creates read receipt in DB (MessagesService handles Redis pub/sub internally)
   */
  @OnEvent(WsInternalEvent.MessageRead)
  async handleMessageRead(payload: { userId: string; messageId: string; conversationId: string }) {
    try {
      // Security: verify the user is a participant before accepting a read receipt.
      const hasAccess = await this.canAccessConversation(payload.userId, payload.conversationId)
      if (!hasAccess) {
        this.logger.warn(
          `Blocked unauthorized message:read: user=${payload.userId} conversation=${payload.conversationId}`
        )
        return
      }

      await this.messagesService.markAsRead({
        messageId: payload.messageId,
        userId: payload.userId,
      })
      // Receipt broadcast is handled by Redis pub/sub inside messagesService.markAsRead()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to handle message read: ${errorMessage}`)
    }
  }

  /**
   * Handle message:delivered event
   * Creates delivery receipt in DB (MessagesService handles Redis pub/sub internally)
   */
  @OnEvent(WsInternalEvent.MessageDelivered)
  async handleMessageDelivered(payload: {
    userId: string
    messageId: string
    conversationId: string
    deliveryLatencyMs?: number
  }) {
    try {
      // Security: verify the user is a participant before accepting a delivery receipt.
      const hasAccess = await this.canAccessConversation(payload.userId, payload.conversationId)
      if (!hasAccess) {
        this.logger.warn(
          `Blocked unauthorized message:delivered: user=${payload.userId} conversation=${payload.conversationId}`
        )
        return
      }

      await this.messagesService.markAsDelivered({
        messageId: payload.messageId,
        userId: payload.userId,
        deliveryLatencyMs: payload.deliveryLatencyMs,
      })
      // Receipt broadcast is handled by Redis pub/sub inside messagesService.markAsDelivered()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to handle message delivered: ${errorMessage}`)
    }
  }
}
