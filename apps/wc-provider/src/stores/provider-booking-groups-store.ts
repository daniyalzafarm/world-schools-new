import { create } from 'zustand'
import type {
  ProviderBookingGroupsListMeta,
  ProviderBookingGroupsQuery,
  ProviderBookingGroupSummary,
  ProviderBookingTab,
} from '@world-schools/wc-types'
import { providerBookingGroupsService } from '@/services/provider-booking-groups.services'

export interface ProviderBookingGroupsFilters extends ProviderBookingGroupsQuery {
  tab: ProviderBookingTab
}

const defaultFilters: ProviderBookingGroupsFilters = {
  tab: 'requests',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
}

const emptyTabCounts: ProviderBookingGroupsListMeta['tabCounts'] = {
  requests: 0,
  upcoming: 0,
  atCamp: 0,
  past: 0,
  cancelled: 0,
}

interface ProviderBookingGroupsState {
  rows: ProviderBookingGroupSummary[]
  isLoading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: ProviderBookingGroupsFilters
  tabCounts: ProviderBookingGroupsListMeta['tabCounts']

  fetchList: () => Promise<boolean>
  setPage: (page: number) => void
  setFilters: (filters: Partial<ProviderBookingGroupsFilters>) => void
  clearFilters: () => void
  clearError: () => void
}

function errMsg(data: unknown): string {
  if (data && typeof data === 'object' && 'message' in data) {
    return String((data as { message?: string }).message ?? 'Request failed')
  }
  return 'Request failed'
}

export const useProviderBookingGroupsStore = create<ProviderBookingGroupsState>((set, get) => ({
  rows: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: { ...defaultFilters },
  tabCounts: { ...emptyTabCounts },

  fetchList: async () => {
    set({ isLoading: true, error: null })
    const { pagination, filters } = get()
    const query: ProviderBookingGroupsQuery = {
      tab: filters.tab,
      page: pagination.page,
      limit: pagination.limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
    }

    const response = await providerBookingGroupsService.list(query)

    if (response.success && response.data) {
      const meta = response.meta as ProviderBookingGroupsListMeta | undefined
      set({
        rows: Array.isArray(response.data) ? response.data : [],
        isLoading: false,
        pagination: meta
          ? {
              page: meta.page,
              limit: meta.limit,
              total: meta.total,
              totalPages: meta.totalPages,
            }
          : get().pagination,
        tabCounts: meta?.tabCounts ?? get().tabCounts,
      })
      return true
    }

    set({
      rows: [],
      isLoading: false,
      error: errMsg('data' in response ? response.data : null),
    })
    return false
  },

  setPage: (page: number) => {
    set(state => ({
      pagination: { ...state.pagination, page },
    }))
  },

  setFilters: filters => {
    set(state => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 },
    }))
  },

  clearFilters: () => {
    set(state => ({
      filters: {
        ...state.filters,
        search: undefined,
        status: undefined,
        sortBy: defaultFilters.sortBy,
        sortOrder: defaultFilters.sortOrder,
      },
      pagination: { ...state.pagination, page: 1 },
    }))
  },

  clearError: () => set({ error: null }),
}))
