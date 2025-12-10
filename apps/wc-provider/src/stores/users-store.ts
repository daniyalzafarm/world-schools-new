/**
 * Users Store for WC Provider
 *
 * Zustand store for managing users state
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import type { CreateUserData, UpdateUserData, UsersState, UsersStore } from '@/types/users'
import * as usersService from '@/services/users.services'

// Initial state
const initialState: UsersState = {
  users: [],
  currentUser: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {},
}

export const useUsersStore = create<UsersStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      fetchUsers: async () => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        // Get current state values (not draft proxies)
        const currentState = get()
        const currentPage = currentState.pagination.page
        const currentLimit = currentState.pagination.limit
        const currentFilters = { ...currentState.filters }

        const response = await usersService.getUsers({
          page: currentPage,
          limit: currentLimit,
          ...currentFilters,
        })

        if (response.success && response.data) {
          const meta = response.meta as
            | { page: number; limit: number; total: number; totalPages: number }
            | undefined

          set(draft => {
            draft.users = response.data as typeof draft.users
            if (meta) {
              draft.pagination = {
                page: meta.page,
                limit: meta.limit,
                total: meta.total,
                totalPages: meta.totalPages,
              }
            }
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to fetch users'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      getUserById: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await usersService.getUser(id)

        if (response.success && response.data) {
          set(draft => {
            draft.currentUser = response.data as typeof draft.currentUser
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to fetch user'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      createUser: async (userData: CreateUserData) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await usersService.createUser(userData)

        if (response.success && response.data) {
          set(draft => {
            draft.users.unshift(response.data as (typeof draft.users)[number])
            draft.pagination.total += 1
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to create user'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      updateUser: async (id: string, userData: UpdateUserData) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await usersService.updateUser(id, userData)

        if (response.success && response.data) {
          set(draft => {
            const index = draft.users.findIndex(u => u.id === id)
            if (index !== -1) {
              draft.users[index] = response.data as (typeof draft.users)[number]
            }
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to update user'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      deleteUser: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await usersService.deleteUser(id)

        if (response.success) {
          set(draft => {
            draft.users = draft.users.filter(u => u.id !== id)
            draft.pagination.total -= 1
            draft.isLoading = false
          })
          return true
        } else {
          const errorMessage =
            'data' in response &&
            typeof response.data === 'object' &&
            response.data &&
            'message' in response.data
              ? String(response.data.message)
              : 'Failed to delete user'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      setPage: (page: number) => {
        set(draft => {
          draft.pagination.page = page
        })
      },

      setLimit: (limit: number) => {
        set(draft => {
          draft.pagination.limit = limit
          draft.pagination.page = 1 // Reset to first page when changing limit
        })
      },

      setFilters: filters => {
        set(draft => {
          draft.filters = { ...draft.filters, ...filters }
          draft.pagination.page = 1 // Reset to first page when filtering
        })
      },

      clearFilters: () => {
        set(draft => {
          draft.filters = {}
          draft.pagination.page = 1
        })
      },

      clearError: () => {
        set(draft => {
          draft.error = null
        })
      },

      setCurrentUser: user => {
        set(draft => {
          draft.currentUser = user
        })
      },
    })),
    { name: 'UsersStore' }
  )
)
