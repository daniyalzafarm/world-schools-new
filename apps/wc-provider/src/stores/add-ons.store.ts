import { create } from 'zustand'
import type { AddOn, CreateAddOnDto, QueryAddOnsDto, UpdateAddOnDto } from '@/types/add-ons'
import * as addOnsService from '@/services/add-ons.service'

interface AddOnsState {
  addOns: AddOn[]
  selectedAddOn: AddOn | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchAddOns: (query?: QueryAddOnsDto) => Promise<void>
  fetchAddOn: (id: string) => Promise<void>
  createAddOn: (data: CreateAddOnDto) => Promise<AddOn>
  updateAddOn: (id: string, data: UpdateAddOnDto) => Promise<AddOn>
  deleteAddOn: (id: string) => Promise<void>
  updateSortOrder: (updates: { id: string; sortOrder: number }[]) => Promise<void>
  setSelectedAddOn: (addOn: AddOn | null) => void
  clearError: () => void
}

export const useAddOnsStore = create<AddOnsState>((set, get) => ({
  addOns: [],
  selectedAddOn: null,
  isLoading: false,
  error: null,

  fetchAddOns: async (query?: QueryAddOnsDto) => {
    set({ isLoading: true, error: null })
    try {
      const response = await addOnsService.getAddOns(query)
      set({ addOns: response.addOns, isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch add-ons',
        isLoading: false,
      })
    }
  },

  fetchAddOn: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await addOnsService.getAddOn(id)
      set({ selectedAddOn: response.addOn, isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch add-on',
        isLoading: false,
      })
    }
  },

  createAddOn: async (data: CreateAddOnDto) => {
    set({ isLoading: true, error: null })
    try {
      const response = await addOnsService.createAddOn(data)
      const newAddOn = response.addOn
      set(state => ({
        addOns: [...state.addOns, newAddOn],
        isLoading: false,
      }))
      return newAddOn
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create add-on',
        isLoading: false,
      })
      throw error
    }
  },

  updateAddOn: async (id: string, data: UpdateAddOnDto) => {
    set({ isLoading: true, error: null })
    try {
      const response = await addOnsService.updateAddOn(id, data)
      const updatedAddOn = response.addOn
      set(state => ({
        addOns: state.addOns.map(a => (a.id === id ? updatedAddOn : a)),
        selectedAddOn: state.selectedAddOn?.id === id ? updatedAddOn : state.selectedAddOn,
        isLoading: false,
      }))
      return updatedAddOn
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update add-on',
        isLoading: false,
      })
      throw error
    }
  },

  deleteAddOn: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await addOnsService.deleteAddOn(id)
      set(state => ({
        addOns: state.addOns.filter(a => a.id !== id),
        selectedAddOn: state.selectedAddOn?.id === id ? null : state.selectedAddOn,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to delete add-on',
        isLoading: false,
      })
      throw error
    }
  },

  updateSortOrder: async (updates: { id: string; sortOrder: number }[]) => {
    try {
      await addOnsService.updateAddOnsSortOrder(updates)
      // Update local state
      set(state => ({
        addOns: state.addOns
          .map(addOn => {
            const update = updates.find(u => u.id === addOn.id)
            return update ? { ...addOn, sortOrder: update.sortOrder } : addOn
          })
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }))
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update sort order',
      })
      throw error
    }
  },

  setSelectedAddOn: (addOn: AddOn | null) => {
    set({ selectedAddOn: addOn })
  },

  clearError: () => {
    set({ error: null })
  },
}))
