import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import type { ParentFilters, ParentStats, ParentSummary } from '../types/parents'
import { parentsService } from '../services/parents.services'

interface ParentsState {
  parents: ParentSummary[]
  stats: ParentStats | null
  isLoading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: ParentFilters
}

interface ParentsStore extends ParentsState {
  fetchParents: () => Promise<void>
  fetchStats: () => Promise<void>
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setFilters: (filters: Partial<ParentFilters>) => void
  clearFilters: () => void
  clearError: () => void
}

const initialState: ParentsState = {
  parents: [],
  stats: null,
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

export const useParentsStore = create<ParentsStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      fetchParents: async () => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        const currentState = get()
        const currentPage = currentState.pagination.page
        const currentLimit = currentState.pagination.limit
        const currentFilters = { ...currentState.filters }

        try {
          const response = await parentsService.getParents({
            page: currentPage,
            limit: currentLimit,
            ...currentFilters,
          })

          set(draft => {
            draft.parents = response.data ?? []
            draft.pagination = {
              page: response.page,
              limit: response.limit,
              total: response.total,
              totalPages: response.totalPages,
            }
            draft.isLoading = false
          })
        } catch (error: any) {
          set(draft => {
            draft.parents = []
            draft.pagination.total = 0
            draft.pagination.totalPages = 0
            draft.error = error.message || 'Failed to fetch parents'
            draft.isLoading = false
          })
        }
      },

      fetchStats: async () => {
        try {
          const stats = await parentsService.getStats()
          set(draft => {
            draft.stats = stats
          })
        } catch {
          // Silently fail — stats are non-critical
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
          draft.pagination.page = 1
        })
      },

      setFilters: (filters: Partial<ParentFilters>) => {
        set(draft => {
          draft.filters = { ...draft.filters, ...filters }
          draft.pagination.page = 1
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
    })),
    { name: 'ParentsStore' }
  )
)
