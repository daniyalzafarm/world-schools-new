import { create } from 'zustand'
import { addToast } from '@heroui/react'
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
  createAddOn: (data: CreateAddOnDto) => Promise<AddOn | undefined>
  updateAddOn: (id: string, data: UpdateAddOnDto) => Promise<AddOn | undefined>
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
    const response = await addOnsService.getAddOns(query)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    set({ addOns: response.data.addOns, isLoading: false })
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
    set(state => ({ addOns: [...state.addOns, newAddOn], isLoading: false }))
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

  clearError: () => {
    set({ error: null })
  },
}))
