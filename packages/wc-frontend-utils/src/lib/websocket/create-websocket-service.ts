/**
 * Global WebSocket Service Factory for World Schools Applications
 *
 * This factory creates a configured WebSocket service that can be shared
 * across multiple modules (messaging, notifications, presence, etc.).
 *
 * @example
 * ```typescript
 * import { createGlobalWebSocketService } from '@world-schools/wc-frontend-utils'
 *
 * const wsService = createGlobalWebSocketService({
 *   url: 'http://localhost:3001',
 *   getAuthToken: () => apiClient.getTokens().accessToken,
 *   debug: true,
 * })
 *
 * // Use in messaging
 * wsService.emit('send_message', { conversationId, content })
 * wsService.on('message:new', (data) => console.log(data))
 * ```
 */

import { WsClientEvent, WsServerEvent } from '@world-schools/wc-types'
import { io, Socket } from 'socket.io-client'

export interface GlobalWebSocketConfig {
  /**
   * WebSocket server URL (e.g., 'http://localhost:3001')
   */
  url: string

  /**
   * Function to get the current authentication token
   */
  getAuthToken: () => string | null

  /**
   * Callback when WebSocket connects
   */
  onConnect?: () => void

  /**
   * Callback when WebSocket disconnects
   */
  onDisconnect?: (reason: string) => void

  /**
   * Callback when WebSocket error occurs
   */
  onError?: (error: Error) => void

  /**
   * Enable debug logging
   */
  debug?: boolean

  /**
   * Whether to send cookies with the WebSocket handshake.
   * Required for cookie-based authentication where JWT is stored
   * in HTTP-only cookies rather than client-side storage.
   * When true, connect() will not require getAuthToken() to return a token.
   */
  withCredentials?: boolean

  /**
   * Identifies which frontend app is connecting ('user', 'provider', 'superadmin').
   * Sent in the handshake auth so the server can select the correct cookie
   * when multiple app cookies are present in the same browser profile.
   */
  clientApp?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (...args: any[]) => void

export interface GlobalWebSocketService {
  connect(): void
  disconnect(): void
  on(event: string, handler: EventHandler): () => void
  emit(event: string, data: any): void
  isConnected(): boolean
  getSocket(): Socket | null
}

/**
 * Creates a global WebSocket service instance
 *
 * Follows the factory pattern used throughout the codebase
 * (createAuthStore, createMessagingStore, createFeatureFlags).
 */
export function createGlobalWebSocketService(
  config: GlobalWebSocketConfig
): GlobalWebSocketService {
  const {
    url,
    getAuthToken,
    onConnect,
    onDisconnect,
    onError,
    debug = false,
    withCredentials = false,
    clientApp,
  } = config

  let socket: Socket | null = null
  const eventHandlers = new Map<string, Set<EventHandler>>()
  let reconnectAttempts = 0

  // Buffer for events emitted before the socket is connected.
  // Flushed on 'connect'. Capped to avoid unbounded growth during long disconnects.
  const MAX_PENDING = 20
  const pendingEmits: Array<{ event: string; data: unknown }> = []

  const log = (...args: any[]) => {
    if (debug) {
      console.log('[GlobalWebSocket]', ...args)
    }
  }

  const logError = (...args: any[]) => {
    console.error('[GlobalWebSocket]', ...args)
  }

  return {
    connect() {
      if (socket?.connected) {
        log('Already connected, skipping')
        return
      }

      const token = getAuthToken()

      // For cookie-based auth (withCredentials), token may be null
      // because JWT is in HTTP-only cookies sent automatically
      if (!token && !withCredentials) {
        logError('No auth token available, cannot connect')
        return
      }

      log('Connecting to WebSocket server:', url)

      socket = io(url, {
        auth: {
          ...(token ? { token } : {}),
          ...(clientApp ? { clientApp } : {}),
        },
        withCredentials,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000, // Exponential back-off cap at 30s (was 5s)
        randomizationFactor: 0.5, // Jitter: prevents thundering-herd on mass reconnect
        reconnectionAttempts: Infinity, // Never permanently give up (was 5)
      })

      socket.on('connect', () => {
        log('✅ WebSocket connected')
        reconnectAttempts = 0
        onConnect?.()

        // Flush any events that were emitted before the socket was ready
        if (pendingEmits.length > 0) {
          log(`Flushing ${pendingEmits.length} pending emit(s)`)
          const toFlush = pendingEmits.splice(0)
          for (const pending of toFlush) {
            socket?.emit(pending.event, pending.data)
          }
        }

        // Emit local event
        eventHandlers.get('connection:established')?.forEach(h => h({}))
      })

      socket.on('disconnect', reason => {
        log('❌ WebSocket disconnected:', reason)
        onDisconnect?.(reason)

        // Emit local event
        eventHandlers.get('connection:lost')?.forEach(h => h({ reason }))
      })

      socket.on('connect_error', error => {
        logError('WebSocket connection error:', error)
        reconnectAttempts++
        onError?.(error)

        // Notify UI of reconnection attempt count — allows showing a banner
        // without permanently giving up (connection:failed no longer fires)
        eventHandlers
          .get('connection:reconnecting')
          ?.forEach(h => h({ attempt: reconnectAttempts, error }))
      })

      // Application-level heartbeat: auto-respond to server pings to refresh presence TTL
      socket.on(WsServerEvent.HeartbeatPing, () => {
        socket?.emit(WsClientEvent.HeartbeatPong, {})
      })

      // Auth lifecycle: token is about to expire — re-emit as local event so app can refresh
      socket.on(WsServerEvent.AuthTokenExpiring, (data: { expiresInMs: number }) => {
        log('⚠️ Auth token expiring, notifying app to refresh:', data)
        eventHandlers.get('connection:auth_expiring')?.forEach(h => h(data))
      })

      // Auth lifecycle: token has expired / session terminated by server
      socket.on(WsServerEvent.AuthExpired, () => {
        log('🔒 Auth expired, session terminated by server')
        eventHandlers.get('connection:auth_expired')?.forEach(h => h({}))
      })

      // Register all existing event handlers with the new socket
      eventHandlers.forEach((handlers, event) => {
        if (!event.startsWith('connection:')) {
          socket?.on(event, (data: any) => {
            handlers.forEach(h => h(data))
          })
        }
      })
    },

    disconnect() {
      log('Disconnecting WebSocket')
      socket?.disconnect()
      socket = null
    },

    on(event: string, handler: EventHandler) {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set())

        // Register with socket.io (if not a local event)
        if (!event.startsWith('connection:') && socket) {
          socket.on(event, (data: any) => {
            eventHandlers.get(event)?.forEach(h => h(data))
          })
        }
      }

      eventHandlers.get(event)?.add(handler)
      log('Registered event handler:', event)

      // Return unsubscribe function
      return () => {
        eventHandlers.get(event)?.delete(handler)
        log('Unregistered event handler:', event)
      }
    },

    emit(event: string, data: any) {
      if (!socket?.connected) {
        // Queue the event to be sent once the socket connects.
        // Drop the oldest entry if the buffer is full to prevent memory growth.
        if (pendingEmits.length >= MAX_PENDING) {
          const dropped = pendingEmits.shift()
          log('Pending emit buffer full, dropping oldest:', dropped?.event)
        }
        pendingEmits.push({ event, data })
        log('Queued pending emit (socket not connected):', event)
        return
      }

      log('Emitting event:', event, data)
      socket.emit(event, data)
    },

    isConnected() {
      return socket?.connected || false
    },

    getSocket() {
      return socket
    },
  }
}
