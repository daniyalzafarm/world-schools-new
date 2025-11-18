/**
 * Authentication Service for WC Superadmin
 *
 * This service is configured using the shared createAuthService factory
 * from @world-schools/wc-utils.
 */

import { createAuthService } from '@world-schools/wc-utils'
import apiClient from '@/utils/api-client'

// Create the auth service instance with superadmin-specific configuration
const authService = createAuthService({
  apiClient,
  endpointPrefix: 'superadmin/auth',
})

// Export the auth service methods
export const { login, refreshToken, getProfile, changePassword, logout } = authService

/**
 * Request password reset email
 */
export async function forgotPassword(data: { email: string }) {
  return apiClient.post('superadmin/auth/forgot-password', data)
}

/**
 * Reset password using token
 */
export async function resetPassword(data: { token: string; newPassword: string }) {
  return apiClient.post('superadmin/auth/reset-password', data)
}

// Export legacy method names for backward compatibility
export const loginApi = login
export const refreshTokenApi = refreshToken
export const getProfileApi = getProfile
export const changePasswordApi = changePassword
export const logoutApi = logout
export const forgotPasswordApi = forgotPassword
export const resetPasswordApi = resetPassword
