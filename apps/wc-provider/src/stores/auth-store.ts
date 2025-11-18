/**
 * Authentication Store for WC Provider
 *
 * This store is configured using the shared createAuthStore factory
 * from @world-schools/wc-frontend-utils.
 */

import { createAuthStore } from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'
import * as authService from '@/services/auth.services'
import config from '@/config/config'

// Create the auth store instance with provider-specific configuration
const { useAuthStore } = createAuthStore({
  apiClient,
  authService,
  storageKeyPrefix: 'wc_provider',
  usingRequest: config.auth.usingRequest,
})

export { useAuthStore }
