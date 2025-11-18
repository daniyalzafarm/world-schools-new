/**
 * Authentication Service for WC Provider
 *
 * This service extends the shared createAuthService factory from @world-schools/wc-utils
 * with provider-specific methods (signup, email verification).
 */

import { createAuthService } from '@world-schools/wc-utils'
import apiClient from '@/utils/api-client'

// Create the auth service instance with provider-specific configuration
const authService = createAuthService({
  apiClient,
  endpointPrefix: 'provider/auth',
})

// Export the shared auth service methods
export const { login, refreshToken, getProfile, changePassword, logout } = authService

// Provider-specific auth methods

/**
 * Register a new provider account
 */
export async function signup(data: {
  email: string
  password: string
  firstName: string
  lastName: string
  providerName: string
  providerPhone?: string
  providerEmail?: string
  providerAddress?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  website?: string
}) {
  return apiClient.post('provider/auth/register', data)
}

/**
 * Verify email with 6-digit code
 */
export async function verifyEmail(data: { email: string; code: string }) {
  return apiClient.post('provider/auth/verify-email', data)
}

/**
 * Resend email verification code
 */
export async function resendVerificationCode(data: { email: string }) {
  return apiClient.post('provider/auth/resend-verification-code', data)
}

// Export legacy method names for backward compatibility
export const loginApi = login
export const refreshTokenApi = refreshToken
export const getProfileApi = getProfile
export const changePasswordApi = changePassword
export const logoutApi = logout
export const signupApi = signup
export const verifyEmailApi = verifyEmail
export const resendVerificationCodeApi = resendVerificationCode
