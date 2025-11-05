import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Camp } from '@/types/camp'

interface CampsState {
  camps: Camp[]
  isLoading: boolean
  error: string | null
}

interface CampsActions {
  getCamps: () => Camp[]
  getCampById: (id: string) => Camp | undefined
  addCamp: (camp: Omit<Camp, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateCamp: (id: string, updates: Partial<Omit<Camp, 'id' | 'createdAt' | 'updatedAt'>>) => void
  removeCamp: (id: string) => void
  setCamps: (camps: Camp[]) => void
  clearError: () => void
  // Progress helpers
  getBasicInfoProgress: (camp: Camp) => number
  getProgramProgress: (camp: Camp) => number
  getPricingProgress: (camp: Camp) => number
  getFacilitiesProgress: (camp: Camp) => number
  getOverallProgress: (camp: Camp) => number
}

type CampsStore = CampsState & CampsActions

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

const initialCamps: Camp[] = [
  {
    id: '1',
    name: 'Summer Adventure Camp',
    description: 'An exciting summer camp focused on outdoor activities and adventure sports.',
    status: 'active',
    capacity: 150,
    minAge: 8,
    maxAge: 16,
    locations: ['Lake Tahoe, CA'],
    campTypes: ['residential'],
    dateRange: { startDate: new Date('2024-06-15'), endDate: new Date('2024-08-15') },
    activities: ['multisport', 'swimming', 'arts_crafts'],
    priceRange: [2000, 8000],
    facilities: ['Accommodation', 'Meals', 'Medical Staff'],
    specialNeeds: ['Dietary Needs'],
    enrolled: 0,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
  },
]

export const useCampsStore = create<CampsStore>()(
  immer((set, get) => ({
    camps: initialCamps,
    isLoading: false,
    error: null,

    getCamps: () => get().camps,
    getCampById: (id: string) => get().camps.find(c => c.id === id),

    addCamp: campData => {
      set(state => {
        const now = new Date()
        const newCamp: Camp = {
          ...campData,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        }
        state.camps.push(newCamp)
      })
    },

    updateCamp: (id, updates) => {
      set(state => {
        const idx = state.camps.findIndex(c => c.id === id)
        if (idx !== -1) {
          state.camps[idx] = {
            ...state.camps[idx],
            ...updates,
            updatedAt: new Date(),
          }
        }
      })
    },

    removeCamp: id => {
      set(state => {
        state.camps = state.camps.filter(c => c.id !== id)
      })
    },

    setCamps: camps => {
      set(state => {
        state.camps = camps
      })
    },

    clearError: () => {
      set(state => {
        state.error = null
      })
    },

    // Progress helpers
    getBasicInfoProgress: (camp: Camp) => {
      const completed = [
        camp.name?.trim(),
        camp.status,
        typeof camp.capacity === 'number' && camp.capacity > 0,
        typeof camp.minAge === 'number',
        typeof camp.maxAge === 'number',
      ].filter(Boolean).length
      return (completed / 5) * 100
    },

    getProgramProgress: (camp: Camp) => {
      const hasDates = Boolean(camp.dateRange?.startDate && camp.dateRange?.endDate)
      const completed = [
        camp.locations.length > 0,
        camp.campTypes.length > 0,
        hasDates,
        camp.activities.length > 0,
      ].filter(Boolean).length
      return (completed / 4) * 100
    },

    getPricingProgress: (camp: Camp) => {
      const [min, max] = camp.priceRange || [0, 0]
      const valid = typeof min === 'number' && typeof max === 'number' && min <= max
      return valid ? 100 : 0
    },

    getFacilitiesProgress: (camp: Camp) => {
      const completed = [
        camp.facilities.length > 0,
        camp.specialNeeds.length > 0,
        Boolean(camp.description && camp.description.trim().length > 0),
      ].filter(Boolean).length
      return (completed / 3) * 100
    },

    getOverallProgress: (camp: Camp) => {
      const b = get().getBasicInfoProgress(camp)
      const p = get().getProgramProgress(camp)
      const pr = get().getPricingProgress(camp)
      const f = get().getFacilitiesProgress(camp)
      const weighted = b * 0.3 + p * 0.35 + pr * 0.2 + f * 0.15
      return Math.round(weighted)
    },
  }))
)
