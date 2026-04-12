/**
 * WebSocket module for World Schools Applications
 *
 * Provides global WebSocket service, React context, and hook.
 * Used by both wc-booking and wc-provider apps.
 */

// Global WebSocket service factory
export {
  createGlobalWebSocketService,
  type GlobalWebSocketConfig,
  type GlobalWebSocketService,
} from './create-websocket-service'

// React context and provider
export { WebSocketProvider, type WebSocketProviderProps } from './websocket-context'

// React hook
export { useWebSocket } from './use-websocket'

// In-app notification WebSocket hook
export { useWsNotifications } from './use-ws-notifications'
