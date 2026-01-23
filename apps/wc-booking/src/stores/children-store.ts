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
  addChild: (child: Omit<Child, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>
  updateChild: (
    id: string,
    updates: Partial<Omit<Child, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<boolean>
  removeChild: (id: string) => Promise<boolean>
  setChildren: (children: Child[]) => void
  clearError: () => void
  // Progress tracking functions
  getPersonalInfoProgress: (child: Child) => number
  getAcademicPreferencesProgress: (child: Child) => number
  getExtraCurricularProgress: (child: Child) => number
  getSpecialNeedsProgress: (child: Child) => number
  getOverallProgress: (child: Child) => number
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

    // Progress tracking functions
    getPersonalInfoProgress: (child: Child) => {
      const { personalInfo } = child
      const completedFields = [
        personalInfo.firstName?.trim(),
        personalInfo.dateOfBirth,
        personalInfo.gender,
        personalInfo.nationality,
        personalInfo.languages.length > 0,
      ].filter(Boolean).length
      return (completedFields / 5) * 100
    },

    getAcademicPreferencesProgress: (child: Child) => {
      const { academicPreferences } = child
      const completedFields = [
        academicPreferences.currentGrade,
        academicPreferences.favoriteSubjects.length > 0,
        academicPreferences.learningStyle,
        academicPreferences.languagesOfInstruction.length > 0,
        academicPreferences.interestedInBoarding,
      ].filter(Boolean).length
      return (completedFields / 5) * 100
    },

    getExtraCurricularProgress: (child: Child) => {
      const { extraCurricular } = child
      const completedFields = [
        extraCurricular.interests.length > 0,
        extraCurricular.preferredSchedule,
      ].filter(Boolean).length
      return (completedFields / 2) * 100
    },

    getSpecialNeedsProgress: (child: Child) => {
      const { specialNeeds } = child
      const hasAreas = specialNeeds.areas.length > 0
      const hasSupport = specialNeeds.supportNeeds.length > 0
      const hasNotes = specialNeeds.additionalNotes?.trim()

      // Count completed fields - all fields are optional but we track completion
      const completedFields = [
        hasAreas, // Areas of need
        hasSupport, // Support needs
        hasNotes, // Additional notes
      ].filter(Boolean).length

      // Return percentage based on 3 possible fields
      return (completedFields / 3) * 100
    },

    getOverallProgress: (child: Child) => {
      const personalProgress = get().getPersonalInfoProgress(child)
      const academicProgress = get().getAcademicPreferencesProgress(child)
      const extraCurricularProgress = get().getExtraCurricularProgress(child)
      const specialNeedsProgress = get().getSpecialNeedsProgress(child)

      // Equal weight for all sections (25% each)
      const weightedProgress =
        personalProgress * 0.25 +
        academicProgress * 0.25 +
        extraCurricularProgress * 0.25 +
        specialNeedsProgress * 0.25

      return Math.round(weightedProgress)
    },
  }))
)
