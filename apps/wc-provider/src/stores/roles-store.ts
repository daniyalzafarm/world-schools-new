/**
 * Roles Store for WC Provider
 *
 * Zustand store for managing roles state
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import type { CreateRoleData, RolesState, RolesStore, UpdateRoleData } from '@/types/roles'
import * as rolesService from '@/services/roles.services'

// Initial state
const initialState: RolesState = {
  roles: [],
  currentRole: null,
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

export const useRolesStore = create<RolesStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      fetchRoles: async () => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        // Get current state values (not draft proxies)
        const currentState = get()
        const currentPage = currentState.pagination.page
        const currentLimit = currentState.pagination.limit
        const currentFilters = { ...currentState.filters }

        const response = await rolesService.getRoles({
          page: currentPage,
          limit: currentLimit,
          ...currentFilters,
        })

        if (response.success && response.data) {
          const meta = response.meta as
            | { page: number; limit: number; total: number; totalPages: number }
            | undefined

          set(draft => {
            draft.roles = response.data
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
              : 'Failed to fetch roles'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      getRoleById: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await rolesService.getRole(id)

        if (response.success && response.data) {
          set(draft => {
            draft.currentRole = response.data
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
              : 'Failed to fetch role'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      createRole: async (roleData: CreateRoleData) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await rolesService.createRole(roleData)

        if (response.success && response.data) {
          set(draft => {
            draft.roles.unshift(response.data)
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
              : 'Failed to create role'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      updateRole: async (id: string, roleData: UpdateRoleData) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await rolesService.updateRole(id, roleData)

        if (response.success && response.data) {
          set(draft => {
            const index = draft.roles.findIndex(r => r.id === id)
            if (index !== -1) {
              draft.roles[index] = response.data
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
              : 'Failed to update role'

          set(draft => {
            draft.error = errorMessage
            draft.isLoading = false
          })
          return false
        }
      },

      deleteRole: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const response = await rolesService.deleteRole(id)

        if (response.success) {
          set(draft => {
            draft.roles = draft.roles.filter(r => r.id !== id)
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
              : 'Failed to delete role'

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

      setCurrentRole: role => {
        set(draft => {
          draft.currentRole = role
        })
      },
    })),
    { name: 'RolesStore' }
  )
)
