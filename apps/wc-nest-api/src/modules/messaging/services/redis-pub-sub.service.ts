import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { RedisService } from '../../redis/redis.service'
import { PrismaService } from '../../../prisma/prisma.service'
import { WebSocketService } from '../../websocket/websocket.service'
import { WebSocketRedisService } from '../../websocket/websocket-redis.service'
import { Server } from 'socket.io'

/**
 * Redis Pub/Sub Service for real-time messaging
 * Handles publishing and subscribing to Redis channels for cross-replica communication.
 *
 * Redis connections are no longer created here — they are provided by
 * WebSocketRedisService (injected), which keeps the total connection count at 2
 * per application instance instead of the previous 4+.
 */
@Injectable()
export class RedisPubSubService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(RedisPubSubService.name)
  private server: Server | null = null
  private isInitialized = false
  private conversationsService: any
  private messagesService: any

  constructor(
    private redisService: RedisService,
    private prisma: PrismaService,
    private moduleRef: ModuleRef,
    private wsService: WebSocketService,
    private wsRedis: WebSocketRedisService
  ) {}

  async onModuleInit() {
    try {
      // Lazy-load services to avoid circular dependency
      const { ConversationsService } = await import('./conversations.service')
      const { MessagesService } = await import('./messages.service')
      this.conversationsService = this.moduleRef.get(ConversationsService, { strict: false })
      this.messagesService = this.moduleRef.get(MessagesService, { strict: false })

      this.logger.log('Initializing Redis Pub/Sub...')

      // Subscribe to all messaging channels using the shared subscriber connection
      await this.subscribeToChannels()

      // Set up message handler on the shared subscriber
      this.wsRedis.getSubscriber().on('message', (channel, message) => {
        this.handleRedisMessage(channel, message).catch(err => {
          this.logger.error('Message error:', err)
        })
      })

      this.isInitialized = true
      this.logger.log('✅ Redis Pub/Sub initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize Redis Pub/Sub:', error)
      // Don't throw - allow app to start without pub/sub
    }
  }

  /**
   * Called after all modules are initialized and gateways have run afterInit().
   * At this point, GlobalWebSocketGateway has already called wsService.setServer(),
   * so we can safely grab the server reference for broadcasting.
   */
  onApplicationBootstrap() {
    const server = this.wsService.getServer()
    if (server) {
      this.server = server
      this.logger.log('✅ Socket.io server attached via OnApplicationBootstrap')
    } else {
      this.logger.warn(
        'Socket.io server not available during OnApplicationBootstrap — ' +
          'RedisPubSubService will not be able to broadcast WebSocket events'
      )
    }
  }

  // onModuleDestroy removed — Redis connections are managed by WebSocketRedisService

  /**
   * Subscribe to all messaging-related channels
   */
  private async subscribeToChannels() {
    const channels = [
      'messages:new',
      'messages:updated',
      'messages:deleted',
      'typing:events',
      'presence:updates',
      'reactions:added',
      'reactions:removed',
      'receipts:read',
      'receipts:delivered',
      'conversation:assigned',
      // Support ticket events
      'ticket:statusUpdated',
      'ticket:assigned',
      'conversations:new',
      // Cache invalidation channels
      'cache:invalidate:conversations',
      'cache:invalidate:messages',
      'cache:invalidate:metrics',
    ]

    await this.wsRedis.getSubscriber().subscribe(...channels)
    this.logger.log(`Subscribed to ${channels.length} Redis channels`)
  }

  /**
   * Publish a message to a Redis channel
   */
  async publishMessage(channel: string, data: any): Promise<boolean> {
    if (!this.isInitialized) {
      this.logger.warn('Publisher not ready, skipping publish')
      return false
    }
    const ok = await this.wsRedis.publishTo(channel, data)
    if (ok) this.logger.debug(`Published to ${channel}:`, data)
    return ok
  }

  /**
   * Handle incoming Redis messages and broadcast to WebSocket clients
   */
  private async handleRedisMessage(channel: string, message: string) {
    if (!this.server) {
      this.logger.debug('Socket.io server not set, skipping broadcast')
      return
    }

    try {
      const data = JSON.parse(message)
      this.logger.debug(`Received message on ${channel}:`, data)

      switch (channel) {
        case 'messages:new': {
          // ✅ Broadcast to participant user rooms (not just conversation room)
          // This ensures users receive message:new even for conversations they haven't joined
          // Include tempId so clients can deduplicate against optimistic messages
          const messagePayload = {
            message: data.message || data,
            ...(data.tempId ? { tempId: data.tempId as string } : {}),
          }

          // Broadcast to direct participants (sender already excluded in payload)
          if (data.recipientUserIds && Array.isArray(data.recipientUserIds)) {
            for (const userId of data.recipientUserIds) {
              this.server.to(`user:${userId}`).emit('message:new', messagePayload)
            }
          }

          // For USER_PROVIDER conversations, also broadcast to provider organization users
          if (data.providerId) {
            const providerUsers = await this.getProviderUsers(data.providerId)
            for (const user of providerUsers) {
              // Skip the sender to avoid duplicate events
              if (user.id !== data.senderId) {
                this.server.to(`user:${user.id}`).emit('message:new', messagePayload)
              }
            }
          }

          // Broadcast to the conversation room for non-participant viewers
          // (e.g. superadmin agents viewing a support ticket via join_conversation).
          // These users are not in recipientUserIds so this is the only delivery path for them.
          // Users who receive via both their user room and the conversation room are handled
          // by frontend deduplication (message ID check in the messaging store).
          if (data.conversationId) {
            this.server
              .to(`conversation:${data.conversationId}`)
              .emit('message:new', messagePayload)
          }

          break
        }

        case 'messages:updated':
          this.server.to(`conversation:${data.conversationId}`).emit('message:updated', data)
          break

        case 'messages:deleted':
          this.server.to(`conversation:${data.conversationId}`).emit('message:deleted', data)
          break

        case 'typing:events':
          // Broadcast typing events to the conversation room, excluding the sender's user room.
          // server.to(room).except(`user:${userId}`) is O(1) via the Redis adapter and avoids
          // the O(n) fetchSockets() call that was blocking the event loop for large conversations.
          if (data.userId) {
            this.server
              .to(`conversation:${data.conversationId}`)
              .except(`user:${data.userId}`)
              .emit(data.event, data)
          } else {
            // Fallback: broadcast to all if userId is missing (shouldn't happen in practice)
            this.logger.warn('[Typing Events] userId is missing, broadcasting to all in room')
            this.server.to(`conversation:${data.conversationId}`).emit(data.event, data)
          }
          break

        case 'presence:updates':
          // Presence updates are now delivered directly in MessagingWebSocketHandler
          // via targeted subscriber sets — no server-wide broadcast needed here.
          break

        case 'reactions:added':
          this.server.to(`conversation:${data.conversationId}`).emit('reaction:added', data)
          break

        case 'reactions:removed':
          this.server.to(`conversation:${data.conversationId}`).emit('reaction:removed', data)
          break

        case 'receipts:read':
          this.server.to(`conversation:${data.conversationId}`).emit('receipt:read', data)
          break

        case 'receipts:delivered':
          // Broadcast to the conversation room (catches anyone who has joined it)
          this.server.to(`conversation:${data.conversationId}`).emit('receipt:delivered', data)
          // Also emit directly to the sender's user room so they always receive
          // the delivery tick regardless of conversation room membership.
          // This matches the pattern used for ticket events and guarantees delivery
          // even when WEBSOCKET_MESSAGES flag is false and conversation rooms are not joined.
          if (data.senderId) {
            this.server.to(`user:${data.senderId}`).emit('receipt:delivered', data)
          }
          break

        case 'conversation:assigned':
          // Broadcast conversation assignment to all participants in the conversation
          this.server.to(`conversation:${data.conversationId}`).emit('conversation:assigned', data)
          break

        case 'ticket:statusUpdated': {
          // Targeted delivery — only the requester and assigned staff member receive this.
          // Replaces the previous server.emit() O(n) broadcast.
          const statusTargets = new Set<string>()
          if (data.requesterUserId) statusTargets.add(data.requesterUserId)
          if (data.assignedToUserId) statusTargets.add(data.assignedToUserId)
          if (data.changedByUserId) statusTargets.add(data.changedByUserId)
          for (const userId of statusTargets) {
            this.server.to(`user:${userId}`).emit('ticket:statusUpdated', data)
          }
          break
        }

        case 'ticket:assigned': {
          // Targeted delivery — requester, new assignee, old assignee, and assigner.
          const assignTargets = new Set<string>()
          if (data.requesterUserId) assignTargets.add(data.requesterUserId)
          if (data.assignedToUserId) assignTargets.add(data.assignedToUserId)
          if (data.assignedByUserId) assignTargets.add(data.assignedByUserId)
          if (data.fromAssigneeUserId) assignTargets.add(data.fromAssigneeUserId)
          for (const userId of assignTargets) {
            this.server.to(`user:${userId}`).emit('ticket:assigned', data)
          }
          break
        }

        case 'conversations:new':
          // ✅ NEW: Broadcast new conversation to provider users or specific users
          await this.handleNewConversation(data)
          break

        // ✅ NEW: Cache invalidation handlers
        case 'cache:invalidate:conversations':
          await this.handleConversationCacheInvalidation(data)
          break

        case 'cache:invalidate:messages':
          await this.handleMessageCacheInvalidation(data)
          break

        case 'cache:invalidate:metrics':
          await this.handleMetricsCacheInvalidation(data)
          break

        default:
          this.logger.warn(`Unknown channel: ${channel}`)
      }
    } catch (error) {
      this.logger.error(`Error handling message from ${channel}:`, error)
    }
  }

  /**
   * Set the Socket.io server instance for broadcasting
   * This should be called from the WebSocket gateway
   */
  setServer(server: Server) {
    this.server = server
    this.logger.log('Socket.io server attached to RedisPubSubService')
  }

  /**
   * Check if pub/sub is ready
   */
  isReady(): boolean {
    return this.isInitialized
  }

  /**
   * ✅ NEW: Handle new conversation broadcast to provider users
   */
  private async handleNewConversation(data: {
    conversation: any
    providerId?: string
    userIds?: string[]
  }) {
    if (!this.server) {
      this.logger.warn('[Real-time] Server not initialized, cannot broadcast new conversation')
      return
    }

    this.logger.log(`[Real-time] Broadcasting new conversation ${data.conversation.id}`)
    this.logger.log(
      `[Real-time] ProviderId: ${data.providerId}, UserIds: ${data.userIds?.join(', ') || 'none'}`
    )

    // For provider conversations, emit to all provider users
    if (data.providerId) {
      this.logger.log(`[Real-time] Fetching provider users for provider ${data.providerId}`)
      const providerUsers = await this.getProviderUsers(data.providerId)
      this.logger.log(
        `[Real-time] Found ${providerUsers.length} provider users: ${providerUsers.map(u => u.id).join(', ')}`
      )

      for (const user of providerUsers) {
        // Emit to user-specific room (users join `user:${userId}` room on authentication)
        const roomName = `user:${user.id}`
        this.logger.log(`[Real-time] Emitting conversation:new to room: ${roomName}`)
        this.server.to(roomName).emit('conversation:new', {
          conversation: data.conversation,
        })
        this.logger.log(`[Real-time] ✅ Emitted conversation:new to provider user ${user.id}`)
      }
    }

    // For superadmin conversations, emit to specific users
    if (data.userIds) {
      this.logger.log(`[Real-time] Emitting to ${data.userIds.length} specific users`)
      for (const userId of data.userIds) {
        // Emit to user-specific room (users join `user:${userId}` room on authentication)
        const roomName = `user:${userId}`
        this.logger.log(`[Real-time] Emitting conversation:new to room: ${roomName}`)
        this.server.to(roomName).emit('conversation:new', {
          conversation: data.conversation,
        })
        this.logger.log(`[Real-time] ✅ Emitted conversation:new to user ${userId}`)
      }
    }
  }

  /**
   * ✅ NEW: Handle conversation cache invalidation across replicas
   */
  private async handleConversationCacheInvalidation(data: {
    userIds: string[]
    providerId?: string
  }) {
    this.logger.debug(`Invalidating conversation cache for ${data.userIds.length} users`)

    // Collect all unique user IDs to invalidate (deduplicating across direct + provider users)
    const allUserIds = new Set<string>(data.userIds)

    // If providerId specified, also invalidate cache for all provider users
    if (data.providerId) {
      const providerUsers = await this.getProviderUsers(data.providerId)
      providerUsers.forEach(u => allUserIds.add(u.id))
    }

    // Invalidate all caches in parallel instead of sequentially
    await Promise.all(
      Array.from(allUserIds).map(userId =>
        this.conversationsService.invalidateConversationCache(userId)
      )
    )
  }

  /**
   * ✅ NEW: Handle message cache invalidation across replicas
   */
  private async handleMessageCacheInvalidation(data: { conversationId: string }) {
    this.logger.debug(`Invalidating message cache for conversation ${data.conversationId}`)
    await this.messagesService.invalidateMessageCache(data.conversationId)
  }

  /**
   * ✅ NEW: Handle metrics cache invalidation across replicas
   */
  private async handleMetricsCacheInvalidation(data: { conversationId: string }) {
    this.logger.debug(`Invalidating metrics cache for conversation ${data.conversationId}`)
    const metricsKey = `conversation:metrics:${data.conversationId}`
    await this.redisService.del(metricsKey)
  }

  /**
   * Get all active users for a provider organization.
   * Result is cached in Redis for 60 seconds to avoid repeated DB queries on every
   * message broadcast for USER_PROVIDER conversations.
   *
   * ✅ PUBLIC: Called from MessagesService and ConversationsService for cache invalidation.
   */
  async getProviderUsers(providerId: string): Promise<{ id: string }[]> {
    const cacheKey = `provider:users:${providerId}`

    // Return cached result if available
    const cached = await this.redisService.get(cacheKey)
    if (cached) {
      try {
        return JSON.parse(cached) as { id: string }[]
      } catch {
        // Corrupted cache entry — fall through to DB query
      }
    }

    // Find all users who have roles associated with this provider
    const users = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              providerId: providerId,
            },
          },
        },
      },
      select: { id: true },
    })

    // Also include the provider owner
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { ownerId: true },
    })

    if (provider && !users.find(u => u.id === provider.ownerId)) {
      users.push({ id: provider.ownerId })
    }

    // Cache for 60 seconds — short enough to reflect membership changes promptly
    await this.redisService.setex(cacheKey, 60, JSON.stringify(users))

    return users
  }

  /**
   * Invalidate the provider users cache when membership changes.
   * Call this whenever a user is added to or removed from a provider.
   */
  async invalidateProviderUsersCache(providerId: string): Promise<void> {
    await this.redisService.del(`provider:users:${providerId}`)
  }
}
