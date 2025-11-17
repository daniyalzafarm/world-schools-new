/**
 * Authentication Service Factory for World Camps Applications
 *
 * This factory creates a configured authentication service layer that handles
 * all authentication-related API calls. It provides a clean separation between
 * the API layer and state management.
 *
 * @example
 * ```typescript
 * import { createApiClient, createAuthService } from '@world-schools/wc-utils'
 *
 * const apiClient = createApiClient({
 *   baseURL: 'http://localhost:3000/',
 *   usingRequest: false,
 *   storageKeyPrefix: 'wc_superadmin',
 *   refreshEndpoint: '/superadmin/auth/refresh'
 * })
 *
 * const authService = createAuthService({
 *   apiClient,
 *   endpointPrefix: 'superadmin/auth'
 * })
 *
 * // Use the service
 * const response = await authService.login({ email, password })
 * ```
 */

import type { ApiClient } from './api-client.types'
import type { ChangePasswordData, LoginCredentials, User } from '@world-schools/wc-types'

/**
 * Configuration options for creating an auth service instance
 */
export interface AuthServiceConfig {
  /**
   * Configured API client instance
   */
  apiClient: ApiClient

  /**
   * Prefix for auth endpoints (e.g., 'superadmin/auth', 'provider/auth', 'auth')
   * @example 'superadmin/auth' -> 'superadmin/auth/login'
   */
  endpointPrefix: string
}

/**
 * Auth service instance returned by createAuthService factory
 */
export interface AuthService {
  login: (credentials: LoginCredentials) => Promise<any>
  refreshToken: (refreshToken: string) => Promise<any>
  getProfile: () => Promise<any>
  changePassword: (data: ChangePasswordData) => Promise<any>
  logout: () => Promise<any>
}

/**
 * Creates a configured authentication service instance
 *
 * @param config - Configuration options for the auth service
 * @returns Configured auth service with API methods
 */
export function createAuthService(config: AuthServiceConfig): AuthService {
  const { apiClient, endpointPrefix } = config

  /**
   * Login API call
   * @param credentials - User login credentials (email and password)
   * @returns API response with user data and tokens in headers
   */
  const login = async (credentials: LoginCredentials) => {
    return await apiClient.post<{ user: User }>(
      `${endpointPrefix}/login`,
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
  const refreshToken = async (refreshToken: string) => {
    return await apiClient.post<{ user: User; expiresIn: string }>(
      `${endpointPrefix}/refresh`,
      { refreshToken },
      undefined,
      true // Attach response headers
    )
  }

  /**
   * Get user profile API call
   * @returns API response with user profile data
   */
  const getProfile = async () => {
    return await apiClient.get<User>(`${endpointPrefix}/profile`)
  }

  /**
   * Change password API call
   * @param data - Current password and new password
   * @returns API response with success message
   */
  const changePassword = async (data: ChangePasswordData) => {
    return await apiClient.patch<{ message?: string }>(`${endpointPrefix}/change-password`, data)
  }

  /**
   * Logout API call
   * @returns API response confirming logout
   */
  const logout = async () => {
    return await apiClient.post(`${endpointPrefix}/logout`, {})
  }

  return {
    login,
    refreshToken,
    getProfile,
    changePassword,
    logout,
  }
}

