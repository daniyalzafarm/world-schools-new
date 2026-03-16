import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import type { Server, Socket } from 'socket.io'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { JwtService } from '@nestjs/jwt'
import Redis from 'ioredis'
import { createAdapter } from '@socket.io/redis-adapter'
import { WebSocketService } from './websocket.service'

/**
 * Helper function to parse CORS origins from environment variable
 * Removes quotes and trims whitespace from each origin
 */
function getCorsOrigins(): string[] {
  const origins = process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5300'
  const cleaned = origins.replace(/^["']|["']$/g, '')
  return cleaned.split(',').map(origin => origin.trim())
}

/**
 * Global WebSocket Gateway
 *
 * Handles all WebSocket connections at the application level.
 * Routes events to domain-specific handlers via EventEmitter2.
 * Replaces the messaging-specific gateway with a global one.
 */
@WebSocketGateway({
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000, // Server sends ping every 25 seconds
  pingTimeout: 10000, // Server waits 10 seconds for pong response
  // Total zombie detection time: 35 seconds (25s interval + 10s timeout)
})
export class GlobalWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(GlobalWebSocketGateway.name)

  constructor(
    private readonly wsService: WebSocketService,
    private readonly eventEmitter: EventEmitter2,
    private readonly jwtService: JwtService
  ) {}

  afterInit() {
    // Configure Redis adapter for cross-replica broadcasting
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

      const pubClient = new Redis(redisUrl, {
        retryStrategy: times => {
          const delay = Math.min(times * 50, 2000)
          this.logger.warn(`Redis adapter pub retry attempt ${times}, delay: ${delay}ms`)
          return delay
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
      })

      const subClient = new Redis(redisUrl, {
        retryStrategy: times => {
          const delay = Math.min(times * 50, 2000)
          this.logger.warn(`Redis adapter sub retry attempt ${times}, delay: ${delay}ms`)
          return delay
        },
        maxRetriesPerRequest: null, // Subscriber should never timeout
        enableReadyCheck: true,
      })

      pubClient.on('error', err => {
        this.logger.error('Redis adapter pub client error:', err)
      })

      subClient.on('error', err => {
        this.logger.error('Redis adapter sub client error:', err)
      })

      this.server.adapter(createAdapter(pubClient, subClient))
      this.logger.log('✅ Redis adapter configured for cross-replica broadcasting')
    } catch (error) {
      this.logger.error('Failed to configure Redis adapter:', error)
      this.logger.warn('Running in single-replica mode (no cross-replica broadcasting)')
    }

    // Pass server reference to WebSocketService for server-level emissions
    this.wsService.setServer(this.server)

    this.logger.log('Global WebSocket Gateway initialized')
    this.logger.log('Heartbeat: pingInterval=25s, pingTimeout=10s (zombie detection in 35s)')
    this.logger.log(`CORS origins: ${getCorsOrigins().join(', ')}`)
  }

  /**
   * Extract JWT token from cookie header string.
   * Tries app-specific cookie names first, then falls back to generic.
   */
  private extractTokenFromCookies(cookieHeader: string | undefined): string | undefined {
    if (!cookieHeader) return undefined

    const cookies: Record<string, string> = {}
    for (const pair of cookieHeader.split(';')) {
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) continue
      const key = pair.substring(0, eqIdx).trim()
      const value = pair.substring(eqIdx + 1).trim()
      cookies[key] = value
    }

    // Try app-specific cookies first (most specific → least specific)
    return (
      cookies['wc_provider_access_token'] ||
      cookies['wc_user_access_token'] ||
      cookies['wc_superadmin_access_token'] ||
      cookies['access_token'] ||
      undefined
    )
  }

  /**
   * Handle new WebSocket connection
   * Authenticates the client via JWT token from handshake auth or cookies
   */
  handleConnection(client: Socket) {
    try {
      // Try auth.token from socket.io handshake first (request-based auth)
      let token = client.handshake?.auth?.token as string | undefined

      // Fallback to cookies for cookie-based auth (HTTP-only JWT cookies)
      if (!token) {
        token = this.extractTokenFromCookies(client.handshake?.headers?.cookie)
      }

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without auth token`)
        client.disconnect()
        return
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token)
      const userId = payload.sub || payload.userId

      if (!userId) {
        this.logger.warn(`Client ${client.id} has invalid token payload`)
        client.disconnect()
        return
      }

      // Store userId on the socket for later use
      client.handshake.auth.userId = userId
      client.data = { userId }

      // Join user-specific room for targeted broadcasts (e.g., new conversations)
      void client.join(`user:${userId}`)

      this.wsService.handleConnection(client, userId)
      this.logger.log(`Client connected: ${client.id}, User: ${userId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.warn(`Client ${client.id} authentication failed: ${errorMessage}`)
      client.disconnect()
    }
  }

  /**
   * Handle WebSocket disconnection.
   * Called for all disconnect reasons including 'ping timeout' (zombie detection).
   */
  handleDisconnect(client: Socket, ...args: any[]) {
    const userId = client.data?.userId as string | undefined
    // Socket.io passes the disconnect reason (e.g., 'ping timeout', 'transport close', 'client namespace disconnect')
    const reason = (args[0] as string) || 'unknown'
    this.logger.log(
      `Client disconnected: ${client.id}${userId ? `, User: ${userId}` : ''}, reason: ${reason}`
    )
    this.wsService.handleDisconnection(client)
  }

  /**
   * Handle send_message event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage('send_message')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      conversationId: string
      content: string
      tempId: string
      attachmentIds?: string[]
    }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit('websocket:send_message', {
      userId,
      ...payload,
    })
  }

  /**
   * Handle join_conversation event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage('join_conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit('websocket:join_conversation', {
      userId,
      ...payload,
    })
  }

  /**
   * Handle leave_conversation event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit('websocket:leave_conversation', {
      userId,
      ...payload,
    })
  }

  /**
   * Handle typing:start event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit('websocket:typing_start', {
      userId,
      ...payload,
    })
  }

  /**
   * Handle typing:stop event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit('websocket:typing_stop', {
      userId,
      ...payload,
    })
  }

  /**
   * Handle presence:update event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage('presence:update')
  handlePresenceUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { status: 'online' | 'away' | 'offline' }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit('websocket:presence_update', {
      userId,
      ...payload,
    })
  }

  /**
   * Handle message:read event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage('message:read')
  handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit('websocket:message_read', {
      userId,
      ...payload,
    })
  }

  /**
   * Handle message:delivered event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage('message:delivered')
  handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { messageId: string; conversationId: string; deliveryLatencyMs?: number }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit('websocket:message_delivered', {
      userId,
      ...payload,
    })
  }
}
