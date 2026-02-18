import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Child } from '@/types/child'
import { childrenService } from '@/services/children.services'

interface ChildrenState {
  children: Child[]
  isLoading: boolean
  error: string | null
}

interface ChildrenActions {
  fetchChildren: () => Promise<void>
  getChildren: () => Child[]
  getChildById: (id: string) => Child | undefined
  addChild: (child: {
    firstName: string
    lastName?: string
    dateOfBirth: string
    gender: 'boy' | 'girl' | 'non_binary' | 'prefer_not_to_say'
  }) => Promise<boolean>
  updateChild: (
    id: string,
    updates: Partial<
      Omit<Child, 'id' | 'createdAt' | 'updatedAt' | 'parentId' | 'profileCompletion' | 'archived'>
    >
  ) => Promise<boolean>
  archiveChild: (id: string) => Promise<boolean>
  removeChild: (id: string) => Promise<boolean>
  setChildren: (children: Child[]) => void
  clearError: () => void
  // Helper functions
  getBookingEligibleChildren: () => Child[]
}

type ChildrenStore = ChildrenState & ChildrenActions

// No initial data - will be fetched from API

export const useChildrenStore = create<ChildrenStore>()(
  immer((set, get) => ({
    // Initial state
    children: [],
    isLoading: false,
    error: null,

    // Actions
    fetchChildren: async () => {
      set(state => {
        state.isLoading = true
        state.error = null
      })

      const response = await childrenService.getAll()

      if (response.success) {
        set(state => {
          state.children = response.data
          state.isLoading = false
        })
      } else {
        set(state => {
          state.error = (response.data as any)?.message || 'Failed to fetch children'
          state.isLoading = false
        })
      }
    },

    getChildren: () => {
      return get().children
    },

    getChildById: (id: string) => {
      return get().children.find(child => child.id === id)
    },

    addChild: async childData => {
      set(state => {
        state.isLoading = true
        state.error = null
      })

      const response = await childrenService.create(childData)

      if (response.success) {
        set(state => {
          state.children.push(response.data)
          state.isLoading = false
        })
        return true
      } else {
        set(state => {
          state.error = (response.data as any)?.message || 'Failed to create child'
          state.isLoading = false
        })
        return false
      }
    },

    updateChild: async (id: string, updates) => {
      set(state => {
        state.isLoading = true
        state.error = null
      })

      const response = await childrenService.update(id, updates)

      if (response.success) {
        set(state => {
          const childIndex = state.children.findIndex(child => child.id === id)
          if (childIndex !== -1) {
            state.children[childIndex] = response.data
          }
          state.isLoading = false
        })
        return true
      } else {
        set(state => {
          state.error = (response.data as any)?.message || 'Failed to update child'
          state.isLoading = false
        })
        return false
      }
    },

    archiveChild: async (id: string) => {
      set(state => {
        state.isLoading = true
        state.error = null
      })

      const response = await childrenService.archive(id)

      if (response.success) {
        set(state => {
          // Remove archived child from the list
          state.children = state.children.filter(child => child.id !== id)
          state.isLoading = false
        })
        return true
      } else {
        set(state => {
          state.error = (response.data as any)?.message || 'Failed to archive child'
          state.isLoading = false
        })
        return false
      }
    },

    removeChild: async (id: string) => {
      set(state => {
        state.isLoading = true
        state.error = null
      })

      const response = await childrenService.delete(id)

      if (response.success) {
        set(state => {
          state.children = state.children.filter(child => child.id !== id)
          state.isLoading = false
        })
        return true
      } else {
        set(state => {
          state.error = (response.data as any)?.message || 'Failed to delete child'
          state.isLoading = false
        })
        return false
      }
    },

    setChildren: (children: Child[]) => {
      set(state => {
        state.children = children
      })
    },

    clearError: () => {
      set(state => {
        state.error = null
      })
    },

    // Helper functions
    getBookingEligibleChildren: () => {
      return get().children.filter(
        child => child.profileCompletion >= 75 && child.emergencyContacts.length >= 1
      )
    },
  }))
)
