import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import type { CampDetail, CampFilters, CampStats, CampSummary } from '../types/camps'
import { campsService } from '../services/camps.services'

interface CampsState {
  camps: CampSummary[]
  stats: CampStats | null
  detail: CampDetail | null
  isLoading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: CampFilters
}

interface CampsStore extends CampsState {
  fetchCamps: () => Promise<void>
  fetchStats: () => Promise<void>
  fetchDetail: (id: string) => Promise<void>
  clearDetail: () => void
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setFilters: (filters: Partial<CampFilters>) => void
  clearFilters: () => void
  clearError: () => void
}

const initialState: CampsState = {
  camps: [],
  stats: null,
  detail: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  filters: {},
}

export const useCampsStore = create<CampsStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      fetchCamps: async () => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        // Snapshot current state before the async call to avoid reading Immer draft proxies
        const currentState = get()
        const currentPage = currentState.pagination.page
        const currentLimit = currentState.pagination.limit
        const currentFilters = { ...currentState.filters }

        try {
          const response = await campsService.getCamps({
            page: currentPage,
            limit: currentLimit,
            ...currentFilters,
          })

          set(draft => {
            draft.camps = response.data ?? []
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
            draft.camps = []
            draft.pagination.total = 0
            draft.pagination.totalPages = 0
            draft.error = error.message || 'Failed to fetch camps'
            draft.isLoading = false
          })
        }
      },

      fetchStats: async () => {
        try {
          const stats = await campsService.getStats()
          set(draft => {
            draft.stats = stats
          })
        } catch {
          // Silently fail — stats are non-critical
        }
      },

      fetchDetail: async (id: string) => {
        set(draft => {
          draft.isLoading = true
          draft.error = null
        })

        try {
          const detail = await campsService.getDetail(id)
          set(draft => {
            draft.detail = detail
            draft.isLoading = false
          })
        } catch (error: any) {
          set(draft => {
            draft.error = error.message || 'Failed to fetch camp details'
            draft.isLoading = false
          })
        }
      },

      clearDetail: () => {
        set(draft => {
          draft.detail = null
          draft.error = null
        })
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

      setFilters: (filters: Partial<CampFilters>) => {
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
    { name: 'CampsStore' }
  )
)
