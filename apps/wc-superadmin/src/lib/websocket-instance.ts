import { createGlobalWebSocketService } from '@world-schools/wc-frontend-utils'
import { WsClientEvent } from '@world-schools/wc-types'
import apiClient from '@/utils/api-client'
import config from '@/config/config'

export const globalWsService = createGlobalWebSocketService({
  url: config.app.wsUrl.replace(/\/$/, ''),
  getAuthToken: () => {
    const tokens = apiClient.getTokens()
    return tokens.accessToken || null
  },
  withCredentials: !config.auth.usingRequest,
  clientApp: 'superadmin',
  debug: config.app.version === 'dev',
  onConnect: () => console.log('[WC Superadmin] Global WebSocket connected'),
  onDisconnect: reason => console.log('[WC Superadmin] Global WebSocket disconnected:', reason),
  onError: error => console.error('[WC Superadmin] Global WebSocket error:', error),
})

// Silent token refresh: when the server warns us the token is about to expire,
// call the HTTP refresh endpoint and send the new token over the WebSocket.
globalWsService.on('connection:auth_expiring', async () => {
  try {
    const { refreshToken: storedRefreshToken } = apiClient.getTokens()
    const result = await apiClient.post<{ accessToken: string }>('superadmin/auth/refresh', {
      ...(storedRefreshToken ? { refreshToken: storedRefreshToken } : {}),
    })
    // The refresh endpoint returns the new access token in two ways:
    //   - response body `data.accessToken` (authUsingRequest mode)
    //   - the apiClient response interceptor writes it to in-memory storage (authUsingRequest mode)
    //   - httpOnly cookie (cookie-based / production mode — not JS-readable)
    // We read `data.accessToken` first; fall back to whatever the interceptor stored in memory.
    const newToken = result.success
      ? (result.data?.accessToken ?? apiClient.getTokens().accessToken)
      : undefined
    if (newToken) {
      globalWsService.emit(WsClientEvent.AuthToken, { token: newToken })
      console.log('[WC Superadmin] WebSocket session token refreshed silently')
    }
  } catch (err) {
    console.warn('[WC Superadmin] Failed to refresh WebSocket token:', err)
  }
})

// If session has expired (e.g. refresh token also expired), redirect to sign-in
globalWsService.on('connection:auth_expired', () => {
  console.warn('[WC Superadmin] WebSocket session expired, redirecting to sign-in')
  if (typeof window !== 'undefined') {
    window.location.href = '/auth/signin'
  }
})
