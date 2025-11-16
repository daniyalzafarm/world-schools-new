import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { AuthState, ChangePasswordData, LoginCredentials, User } from '@/types/auth'
import * as apiClient from '@/utils/api-client'
import * as authService from '@/services/auth.services'
import config from '@/config/config'

interface PendingUser {
  email?: string
  password?: string
  name?: string
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: () => Promise<void>
  refreshToken: () => Promise<boolean>
  getProfile: () => Promise<void>
  changePassword: (data: ChangePasswordData) => Promise<boolean>
  clearError: () => void
  initialize: () => Promise<void>
}

type AuthStore = AuthState &
  AuthActions & {
    pendingUser: PendingUser
  }

const SESSION_KEYS = {
  USER: 'wc_superadmin_user',
  AUTH_STATUS: 'wc_superadmin_auth',
}

export const useAuthStore = create<AuthStore>()(
  immer((set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    isInitialized: false,
    pendingUser: {},

    initialize: async () => {
      const state = get()
      if (state.isInitialized || state.isLoading) {
        return
      }

      set(draft => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        // If using request-based auth, check if we have stored tokens
        if (config.auth.usingRequest) {
          const hasTokens = apiClient.hasValidTokens()

          if (!hasTokens) {
            // No tokens found, user is not authenticated
            set(draft => {
              draft.user = null
              draft.isAuthenticated = false
              draft.isLoading = false
              draft.isInitialized = true
            })
            return
          }
        }

        // Try to get user profile to check if user is authenticated
        // For cookie-based auth: cookies are sent automatically
        // For request-based auth: tokens are added to headers by interceptor
        await get().getProfile()

        set(draft => {
          draft.isLoading = false
          draft.isInitialized = true
        })
      } catch (error: any) {
        // If it's a 401 error, clear tokens if using request auth and mark as not authenticated
        const is401 = error?.response?.status === 401
        if (config.auth.usingRequest && is401) {
          apiClient.clearTokens()
        }

        // Don't set error in auth store during initialization
        // Initialization errors are expected when user is not authenticated
        set(draft => {
          draft.user = null
          draft.isAuthenticated = false
          draft.isLoading = false
          draft.isInitialized = true
          draft.error = null
        })
      }
    },

    login: async (credentials: LoginCredentials) => {
      set(draft => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        // Use auth service for API call
        const response = await authService.loginApi(credentials)

        if (!response.success) {
          const errorMessage: string =
            'data' in response && 'message' in response.data
              ? response.data.message || 'Login failed'
              : 'Login failed'

          // Set error in auth store and clear loading state
          set(draft => {
            draft.user = null
            draft.isAuthenticated = false
            draft.isLoading = false
            draft.error = errorMessage
          })

          return false
        }

        const user = response.data.user

        // Handle tokens based on auth mode
        if (config.auth.usingRequest && response.headers) {
          // Extract tokens from response headers for request-based auth
          const accessToken = response.headers['x-access-token']
          const refreshToken = response.headers['x-refresh-token']
          if (accessToken) {
            apiClient.setTokens(accessToken, refreshToken || '')
          }
        }
        // When not using request headers, tokens are set as HTTP-only cookies by backend

        // Store user data from login response
        set(draft => {
          draft.user = user
        })

        // Setting it separately so that the user is not null when redirecting on isAuthenticated true
        set(draft => {
          draft.isAuthenticated = true
          draft.isLoading = false
          draft.error = null
        })

        // Store the last credentials in memory for potential UX flows
        set(draft => {
          draft.pendingUser = { email: credentials.email, password: credentials.password }
        })

        return true
      } catch (error: any) {
        set(draft => {
          draft.user = null
          draft.isAuthenticated = false
          draft.isLoading = false
          draft.error = error.message || 'Login failed'
        })
        return false
      }
    },

    logout: async () => {
      set(draft => {
        draft.isLoading = true
      })

      try {
        // Use auth service for API call to clear server-side session/cookies
        await authService.logoutApi()
      } catch (error) {
        console.error('Logout API error:', error)
        // Continue with logout even if API call fails
      }

      // Clear tokens based on auth mode
      if (config.auth.usingRequest) {
        apiClient.clearTokens()
      }

      // Clear session storage
      sessionStorage.removeItem(SESSION_KEYS.USER)
      sessionStorage.removeItem(SESSION_KEYS.AUTH_STATUS)

      set(draft => {
        draft.user = null
        draft.isAuthenticated = false
        draft.isLoading = false
        draft.error = null
        draft.pendingUser = {}
        draft.isInitialized = false
      })
    },

    refreshToken: async () => {
      try {
        const { refreshToken } = apiClient.getTokens()
        if (!refreshToken) {
          return false
        }

        // Use auth service for API call
        const response = await authService.refreshTokenApi(refreshToken)

        if (!response.success) {
          return false
        }

        const user = response.data.user

        // Extract new tokens from headers if using request-based auth
        if (response.headers) {
          const accessToken = response.headers['x-access-token']
          const newRefreshToken = response.headers['x-refresh-token']
          if (accessToken) {
            apiClient.setTokens(accessToken, newRefreshToken || refreshToken)
          }
        }

        // Update user in session
        sessionStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user))

        set(draft => {
          draft.user = user
          draft.isAuthenticated = true
        })

        return true
      } catch (error) {
        console.error('Error refreshing token:', error)
        return false
      }
    },

    getProfile: async () => {
      try {
        // Use auth service for API call
        const response = await authService.getProfileApi()

        if (!response.success) {
          const errorMessage =
            'data' in response && 'message' in response.data
              ? response.data.message
              : 'Failed to get profile'
          return console.error(errorMessage)
        }

        const user = response.data

        // Update user in session
        sessionStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user))
        sessionStorage.setItem(SESSION_KEYS.AUTH_STATUS, 'true')

        set(draft => {
          draft.user = user
          draft.isAuthenticated = true
        })
      } catch (error: any) {
        console.error('Error getting profile:', error)
      }
    },

    changePassword: async (data: ChangePasswordData) => {
      try {
        // Use auth service for API call
        const response = await authService.changePasswordApi(data)

        if (!response.success) {
          const errorMessage: string =
            'data' in response && response.data && 'message' in response.data
              ? response.data.message || 'Failed to change password'
              : 'Failed to change password'

          // Set error in auth store so it can be displayed in the UI
          set(draft => {
            draft.error = errorMessage
          })

          return false
        }

        // Clear any previous errors on success
        set(draft => {
          draft.error = null
        })

        return true
      } catch (error: any) {
        set(draft => {
          draft.error = error.message || 'Failed to change password'
        })
        return false
      }
    },

    clearError: () => {
      set(draft => {
        draft.error = null
      })
    },
  }))
)
