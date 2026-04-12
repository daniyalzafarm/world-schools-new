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
import { Logger, OnModuleDestroy } from '@nestjs/common'
import type { Server, Socket } from 'socket.io'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { JwtService } from '@nestjs/jwt'
import { createAdapter } from '@socket.io/redis-adapter'
import { WebSocketService } from './websocket.service'
import { WebSocketRedisService } from './websocket-redis.service'
import { WsClientEvent, WsServerEvent } from '@world-schools/wc-types'
import { WsInternalEvent } from './ws-internal-events'

/** How many milliseconds before token expiry to warn the client to refresh */
const TOKEN_EXPIRY_WARN_THRESHOLD_MS = 4 * 60 * 1000 // 4 minutes

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
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(GlobalWebSocketGateway.name)
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly wsService: WebSocketService,
    private readonly eventEmitter: EventEmitter2,
    private readonly jwtService: JwtService,
    private readonly wsRedis: WebSocketRedisService
  ) {}

  afterInit() {
    // Configure Redis adapter for cross-replica broadcasting using shared connections
    try {
      this.server.adapter(createAdapter(this.wsRedis.getPublisher(), this.wsRedis.getSubscriber()))
      this.logger.log('✅ Redis adapter configured for cross-replica broadcasting')
    } catch (error) {
      this.logger.error('Failed to configure Redis adapter:', error)
      this.logger.warn('Running in single-replica mode (no cross-replica broadcasting)')
    }

    // Pass server reference to WebSocketService for server-level emissions
    this.wsService.setServer(this.server)

    // Application-level heartbeat: keep presence TTL alive for idle-but-connected users.
    // Socket.io's own ping/pong (25s/10s) handles transport-level keepalive separately.
    this.heartbeatInterval = setInterval(() => {
      this.server.emit('heartbeat:ping', { serverTime: Date.now() })
    }, 120_000) // every 2 minutes

    this.logger.log('Global WebSocket Gateway initialized')
    this.logger.log('Heartbeat: pingInterval=25s, pingTimeout=10s (zombie detection in 35s)')
    this.logger.log('Application heartbeat: 120s interval for presence TTL refresh')
    this.logger.log(`CORS origins: ${getCorsOrigins().join(', ')}`)
  }

  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
      this.logger.log('Heartbeat interval cleared')
    }
  }

  /**
   * Extract JWT token from cookie header string.
   * When clientApp is provided, selects the exact cookie for that app.
   * Falls back to legacy priority order when clientApp is unknown.
   */
  private extractTokenFromCookies(
    cookieHeader: string | undefined,
    clientApp?: string
  ): string | undefined {
    if (!cookieHeader) return undefined

    const cookies: Record<string, string> = {}
    for (const pair of cookieHeader.split(';')) {
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) continue
      const key = pair.substring(0, eqIdx).trim()
      const value = pair.substring(eqIdx + 1).trim()
      cookies[key] = value
    }

    // When the connecting app identifies itself, select its cookie exclusively.
    // This prevents cookie collision when multiple app cookies are present (same-browser testing).
    if (clientApp === 'user') return cookies['wc_user_access_token'] || undefined
    if (clientApp === 'provider') return cookies['wc_provider_access_token'] || undefined
    if (clientApp === 'superadmin') return cookies['wc_superadmin_access_token'] || undefined

    // Legacy fallback — order matters; most-specific first
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
      const clientApp = client.handshake?.auth?.clientApp as string | undefined

      // Fallback to cookies for cookie-based auth (HTTP-only JWT cookies)
      if (!token) {
        token = this.extractTokenFromCookies(client.handshake?.headers?.cookie, clientApp)
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

      // Store userId and token expiry on the socket for session lifecycle management
      client.handshake.auth.userId = userId
      client.data = {
        userId,
        // JWT exp is Unix seconds; store as ms for easy Date.now() comparison
        tokenExpiresAt: typeof payload.exp === 'number' ? payload.exp * 1000 : null,
      }

      // Join user-specific room for targeted broadcasts (e.g., new conversations)
      void client.join(`user:${userId}`)

      this.wsService.handleConnection(client, userId)

      // Mark user as online immediately and notify presence subscribers.
      // Routed via EventEmitter2 so MessagingWebSocketHandler handles presence
      // without creating a circular module dependency.
      this.eventEmitter.emit(WsInternalEvent.PresenceUpdate, { userId, status: 'online' })

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

    // Mark user offline immediately — don't wait for the 5-minute presence TTL to expire.
    // Only emit if the user has no remaining sessions (last tab/device disconnected).
    if (userId && !this.wsService.isUserOnline(userId)) {
      this.eventEmitter.emit(WsInternalEvent.PresenceUpdate, { userId, status: 'offline' })
    }
  }

  /**
   * Handle send_message event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage(WsClientEvent.SendMessage)
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
    this.eventEmitter.emit(WsInternalEvent.SendMessage, { userId, ...payload })
  }

  /**
   * Handle join_conversation event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage(WsClientEvent.JoinConversation)
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit(WsInternalEvent.JoinConversation, { userId, ...payload })
  }

  /**
   * Handle leave_conversation event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage(WsClientEvent.LeaveConversation)
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit(WsInternalEvent.LeaveConversation, { userId, ...payload })
  }

  /**
   * Handle typing:start event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage(WsClientEvent.TypingStart)
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit(WsInternalEvent.TypingStart, { userId, ...payload })
  }

  /**
   * Handle typing:stop event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage(WsClientEvent.TypingStop)
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit(WsInternalEvent.TypingStop, { userId, ...payload })
  }

  /**
   * Handle presence:update event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage(WsClientEvent.PresenceUpdate)
  handlePresenceUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { status: 'online' | 'away' | 'offline' }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit(WsInternalEvent.PresenceUpdate, { userId, ...payload })
  }

  /**
   * Handle message:read event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage(WsClientEvent.MessageRead)
  handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit(WsInternalEvent.MessageRead, { userId, ...payload })
  }

  /**
   * Handle message:delivered event from client
   * Routes to messaging module via EventEmitter2
   */
  @SubscribeMessage(WsClientEvent.MessageDelivered)
  handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { messageId: string; conversationId: string; deliveryLatencyMs?: number }
  ) {
    const userId = client.data?.userId as string
    this.eventEmitter.emit(WsInternalEvent.MessageDelivered, { userId, ...payload })
  }

  /**
   * Handle heartbeat:pong from client.
   * Client responds automatically to heartbeat:ping — this refreshes presence TTL
   * so idle-but-connected users do not appear offline after the 5-minute Redis TTL.
   */
  @SubscribeMessage(WsClientEvent.HeartbeatPong)
  handleHeartbeatPong(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId as string | undefined
    if (!userId) return

    // 1. Refresh presence TTL
    this.eventEmitter.emit(WsInternalEvent.HeartbeatPong, { userId })

    // 2. Check token expiry and warn/disconnect accordingly
    const tokenExpiresAt = client.data?.tokenExpiresAt as number | null
    if (tokenExpiresAt !== null && tokenExpiresAt !== undefined) {
      const remaining = tokenExpiresAt - Date.now()
      if (remaining <= 0) {
        // Token has expired — terminate the session
        this.logger.warn(`Token expired for user ${userId}, disconnecting socket ${client.id}`)
        client.emit(WsServerEvent.AuthExpired, {})
        client.disconnect()
        return
      }
      if (remaining <= TOKEN_EXPIRY_WARN_THRESHOLD_MS) {
        // Token expires within the warning window — prompt client to refresh
        client.emit(WsServerEvent.AuthTokenExpiring, { expiresInMs: remaining })
      }
    }
  }

  /**
   * Handle auth:token event from client.
   * Called when the client has refreshed its access token and wants to keep the session alive.
   * Validates the new token and updates the socket's session expiry.
   */
  @SubscribeMessage(WsClientEvent.AuthToken)
  handleAuthToken(@ConnectedSocket() client: Socket, @MessageBody() payload: { token: string }) {
    const userId = client.data?.userId as string | undefined
    if (!userId || !payload?.token) return

    try {
      const decoded = this.jwtService.verify(payload.token)
      const newUserId = decoded.sub || decoded.userId

      // Only allow refreshing the same user's token
      if (newUserId !== userId) {
        this.logger.warn(
          `auth:token userId mismatch for socket ${client.id}: expected ${userId}, got ${newUserId}`
        )
        client.emit(WsServerEvent.AuthExpired, {})
        client.disconnect()
        return
      }

      // Update expiry on the socket
      client.data.tokenExpiresAt =
        typeof decoded.exp === 'number' ? decoded.exp * 1000 : client.data.tokenExpiresAt

      client.emit(WsServerEvent.AuthTokenRefreshed, {})
      this.logger.log(`Token refreshed for user ${userId}, socket ${client.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`Invalid refresh token from socket ${client.id}: ${msg}`)
      client.emit(WsServerEvent.AuthExpired, {})
      client.disconnect()
    }
  }
}
