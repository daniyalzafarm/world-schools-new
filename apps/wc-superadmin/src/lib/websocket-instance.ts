import { createGlobalWebSocketService } from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'
import config from '@/config/config'

export const globalWsService = createGlobalWebSocketService({
  url: config.app.wsUrl.replace(/\/$/, ''),
  getAuthToken: () => {
    const tokens = apiClient.getTokens()
    return tokens.accessToken || null
  },
  withCredentials: !config.auth.usingRequest,
  debug: config.app.version === 'dev',
  onConnect: () => console.log('[WC Superadmin] Global WebSocket connected'),
  onDisconnect: reason => console.log('[WC Superadmin] Global WebSocket disconnected:', reason),
  onError: error => console.error('[WC Superadmin] Global WebSocket error:', error),
})
