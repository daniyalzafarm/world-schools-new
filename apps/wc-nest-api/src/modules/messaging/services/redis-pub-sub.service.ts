import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { RedisService } from '../../redis/redis.service'
import { PrismaService } from '../../../prisma/prisma.service'
import { WebSocketService } from '../../websocket/websocket.service'
import Redis from 'ioredis'
import { Server } from 'socket.io'

/**
 * Redis Pub/Sub Service for real-time messaging
 * Handles publishing and subscribing to Redis channels for cross-replica communication
 */
@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap {
  private readonly logger = new Logger(RedisPubSubService.name)
  private publisher: Redis | null = null
  private subscriber: Redis | null = null
  private server: Server | null = null
  private isInitialized = false
  private conversationsService: any
  private messagesService: any

  constructor(
    private redisService: RedisService,
    private prisma: PrismaService,
    private moduleRef: ModuleRef,
    private wsService: WebSocketService
  ) {}

  async onModuleInit() {
    try {
      // Lazy-load services to avoid circular dependency
      // These services are needed for cache invalidation handlers
      const { ConversationsService } = await import('./conversations.service')
      const { MessagesService } = await import('./messages.service')
      this.conversationsService = this.moduleRef.get(ConversationsService, { strict: false })
      this.messagesService = this.moduleRef.get(MessagesService, { strict: false })

      // Get Redis URL from environment
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

      this.logger.log('Initializing Redis Pub/Sub...')

      // Create separate connections for publisher and subscriber
      // This is required by Redis - same connection cannot be used for both
      this.publisher = new Redis(redisUrl, {
        retryStrategy: times => {
          const delay = Math.min(times * 50, 2000)
          this.logger.warn(`Publisher retry attempt ${times}, delay: ${delay}ms`)
          return delay
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
      })

      this.subscriber = new Redis(redisUrl, {
        retryStrategy: times => {
          const delay = Math.min(times * 50, 2000)
          this.logger.warn(`Subscriber retry attempt ${times}, delay: ${delay}ms`)
          return delay
        },
        maxRetriesPerRequest: null, // Subscriber should never timeout
        enableReadyCheck: true,
      })

      // Set up error handlers
      this.publisher.on('error', err => {
        this.logger.error('Publisher error:', err)
      })

      this.subscriber.on('error', err => {
        this.logger.error('Subscriber error:', err)
      })

      // Subscribe to all messaging channels
      await this.subscribeToChannels()

      // Set up message handler
      this.subscriber.on('message', (channel, message) => {
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
   *
   * This replaces the old pattern where MessagingGateway.afterInit() called
   * redisPubSub.setServer(server) directly — which broke when the legacy
   * gateway was deleted in Phase E.
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

  async onModuleDestroy() {
    this.logger.log('Shutting down Redis Pub/Sub...')

    if (this.subscriber) {
      await this.subscriber.quit()
    }

    if (this.publisher) {
      await this.publisher.quit()
    }

    this.logger.log('Redis Pub/Sub connections closed')
  }

  /**
   * Subscribe to all messaging-related channels
   */
  private async subscribeToChannels() {
    if (!this.subscriber) {
      throw new Error('Subscriber not initialized')
    }

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
      'conversations:new', // ✅ NEW: Real-time conversation creation events
      // ✅ NEW: Cache invalidation channels
      'cache:invalidate:conversations',
      'cache:invalidate:messages',
      'cache:invalidate:metrics',
    ]

    await this.subscriber.subscribe(...channels)
    this.logger.log(`Subscribed to ${channels.length} Redis channels`)
  }

  /**
   * Publish a message to a Redis channel
   */
  async publishMessage(channel: string, data: any): Promise<boolean> {
    if (!this.isInitialized || !this.publisher) {
      this.logger.warn('Publisher not ready, skipping publish')
      return false
    }

    try {
      const payload = JSON.stringify(data)
      await this.publisher.publish(channel, payload)
      this.logger.debug(`Published to ${channel}:`, data)
      return true
    } catch (error) {
      this.logger.error(`Failed to publish to ${channel}:`, error)
      return false
    }
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
          const messagePayload = { message: data.message || data }

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

          break
        }

        case 'messages:updated':
          this.server.to(`conversation:${data.conversationId}`).emit('message:updated', data)
          break

        case 'messages:deleted':
          this.server.to(`conversation:${data.conversationId}`).emit('message:deleted', data)
          break

        case 'typing:events':
          // Broadcast typing events to all participants EXCEPT the sender
          // This prevents users from seeing their own typing indicator
          // Note: The sender is already excluded in the same replica via client.broadcast.to()
          // This handles cross-replica broadcasting (when sender is on a different server)
          if (data.userId && data.socketId) {
            // Get all sockets in the conversation room
            const room = `conversation:${data.conversationId}`
            const socketsInRoom = await this.server.in(room).fetchSockets()

            this.logger.debug(
              `[Typing Events] Room: ${room}, Total sockets: ${socketsInRoom.length}, Typing userId: ${data.userId}, Sender socketId: ${data.socketId}`
            )

            // Emit to each socket except the one with the sender's socketId
            // (In cross-replica scenarios, the socketId won't match any local socket, so all will receive)
            let emittedCount = 0
            for (const socket of socketsInRoom) {
              // Skip if this is the sender's socket (shouldn't happen in cross-replica, but defensive)
              if (socket.id !== data.socketId) {
                socket.emit(data.event, data)
                emittedCount++
                this.logger.debug(`[Typing Events] Emitted to socket ${socket.id}`)
              } else {
                this.logger.debug(`[Typing Events] Skipped sender socket ${socket.id}`)
              }
            }

            this.logger.debug(
              `[Typing Events] Emitted to ${emittedCount} out of ${socketsInRoom.length} sockets`
            )
          } else {
            // Fallback: broadcast to all if userId/socketId is missing (shouldn't happen)
            this.logger.warn('[Typing Events] userId or socketId is missing, broadcasting to all')
            this.server.to(`conversation:${data.conversationId}`).emit(data.event, data)
          }
          break

        case 'presence:updates':
          // Broadcast presence updates to all connected clients
          this.server.emit('presence:update', data)
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
          this.server.to(`conversation:${data.conversationId}`).emit('receipt:delivered', data)
          break

        case 'conversation:assigned':
          // Broadcast conversation assignment to all participants in the conversation
          this.server.to(`conversation:${data.conversationId}`).emit('conversation:assigned', data)
          break

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
    return this.isInitialized && !!this.publisher && !!this.subscriber
  }

  /**
   * Get subscriber client for advanced operations
   */
  getSubscriber(): Redis | null {
    return this.subscriber
  }

  /**
   * Get publisher client for advanced operations
   */
  getPublisher(): Redis | null {
    return this.publisher
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

    // Invalidate cache for specified users
    for (const userId of data.userIds) {
      await this.conversationsService.invalidateConversationCache(userId)
    }

    // If providerId specified, invalidate cache for all provider users
    if (data.providerId) {
      const providerUsers = await this.getProviderUsers(data.providerId)
      for (const user of providerUsers) {
        await this.conversationsService.invalidateConversationCache(user.id)
      }
    }
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
   * ✅ NEW: Get all active users for a provider organization
   * Users are related to providers through roles (UserRole -> Role -> Provider)
   * ✅ PUBLIC: Called from MessagesService and ConversationsService for local cache invalidation
   */
  async getProviderUsers(providerId: string): Promise<{ id: string }[]> {
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

    return users
  }
}
