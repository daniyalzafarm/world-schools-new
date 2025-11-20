/**
 * Authentication Service for WC Booking
 *
 * This service extends the shared createAuthService factory from @world-schools/wc-utils
 * with user-specific methods (signup, email verification).
 */

import { createAuthService } from '@world-schools/wc-utils'
import apiClient from '@/utils/api-client'

// Create the auth service instance with user-specific configuration
const authService = createAuthService({
  apiClient,
  endpointPrefix: 'user/auth',
})

// Export the shared auth service methods
export const { login, refreshToken, getProfile, changePassword, logout } = authService

// User-specific auth methods

/**
 * Register a new parent user account
 */
export async function signup(data: {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}) {
  return apiClient.post('user/auth/register', data)
}

/**
 * Verify email with 6-digit code
 */
export async function verifyEmail(data: { email: string; code: string }) {
  return apiClient.post('user/auth/verify-email', data)
}

/**
 * Resend email verification code
 */
export async function resendVerificationCode(data: { email: string }) {
  return apiClient.post('user/auth/resend-verification-code', data)
}

/**
 * Request password reset email
 */
export async function forgotPassword(data: { email: string }) {
  return apiClient.post('user/auth/forgot-password', data)
}

/**
 * Reset password using token
 */
export async function resetPassword(data: { token: string; newPassword: string }) {
  return apiClient.post('user/auth/reset-password', data)
}

/**
 * Google Sign-In
 */
export async function googleSignIn(data: { token: string }) {
  return apiClient.post('user/auth/google-signin', data)
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
export const forgotPasswordApi = forgotPassword
export const resetPasswordApi = resetPassword
