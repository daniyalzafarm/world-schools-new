/**
 * Authentication Service Layer
 *
 * This service handles all authentication-related API calls.
 * It provides a clean separation between the API layer and state management.
 *
 * Following the service layer pattern from sales-pipeline-dashboard.
 */

import * as apiClient from '@/utils/api-client'
import type { ChangePasswordData, LoginCredentials, User } from '@/types/auth'

/**
 * Login API call
 * @param credentials - User login credentials (email and password)
 * @returns API response with user data and tokens in headers
 */
export const loginApi = async (credentials: LoginCredentials) => {
  return await apiClient.post<{ user: User }>(
    'superadmin/auth/login',
    credentials,
    undefined,
    true // Attach response headers to extract tokens
  )
}

/**
 * Refresh token API call
 * @param refreshToken - The refresh token to use for getting new access token
 * @returns API response with new tokens in headers
 */
export const refreshTokenApi = async (refreshToken: string) => {
  return await apiClient.post<{ user: User; expiresIn: string }>(
    'superadmin/auth/refresh',
    { refreshToken },
    undefined,
    true // Attach response headers
  )
}

/**
 * Get user profile API call
 * @returns API response with user profile data
 */
export const getProfileApi = async () => {
  return await apiClient.get<User>('superadmin/auth/profile')
}

/**
 * Change password API call
 * @param data - Current password and new password
 * @returns API response with success message
 */
export const changePasswordApi = async (data: ChangePasswordData) => {
  return await apiClient.patch<{ message?: string }>('superadmin/auth/change-password', data)
}

/**
 * Logout API call
 * @returns API response confirming logout
 */
export const logoutApi = async () => {
  return await apiClient.post('superadmin/auth/logout', {})
}

