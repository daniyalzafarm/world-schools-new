import { create } from 'zustand'
import { addToast } from '@heroui/react'
import type {
  AddOn,
  AddOnsPaginationMeta,
  CreateAddOnDto,
  QueryAddOnsDto,
  UpdateAddOnDto,
} from '@/types/add-ons'
import * as addOnsService from '@/services/add-ons.service'

interface AddOnsState {
  addOns: AddOn[]
  selectedAddOn: AddOn | null
  isLoading: boolean
  error: string | null
  filters: QueryAddOnsDto
  pagination: AddOnsPaginationMeta

  // Actions
  fetchAddOns: () => Promise<void>
  fetchAddOn: (id: string) => Promise<void>
  createAddOn: (data: CreateAddOnDto) => Promise<AddOn | undefined>
  updateAddOn: (id: string, data: UpdateAddOnDto) => Promise<AddOn | undefined>
  deleteAddOn: (id: string) => Promise<void>
  updateSortOrder: (updates: { id: string; sortOrder: number }[]) => Promise<void>
  setSelectedAddOn: (addOn: AddOn | null) => void
  setFilters: (filters: Partial<QueryAddOnsDto>) => void
  clearFilters: () => void
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  clearError: () => void
}

const DEFAULT_LIMIT = 10

export const useAddOnsStore = create<AddOnsState>((set, get) => ({
  addOns: [],
  selectedAddOn: null,
  isLoading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
    totalPages: 0,
  },

  fetchAddOns: async () => {
    set({ isLoading: true, error: null })
    const { filters, pagination } = get()
    const response = await addOnsService.getAddOns({
      ...filters,
      page: pagination.page,
      limit: pagination.limit,
    })
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const meta = response.meta as AddOnsPaginationMeta | undefined
    set({
      addOns: response.data.addOns,
      isLoading: false,
      pagination: meta
        ? {
            page: meta.page,
            limit: meta.limit,
            total: meta.total,
            totalPages: meta.totalPages,
          }
        : get().pagination,
    })
  },

  fetchAddOn: async (id: string) => {
    set({ isLoading: true, error: null })
    const response = await addOnsService.getAddOn(id)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    set({ selectedAddOn: response.data.addOn, isLoading: false })
  },

  createAddOn: async (data: CreateAddOnDto) => {
    set({ isLoading: true, error: null })
    const response = await addOnsService.createAddOn(data)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const newAddOn = response.data.addOn
    set(state => ({
      addOns: [...state.addOns, newAddOn],
      isLoading: false,
      pagination: { ...state.pagination, total: state.pagination.total + 1 },
    }))
    return newAddOn
  },

  updateAddOn: async (id: string, data: UpdateAddOnDto) => {
    set({ isLoading: true, error: null })
    const response = await addOnsService.updateAddOn(id, data)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const updatedAddOn = response.data.addOn
    set(state => ({
      addOns: state.addOns.map(a => (a.id === id ? updatedAddOn : a)),
      selectedAddOn: state.selectedAddOn?.id === id ? updatedAddOn : state.selectedAddOn,
      isLoading: false,
    }))
    return updatedAddOn
  },

  deleteAddOn: async (id: string) => {
    set({ isLoading: true, error: null })
    const response = await addOnsService.deleteAddOn(id)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    set(state => ({
      addOns: state.addOns.filter(a => a.id !== id),
      selectedAddOn: state.selectedAddOn?.id === id ? null : state.selectedAddOn,
      isLoading: false,
      pagination: {
        ...state.pagination,
        total: Math.max(0, state.pagination.total - 1),
      },
    }))
  },

  updateSortOrder: async (updates: { id: string; sortOrder: number }[]) => {
    await addOnsService.updateAddOnsSortOrder(updates)
    set(state => ({
      addOns: state.addOns
        .map(addOn => {
          const update = updates.find(u => u.id === addOn.id)
          return update ? { ...addOn, sortOrder: update.sortOrder } : addOn
        })
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
  },

  setSelectedAddOn: (addOn: AddOn | null) => {
    set({ selectedAddOn: addOn })
  },

  setFilters: (filters: Partial<QueryAddOnsDto>) => {
    const current = get().filters
    const next: QueryAddOnsDto = { ...current, ...filters }
    // Drop keys whose value is undefined/empty so the URL stays clean
    ;(Object.keys(next) as Array<keyof QueryAddOnsDto>).forEach(key => {
      if (next[key] === undefined || next[key] === '') delete next[key]
    })
    // Preserve reference if nothing actually changed — keeps useEffects with
    // `filters` deps from firing (and refetching) on no-op updates.
    const currentKeys = Object.keys(current) as Array<keyof QueryAddOnsDto>
    const nextKeys = Object.keys(next) as Array<keyof QueryAddOnsDto>
    const unchanged =
      currentKeys.length === nextKeys.length && nextKeys.every(k => current[k] === next[k])
    if (unchanged) return
    // Reset to first page when filters change so the user always sees the new
    // result set from the start, matching the roles/users behavior.
    set(state => ({
      filters: next,
      pagination: { ...state.pagination, page: 1 },
    }))
  },

  clearFilters: () => {
    if (Object.keys(get().filters).length === 0 && get().pagination.page === 1) return
    set(state => ({
      filters: {},
      pagination: { ...state.pagination, page: 1 },
    }))
  },

  setPage: (page: number) => {
    if (get().pagination.page === page) return
    set(state => ({ pagination: { ...state.pagination, page } }))
  },

  setLimit: (limit: number) => {
    if (get().pagination.limit === limit) return
    set(state => ({ pagination: { ...state.pagination, limit, page: 1 } }))
  },

  clearError: () => {
    set({ error: null })
  },
}))
