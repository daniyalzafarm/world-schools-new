/**
 * Schoolable Web API Client
 *
 * This file configures and exports the shared API client from @world-schools/schoolable-utils
 * with schoolable-web specific settings.
 */

import { createApiClient } from '@world-schools/schoolable-utils'
import config from '@/config/config'

// Re-export types from schoolable-utils for backward compatibility
export type {
  ApiResponse,
  ApiErrorResponse,
  ApiResult,
  ApiClient,
  ApiClientConfig,
} from '@world-schools/schoolable-utils'

// Create configured API client instance
const apiClient = createApiClient({
  baseURL: config.app.apiUrl,
  usingRequest: config.auth.usingRequest,
  storageKeyPrefix: 'schoolable',
  refreshEndpoint: '/auth/refresh',
})

// Export individual methods for backward compatibility
export const {
  get,
  post,
  put,
  patch,
  del,
  postFile,
  postFormData,
  setTokens,
  getTokens,
  clearTokens,
  hasValidTokens,
} = apiClient

// Export the full client instance as default
export default apiClient
