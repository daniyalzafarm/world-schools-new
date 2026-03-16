import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { WebSocketService } from '../websocket/websocket.service'
import { MessagesService } from './services/messages.service'
import { TypingService } from './services/typing.service'
import { PresenceService } from './services/presence.service'
import { PrismaService } from '../../prisma/prisma.service'
import { RedisPubSubService } from './services/redis-pub-sub.service'

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
 * Phase 2: Uses createMessageViaWebSocket() which:
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
    private readonly typingService: TypingService,
    private readonly presenceService: PresenceService,
    private readonly prisma: PrismaService,
    private readonly redisPubSub: RedisPubSubService
  ) {}

  /**
   * Handle send_message event from client
   * Validates participant, determines sender type, creates message in DB,
   * confirms to sender, broadcasts to room
   */
  @OnEvent('websocket:send_message')
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

      // Confirm to sender
      this.wsService.emitToUser(payload.userId, 'message:created', {
        message,
        tempId: payload.tempId,
      })

      // Broadcast to ALL participants via their user rooms (not just conversation room)
      // This ensures users receive message:new even for conversations they haven't joined
      const recipientUserIds = await this.getRecipientUserIds(
        payload.conversationId,
        payload.userId
      )
      for (const userId of recipientUserIds) {
        this.wsService.emitToUser(userId, 'message:new', { message })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to send message: ${errorMessage}`)
      this.wsService.emitToUser(payload.userId, 'message:error', {
        tempId: payload.tempId,
        error: errorMessage,
      })
    }
  }

  /**
   * Handle join_conversation event
   * Adds the user to the conversation room for real-time updates
   */
  @OnEvent('websocket:join_conversation')
  handleJoinConversation(payload: { userId: string; conversationId: string }) {
    this.wsService.joinRoom(payload.userId, `conversation:${payload.conversationId}`)
    this.logger.log(`User ${payload.userId} joined conversation ${payload.conversationId}`)
  }

  /**
   * Handle leave_conversation event
   * Removes the user from the conversation room
   */
  @OnEvent('websocket:leave_conversation')
  handleLeaveConversation(payload: { userId: string; conversationId: string }) {
    this.wsService.leaveRoom(payload.userId, `conversation:${payload.conversationId}`)
    this.logger.log(`User ${payload.userId} left conversation ${payload.conversationId}`)
  }

  /**
   * Handle typing:start event
   * Stores typing indicator in Redis and broadcasts to conversation room (excluding sender)
   */
  @OnEvent('websocket:typing_start')
  async handleTypingStart(payload: { userId: string; conversationId: string }) {
    try {
      await this.typingService.startTyping(payload.conversationId, payload.userId)

      // Broadcast to conversation room excluding sender
      this.wsService.emitToRoomExcluding(
        `conversation:${payload.conversationId}`,
        payload.userId,
        'typing:start',
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
  @OnEvent('websocket:typing_stop')
  async handleTypingStop(payload: { userId: string; conversationId: string }) {
    try {
      await this.typingService.stopTyping(payload.conversationId, payload.userId)

      // Broadcast to conversation room excluding sender
      this.wsService.emitToRoomExcluding(
        `conversation:${payload.conversationId}`,
        payload.userId,
        'typing:stop',
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
   * Updates user presence in Redis and broadcasts to user's room
   */
  @OnEvent('websocket:presence_update')
  async handlePresenceUpdate(payload: { userId: string; status: 'online' | 'away' | 'offline' }) {
    try {
      if (payload.status === 'online') {
        await this.presenceService.setOnline(payload.userId)
      } else if (payload.status === 'away') {
        await this.presenceService.setAway(payload.userId)
      } else if (payload.status === 'offline') {
        await this.presenceService.setOffline(payload.userId)
      }

      // Broadcast presence update to all clients (via user room for cross-replica)
      this.wsService.emitToUser(payload.userId, 'presence:update', {
        userId: payload.userId,
        status: payload.status,
        lastSeenAt: new Date().toISOString(),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to handle presence update: ${errorMessage}`)
    }
  }

  /**
   * Handle message:read event
   * Creates read receipt in DB (MessagesService handles Redis pub/sub internally)
   */
  @OnEvent('websocket:message_read')
  async handleMessageRead(payload: { userId: string; messageId: string; conversationId: string }) {
    try {
      await this.messagesService.markAsRead({
        messageId: payload.messageId,
        userId: payload.userId,
      })

      // Broadcast read receipt to conversation room
      this.wsService.emitToRoom(`conversation:${payload.conversationId}`, 'receipt:read', {
        messageId: payload.messageId,
        userId: payload.userId,
        conversationId: payload.conversationId,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to handle message read: ${errorMessage}`)
    }
  }

  /**
   * Handle message:delivered event
   * Creates delivery receipt in DB (MessagesService handles Redis pub/sub internally)
   */
  @OnEvent('websocket:message_delivered')
  async handleMessageDelivered(payload: {
    userId: string
    messageId: string
    conversationId: string
    deliveryLatencyMs?: number
  }) {
    try {
      await this.messagesService.markAsDelivered({
        messageId: payload.messageId,
        userId: payload.userId,
        deliveryLatencyMs: payload.deliveryLatencyMs,
      })

      // Broadcast delivery receipt to conversation room
      this.wsService.emitToRoom(`conversation:${payload.conversationId}`, 'receipt:delivered', {
        messageId: payload.messageId,
        userId: payload.userId,
        conversationId: payload.conversationId,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to handle message delivered: ${errorMessage}`)
    }
  }

  /**
   * Get all recipient user IDs for a conversation, excluding the sender.
   * Includes direct participants AND provider organization users for USER_PROVIDER conversations.
   */
  private async getRecipientUserIds(
    conversationId: string,
    excludeUserId: string
  ): Promise<string[]> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        type: true,
        metadata: true,
        participants: { select: { userId: true } },
      },
    })

    if (!conversation) return []

    const recipientUserIds = new Set<string>()

    // Add direct participants (excluding sender)
    for (const p of conversation.participants) {
      if (p.userId !== excludeUserId) {
        recipientUserIds.add(p.userId)
      }
    }

    // For USER_PROVIDER conversations, also add provider organization users
    const metadata = conversation.metadata as { providerId?: string } | null
    if (conversation.type === 'USER_PROVIDER' && metadata?.providerId) {
      const providerUsers = await this.redisPubSub.getProviderUsers(metadata.providerId)
      for (const user of providerUsers) {
        if (user.id !== excludeUserId) {
          recipientUserIds.add(user.id)
        }
      }
    }

    return Array.from(recipientUserIds)
  }
}
