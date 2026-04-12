/**
 * Global WebSocket Service Instance for WC Booking
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
import { WsClientEvent } from '@world-schools/wc-types'
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
  clientApp: 'user',
  debug: config.app.version === 'dev',
  onConnect: () => console.log('[WC Booking] Global WebSocket connected'),
  onDisconnect: reason => console.log('[WC Booking] Global WebSocket disconnected:', reason),
  onError: error => console.error('[WC Booking] Global WebSocket error:', error),
})

// Silent token refresh: when the server warns us the token is about to expire,
// call the HTTP refresh endpoint and send the new token over the WebSocket.
// Works in both auth modes:
//   - Request mode: storedRefreshToken is available; pass it in the body.
//   - Cookie mode:  storedRefreshToken is null (token is in an HTTP-only cookie);
//     apiClient has withCredentials:true so the cookie is sent automatically,
//     and RefreshTokenDto.refreshToken is @IsOptional() so an empty body is valid.
//     The server returns the new accessToken in the response body so we can
//     send it via WsClientEvent.AuthToken without a disruptive reconnect.
globalWsService.on('connection:auth_expiring', async () => {
  try {
    const { refreshToken: storedRefreshToken } = apiClient.getTokens()
    const result = await apiClient.post<{ accessToken: string }>('user/auth/refresh', {
      ...(storedRefreshToken ? { refreshToken: storedRefreshToken } : {}),
    })
    const newToken = result.success ? result.data?.accessToken : undefined
    if (newToken) {
      globalWsService.emit(WsClientEvent.AuthToken, { token: newToken })
      console.log('[WC Booking] WebSocket session token refreshed silently')
    }
  } catch (err) {
    console.warn('[WC Booking] Failed to refresh WebSocket token:', err)
  }
})

// If session has expired (e.g. refresh token also expired), redirect to sign-in
globalWsService.on('connection:auth_expired', () => {
  console.warn('[WC Booking] WebSocket session expired, redirecting to sign-in')
  // Use window.location for a hard redirect to clear all app state
  if (typeof window !== 'undefined') {
    window.location.href = '/auth/signin'
  }
})
