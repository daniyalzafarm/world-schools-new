import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Child } from '@/types/child'

interface ChildrenState {
  children: Child[]
  isLoading: boolean
  error: string | null
}

interface ChildrenActions {
  getChildren: () => Child[]
  getChildById: (id: string) => Child | undefined
  addChild: (child: Omit<Child, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateChild: (id: string, updates: Partial<Omit<Child, 'id' | 'createdAt' | 'updatedAt'>>) => void
  removeChild: (id: string) => void
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

// Generate a simple ID for new children
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Sample data - same as what was in the children page
const initialChildren: Child[] = [
  {
    id: '1',
    personalInfo: {
      firstName: 'John Doe',
      dateOfBirth: new Date('2015-06-26'),
      gender: 'Male',
      nationality: 'American',
      languages: ['English', 'Spanish'],
    },
    academicPreferences: {
      currentGrade: 'Primary',
      favoriteSubjects: ['Mathematics', 'Science'],
      learningStyle: 'Visual',
      languagesOfInstruction: ['English'],
      interestedInBoarding: 'No',
    },
    extraCurricular: {
      interests: ['Soccer', 'Art'],
      preferredSchedule: 'After school',
    },
    specialNeeds: {
      areas: [],
      supportNeeds: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    personalInfo: {
      firstName: 'Leila',
      dateOfBirth: new Date('2012-03-15'),
      gender: 'Female',
      nationality: 'American and Mexican',
      languages: ['English', 'Spanish'],
    },
    academicPreferences: {
      currentGrade: '10th',
      favoriteSubjects: ['Music', 'Basketball', 'Dancing'],
      learningStyle: 'Auditory',
      languagesOfInstruction: ['English'],
      interestedInBoarding: 'Yes',
    },
    extraCurricular: {
      interests: ['Music', 'Basketball', 'Dancing'],
      preferredSchedule: 'Weekend',
    },
    specialNeeds: {
      areas: [],
      supportNeeds: [],
      additionalNotes: 'Vegetarian',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

export const useChildrenStore = create<ChildrenStore>()(
  immer((set, get) => ({
    // Initial state
    children: initialChildren,
    isLoading: false,
    error: null,

    // Actions
    getChildren: () => {
      return get().children
    },

    getChildById: (id: string) => {
      return get().children.find(child => child.id === id)
    },

    addChild: childData => {
      set(state => {
        const now = new Date()
        const newChild: Child = {
          ...childData,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        }
        state.children.push(newChild)
      })
    },

    updateChild: (id: string, updates) => {
      set(state => {
        const childIndex = state.children.findIndex(child => child.id === id)
        if (childIndex !== -1) {
          state.children[childIndex] = {
            ...state.children[childIndex],
            ...updates,
            updatedAt: new Date(),
          }
        }
      })
    },

    removeChild: (id: string) => {
      set(state => {
        state.children = state.children.filter(child => child.id !== id)
      })
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
