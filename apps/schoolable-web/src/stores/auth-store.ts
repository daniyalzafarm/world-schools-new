import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { AuthState, LoginCredentials, User } from '@/types/auth'

interface PendingUser {
  email?: string
  password?: string
  name?: string
  city?: string
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<boolean>
  signUp: (email: string, password: string) => Promise<boolean>
  register: (email?: string, password?: string, name?: string, city?: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
  initialize: () => void
  updatePendingUser: (fields: Partial<PendingUser>) => void
  completeOnboarding: (data: { name: string; location: string }) => Promise<boolean>
}

type AuthStore = AuthState &
  AuthActions & {
    pendingUser: PendingUser
  }

// Session storage keys
const SESSION_KEYS = {
  USER: 'schoolable_user',
  AUTH_STATUS: 'schoolable_auth',
  SESSION_EXPIRY: 'schoolable_session_expiry',
  PENDING_USER: 'schoolable_pending_user',
}

// Session timeout (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000

const useAuthStore = create<AuthStore>()(
  immer((set, get) => ({
    // Initial state
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    pendingUser: {},

    // Actions
    initialize: () => {
      try {
        const authStatus = sessionStorage.getItem(SESSION_KEYS.AUTH_STATUS)
        const userStr = sessionStorage.getItem(SESSION_KEYS.USER)
        const expiryStr = sessionStorage.getItem(SESSION_KEYS.SESSION_EXPIRY)
        const pendingUserStr = sessionStorage.getItem(SESSION_KEYS.PENDING_USER)

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
            // Session expired, clear storage
            get().logout()
          }
        }

        // Load pending user if exists
        if (pendingUserStr) {
          const pendingUser = JSON.parse(pendingUserStr) as PendingUser
          set(draft => {
            draft.pendingUser = pendingUser
          })
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        get().logout()
      }
    },

    updatePendingUser: (fields: Partial<PendingUser>) => {
      set(draft => {
        draft.pendingUser = { ...draft.pendingUser, ...fields }
      })

      // Save to session storage
      const updatedPendingUser = { ...get().pendingUser, ...fields }
      sessionStorage.setItem(SESSION_KEYS.PENDING_USER, JSON.stringify(updatedPendingUser))
    },

    login: async (credentials: LoginCredentials) => {
      set(draft => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Dummy authentication - accept any email/password combination
        if (credentials.email && credentials.password) {
          // Determine role based on email domain
          const isAdmin = credentials.email.endsWith('@schoolableproviders.com')

          const user: User = {
            id: 'user_' + Date.now(),
            email: credentials.email,
            firstName: credentials.email.split('@')[0],
            lastName: '',
            role: isAdmin ? 'admin' : 'student',
            orgId: 'org_default',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          // Store in session storage
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

          return true
        } else {
          throw new Error('Email and password are required')
        }
      } catch (error: any) {
        set(draft => {
          draft.isLoading = false
          draft.error = error.message || 'Login failed'
        })
        return false
      }
    },

    signUp: async (email: string, password: string) => {
      set(draft => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Store pending user data
        const pendingUser = { email, password }
        sessionStorage.setItem(SESSION_KEYS.PENDING_USER, JSON.stringify(pendingUser))

        set(draft => {
          draft.pendingUser = pendingUser
          draft.isLoading = false
          draft.error = null
        })

        return true
      } catch (error: any) {
        set(draft => {
          draft.isLoading = false
          draft.error = error.message || 'Sign up failed'
        })
        return false
      }
    },

    register: async (email?: string, password?: string, name?: string, _city?: string) => {
      set(draft => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        const pendingUser = get().pendingUser
        const finalEmail = email || pendingUser.email
        const finalPassword = password || pendingUser.password
        const finalName = name || pendingUser.name || 'User'

        if (finalEmail && finalPassword) {
          // Determine role based on email domain
          const isAdmin = finalEmail.endsWith('@schoolableproviders.com')

          const [firstName, ...lastNameParts] = finalName.split(' ')
          const lastName = lastNameParts.join(' ') || ''

          const user: User = {
            id: 'user_' + Date.now(),
            email: finalEmail,
            firstName,
            lastName,
            role: isAdmin ? 'admin' : 'student',
            orgId: 'org_default',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          // Store in session storage
          const expiry = Date.now() + SESSION_TIMEOUT
          sessionStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user))
          sessionStorage.setItem(SESSION_KEYS.AUTH_STATUS, 'true')
          sessionStorage.setItem(SESSION_KEYS.SESSION_EXPIRY, expiry.toString())

          // Clear pending user
          sessionStorage.removeItem(SESSION_KEYS.PENDING_USER)

          set(draft => {
            draft.user = user
            draft.isAuthenticated = true
            draft.isLoading = false
            draft.error = null
            draft.pendingUser = {}
          })

          return true
        } else {
          throw new Error('Email and password are required')
        }
      } catch (error: any) {
        set(draft => {
          draft.isLoading = false
          draft.error = error.message || 'Registration failed'
        })
        return false
      }
    },

    completeOnboarding: async (data: { name: string; location: string }) => {
      set(draft => {
        draft.isLoading = true
        draft.error = null
      })

      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500))

        const currentUser = get().user
        if (currentUser) {
          const [firstName, ...lastNameParts] = data.name.split(' ')
          const lastName = lastNameParts.join(' ') || ''

          const updatedUser: User = {
            ...currentUser,
            firstName,
            lastName,
            updatedAt: new Date().toISOString(),
          }

          // Update session storage
          sessionStorage.setItem(SESSION_KEYS.USER, JSON.stringify(updatedUser))

          set(draft => {
            draft.user = updatedUser
            draft.isLoading = false
          })

          return true
        } else {
          throw new Error('No user found')
        }
      } catch (error: any) {
        set(draft => {
          draft.isLoading = false
          draft.error = error.message || 'Onboarding failed'
        })
        return false
      }
    },

    logout: () => {
      // Clear session storage
      sessionStorage.removeItem(SESSION_KEYS.USER)
      sessionStorage.removeItem(SESSION_KEYS.AUTH_STATUS)
      sessionStorage.removeItem(SESSION_KEYS.SESSION_EXPIRY)
      sessionStorage.removeItem(SESSION_KEYS.PENDING_USER)

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

export { useAuthStore }
