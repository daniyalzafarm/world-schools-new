/**
 * WebSocket Context for World Schools Applications
 *
 * Provides global WebSocket connection state to React components.
 * Used by both wc-booking and wc-provider apps.
 */

'use client'

import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { GlobalWebSocketService } from './create-websocket-service'

export interface WebSocketContextValue {
  wsService: GlobalWebSocketService | null
  isConnected: boolean
}

export const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export interface WebSocketProviderProps {
  children: ReactNode
  wsService: GlobalWebSocketService
  userId?: string
  /**
   * Whether the user is authenticated.
   * Used as the connection signal instead of a raw token, because:
   * - Cookie-based auth stores JWT in HTTP-only cookies (not accessible client-side)
   * - The globalWsService handles actual auth (token or cookies) via its connect() method
   */
  isAuthenticated?: boolean
}

export function WebSocketProvider({
  children,
  wsService,
  userId,
  isAuthenticated,
}: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!userId || !isAuthenticated) {
      console.log('[WebSocketProvider] User not authenticated, skipping connection')
      return
    }

    console.log('[WebSocketProvider] Connecting WebSocket for user:', userId)
    wsService.connect()

    const unsubConnect = wsService.on('connection:established', () => {
      console.log('[WebSocketProvider] Connection established')
      setIsConnected(true)
    })

    const unsubDisconnect = wsService.on('connection:lost', () => {
      console.log('[WebSocketProvider] Connection lost')
      setIsConnected(false)
    })

    return () => {
      console.log('[WebSocketProvider] Cleaning up WebSocket listeners')
      unsubConnect()
      unsubDisconnect()
    }
  }, [wsService, userId, isAuthenticated])

  return (
    <WebSocketContext.Provider value={{ wsService, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  )
}
