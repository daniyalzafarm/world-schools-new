import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { AuthState, LoginCredentials, User } from '@/types/auth'

interface PendingUser {
  email?: string
  password?: string
  name?: string
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: () => void
  clearError: () => void
  initialize: () => void
}

type AuthStore = AuthState &
  AuthActions & {
    pendingUser: PendingUser
  }

const SESSION_KEYS = {
  USER: 'wc_superadmin_user',
  AUTH_STATUS: 'wc_superadmin_auth',
  SESSION_EXPIRY: 'wc_superadmin_session_expiry',
}

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000

export const useAuthStore = create<AuthStore>()(
  immer((set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    pendingUser: {},

    initialize: () => {
      try {
        const authStatus = sessionStorage.getItem(SESSION_KEYS.AUTH_STATUS)
        const userStr = sessionStorage.getItem(SESSION_KEYS.USER)
        const expiryStr = sessionStorage.getItem(SESSION_KEYS.SESSION_EXPIRY)

        if (authStatus === 'true' && userStr && expiryStr) {
          const expiry = parseInt(expiryStr, 10)
          const now = Date.now()

          if (now < expiry) {
            const user = JSON.parse(userStr) as User
            set(draft => {
              draft.user = user
              draft.isAuthenticated = true
            })
          } else {
            get().logout()
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        get().logout()
      }
    },

    login: async (credentials: LoginCredentials) => {
      set(draft => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        await new Promise(resolve => setTimeout(resolve, 300))

        const rawEmail = credentials.email?.trim()
        const email = rawEmail && rawEmail.length > 0 ? rawEmail : `superadmin+${Date.now()}@worldcamps.dev`
        const password = credentials.password ?? ''

        const user: User = {
          id: 'user_' + Date.now(),
          email,
          firstName: email.split('@')[0] || 'superadmin',
          lastName: '',
          role: 'superadmin',
          orgId: 'wc_superadmin_org',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        const expiry = Date.now() + SESSION_TIMEOUT
        sessionStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user))
        sessionStorage.setItem(SESSION_KEYS.AUTH_STATUS, 'true')
        sessionStorage.setItem(SESSION_KEYS.SESSION_EXPIRY, expiry.toString())

        set(draft => {
          draft.user = user
          draft.isAuthenticated = true
          draft.isLoading = false
          draft.error = null
        })

        // Store the last credentials in memory for potential UX flows
        set(draft => {
          draft.pendingUser = { email, password }
        })

        return true
      } catch (error: any) {
        set(draft => {
          draft.isLoading = false
          draft.error = error.message || 'Login failed'
        })
        return false
      }
    },

    logout: () => {
      sessionStorage.removeItem(SESSION_KEYS.USER)
      sessionStorage.removeItem(SESSION_KEYS.AUTH_STATUS)
      sessionStorage.removeItem(SESSION_KEYS.SESSION_EXPIRY)

      set(draft => {
        draft.user = null
        draft.isAuthenticated = false
        draft.isLoading = false
        draft.error = null
        draft.pendingUser = {}
      })
    },

    clearError: () => {
      set(draft => {
        draft.error = null
      })
    },
  }))
)
