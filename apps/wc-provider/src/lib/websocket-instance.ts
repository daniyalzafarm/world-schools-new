/**
 * Global WebSocket Service Instance for WC Provider
 *
 * This module creates the singleton global WebSocket service instance.
 * It is extracted into its own module to avoid circular dependencies:
 *
 * Before (circular):
 *   providers.tsx → messaging-provider.tsx → messaging-store.ts → providers.tsx
 *
 * After (fixed):
 *   providers.tsx → lib/websocket-instance.ts ← messaging-store.ts
 *
 * Both providers.tsx and messaging-store.ts import from this module,
 * breaking the circular dependency chain.
 */

import { createGlobalWebSocketService } from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'
import config from '@/config/config'

// Create global WebSocket service instance (singleton - created once at module level)
export const globalWsService = createGlobalWebSocketService({
  url: config.app.wsUrl.replace(/\/$/, ''),
  getAuthToken: () => {
    const tokens = apiClient.getTokens()
    return tokens.accessToken || null
  },
  // For cookie-based auth, send HTTP-only cookies with the WebSocket handshake
  withCredentials: !config.auth.usingRequest,
  debug: config.app.version === 'dev',
  onConnect: () => console.log('[WC Provider] Global WebSocket connected'),
  onDisconnect: reason => console.log('[WC Provider] Global WebSocket disconnected:', reason),
  onError: error => console.error('[WC Provider] Global WebSocket error:', error),
})
