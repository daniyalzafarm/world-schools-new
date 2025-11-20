/**
 * Authentication Store for WC Booking
 *
 * This store is configured using the shared createAuthStore factory
 * from @world-schools/wc-frontend-utils.
 */

import { createAuthStore } from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'
import * as authService from '@/services/auth.services'
import config from '@/config/config'

// Create the auth store instance with booking-specific configuration
const { useAuthStore } = createAuthStore({
  apiClient,
  authService,
  storageKeyPrefix: 'wc_user',
  usingRequest: config.auth.usingRequest,
})

export { useAuthStore }
