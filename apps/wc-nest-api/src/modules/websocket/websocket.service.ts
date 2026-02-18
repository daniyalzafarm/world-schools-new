import { Injectable, Logger } from '@nestjs/common'
import type { Server, Socket } from 'socket.io'

/**
 * Global WebSocket Service
 *
 * Manages WebSocket client connections and provides methods for
 * emitting events to users and rooms. Supports multi-session
 * tracking (multiple tabs/devices per user).
 *
 * When a Socket.io Redis adapter is configured (via the gateway),
 * server-level emissions (emitToRoom, emitToUser) automatically
 * broadcast across all replicas.
 */
@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name)

  /** Socket.io server instance (set by gateway after init) */
  private server: Server | null = null

  /** Map of socketId → Socket */
  private clients = new Map<string, Socket>()

  /** Map of userId → Set<socketId> (supports multiple tabs/devices) */
  private userSockets = new Map<string, Set<string>>()

  /**
   * Set the Socket.io server instance for server-level emissions.
   * Called by GlobalWebSocketGateway.afterInit() after Redis adapter is configured.
   * When server is available, emitToRoom/emitToUser use server.to().emit()
   * which goes through the Redis adapter for cross-replica broadcasting.
   */
  setServer(server: Server) {
    this.server = server
    this.logger.log('Socket.io server attached to WebSocketService')
  }

  /**
   * Get the Socket.io server instance.
   * Used by other services (e.g. RedisPubSubService) that need the server
   * reference for broadcasting but cannot receive it directly from the gateway
   * due to module boundaries.
   */
  getServer(): Server | null {
    return this.server
  }

  /**
   * Handle a new client connection
   */
  handleConnection(client: Socket, userId: string) {
    // Store client
    this.clients.set(client.id, client)

    // Track user's sockets (user can have multiple tabs/devices)
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set())
    }
    this.userSockets.get(userId)!.add(client.id)

    this.logger.log(
      `User ${userId} connected (${this.userSockets.get(userId)!.size} active sessions)`
    )
  }

  /**
   * Handle client disconnection.
   * Called by the gateway when a client disconnects (including ping timeout / zombie detection).
   * Cleans up both the `clients` map and the `userSockets` multi-session map.
   */
  handleDisconnection(client: Socket) {
    const userId = client.handshake?.auth?.userId as string | undefined

    this.clients.delete(client.id)

    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id)
      const remaining = this.userSockets.get(userId)!.size
      if (remaining === 0) {
        this.userSockets.delete(userId)
        this.logger.log(`User ${userId} fully disconnected (0 sessions remaining)`)
      } else {
        this.logger.log(`User ${userId} session closed (${remaining} sessions remaining)`)
      }
    }
  }

  /**
   * Emit to a specific user (all their active sessions, across all replicas).
   * Users are auto-joined to `user:${userId}` room on connection.
   * When the Redis adapter is configured, this broadcasts across all replicas.
   */
  emitToUser(userId: string, event: string, data: any) {
    if (this.server) {
      // Server-level emit goes through Redis adapter for cross-replica broadcasting
      this.server.to(`user:${userId}`).emit(event, data)
    } else {
      // Fallback: iterate local sockets (single-replica mode)
      const socketIds = this.userSockets.get(userId)
      if (socketIds) {
        socketIds.forEach(socketId => {
          const client = this.clients.get(socketId)
          client?.emit(event, data)
        })
      }
    }
  }

  /**
   * Emit to all clients in a specific room (across all replicas).
   * When the Redis adapter is configured, this broadcasts across all replicas.
   */
  emitToRoom(room: string, event: string, data: any) {
    if (this.server) {
      // Server-level emit goes through Redis adapter for cross-replica broadcasting
      this.server.to(room).emit(event, data)
    } else {
      // Fallback: iterate local sockets (single-replica mode)
      this.clients.forEach(client => {
        if (client.rooms.has(room)) {
          client.emit(event, data)
        }
      })
    }
  }

  /**
   * Emit to all clients in a room EXCEPT a specific user's sessions (across all replicas).
   * Used for typing indicators where the sender should not receive their own event.
   * Leverages Socket.io's `except()` with user rooms for cross-replica exclusion.
   */
  emitToRoomExcluding(room: string, excludeUserId: string, event: string, data: any) {
    if (this.server) {
      // server.to(room).except(`user:${excludeUserId}`) excludes all sockets
      // in the user's room across all replicas via the Redis adapter
      this.server.to(room).except(`user:${excludeUserId}`).emit(event, data)
    } else {
      // Fallback: iterate local sockets, skip the excluded user's sessions
      const excludedSocketIds = this.userSockets.get(excludeUserId)
      this.clients.forEach((client, socketId) => {
        if (client.rooms.has(room) && !excludedSocketIds?.has(socketId)) {
          client.emit(event, data)
        }
      })
    }
  }

  /**
   * Join a user to a room (all their active sessions)
   */
  joinRoom(userId: string, room: string) {
    const socketIds = this.userSockets.get(userId)
    if (socketIds) {
      socketIds.forEach(socketId => {
        const client = this.clients.get(socketId)
        void client?.join(room)
      })
    }
  }

  /**
   * Remove a user from a room (all their active sessions)
   */
  leaveRoom(userId: string, room: string) {
    const socketIds = this.userSockets.get(userId)
    if (socketIds) {
      socketIds.forEach(socketId => {
        const client = this.clients.get(socketId)
        void client?.leave(room)
      })
    }
  }

  /**
   * Get the number of active connections for a user
   */
  getUserSessionCount(userId: string): number {
    return this.userSockets.get(userId)?.size ?? 0
  }

  /**
   * Check if a user is currently connected
   */
  isUserOnline(userId: string): boolean {
    return this.getUserSessionCount(userId) > 0
  }
}
