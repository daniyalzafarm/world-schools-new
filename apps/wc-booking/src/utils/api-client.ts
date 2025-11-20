/**
 * WC Booking API Client
 *
 * This file configures and exports the shared API client from @world-schools/wc-utils
 * with wc-booking specific settings.
 */

import { createApiClient } from '@world-schools/wc-utils'
import config from '@/config/config'

// Re-export types from wc-utils for backward compatibility
export type {
  ApiResponse,
  ApiErrorResponse,
  ApiResult,
  ApiClient,
  ApiClientConfig,
} from '@world-schools/wc-utils'

// Create configured API client instance
const apiClient = createApiClient({
  baseURL: config.app.apiUrl,
  usingRequest: config.auth.usingRequest,
  storageKeyPrefix: 'wc_user',
  refreshEndpoint: '/user/auth/refresh',
})

// Export individual methods for backward compatibility
export const { get, post, put, patch, del, setTokens, getTokens, clearTokens, hasValidTokens } =
  apiClient

// Export the full client instance as default
export default apiClient
