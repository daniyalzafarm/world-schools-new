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
  } = config

  let socket: Socket | null = null
  const eventHandlers = new Map<string, Set<EventHandler>>()
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5

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
        auth: token ? { token } : {},
        withCredentials,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts,
      })

      socket.on('connect', () => {
        log('✅ WebSocket connected')
        reconnectAttempts = 0
        onConnect?.()

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

        if (reconnectAttempts >= maxReconnectAttempts) {
          eventHandlers.get('connection:failed')?.forEach(h => h({ error }))
        }
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
        logError('Cannot emit event, WebSocket not connected:', event)
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
