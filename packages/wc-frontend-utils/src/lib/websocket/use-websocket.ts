/**
 * useWebSocket Hook for World Schools Applications
 *
 * React hook for accessing global WebSocket connection state.
 * Must be used within a WebSocketProvider.
 *
 * @example
 * ```typescript
 * import { useWebSocket } from '@world-schools/wc-frontend-utils'
 *
 * function MyComponent() {
 *   const { wsService, isConnected } = useWebSocket()
 *
 *   if (!isConnected) return <div>Connecting...</div>
 *
 *   return <div>Connected!</div>
 * }
 * ```
 */

'use client'

import { useContext } from 'react'
import { WebSocketContext, type WebSocketContextValue } from './websocket-context'

export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider')
  }
  return context
}
