import { create } from 'zustand'
import type {
  Camp,
  CreateCampDto,
  UpdateCampAudienceDto,
  UpdateCampProgramsDto,
} from '../types/camps'
import * as campsService from '../services/camps.services'
import type { CampStatistics, GetCampsFilters } from '../services/camps.services'

interface CampsState {
  // State
  camps: Camp[]
  currentCamp: Camp | null
  statistics: CampStatistics | null
  isLoading: boolean
  error: string | null

  // Wizard state
  wizardCamp: Camp | null
  wizardStep: number
  hasUnsavedChanges: boolean
  wizardFormValid: boolean
  wizardFormSubmit: (() => Promise<void>) | null

  // Actions - Wizard
  createCamp: (data: CreateCampDto) => Promise<Camp>
  updateCampAudience: (campId: string, data: UpdateCampAudienceDto) => Promise<Camp>
  updateCampPrograms: (campId: string, data: UpdateCampProgramsDto) => Promise<Camp>
  updateCampPhotos: (campId: string, photos: any) => Promise<Camp>
  uploadCampPhotos: (campId: string, files: File[], existingPhotos: any[]) => Promise<Camp>
  publishCamp: (campId: string) => Promise<Camp>
  saveDraft: () => Promise<void>

  // Actions - Camp Management
  fetchCamps: (filters?: GetCampsFilters) => Promise<void>
  fetchCamp: (campId: string) => Promise<void>
  fetchStatistics: () => Promise<void>
  archiveCamp: (campId: string) => Promise<void>
  duplicateCamp: (campId: string) => Promise<Camp>
  deleteCamp: (campId: string) => Promise<void>

  // Actions - Editor
  updateBasicInfo: (campId: string, data: Partial<Camp>) => Promise<Camp>
  updateSection: (campId: string, section: string, data: any) => Promise<Camp>

  // Wizard helpers
  setWizardCamp: (camp: Camp | null) => void
  setWizardStep: (step: number) => void
  setHasUnsavedChanges: (hasChanges: boolean) => void
  resetWizard: () => void

  // General helpers
  setCurrentCamp: (camp: Camp | null) => void
  clearError: () => void
}

export const useCampsStore = create<CampsState>((set, get) => ({
  // Initial state
  camps: [],
  currentCamp: null,
  statistics: null,
  isLoading: false,
  error: null,
  wizardCamp: null,
  wizardStep: 1,
  hasUnsavedChanges: false,
  wizardFormValid: false,
  wizardFormSubmit: null,

  // Wizard actions
  createCamp: async (data: CreateCampDto) => {
    set({ isLoading: true, error: null })
    try {
      const camp = await campsService.createCamp(data)
      set({ wizardCamp: camp, wizardStep: 2, isLoading: false })
      return camp
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  updateCampAudience: async (campId: string, data: UpdateCampAudienceDto) => {
    set({ isLoading: true, error: null })
    try {
      const camp = await campsService.updateCampAudience(campId, data)
      set({ wizardCamp: camp, isLoading: false })
      return camp
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  updateCampPrograms: async (campId: string, data: UpdateCampProgramsDto) => {
    set({ isLoading: true, error: null })
    try {
      const camp = await campsService.updateCampPrograms(campId, data)
      set({ wizardCamp: camp, isLoading: false })
      return camp
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  updateCampPhotos: async (campId: string, photos: any) => {
    set({ isLoading: true, error: null })
    try {
      const camp = await campsService.updateCampPhotos(campId, { photos })
      set({ wizardCamp: camp, isLoading: false })
      return camp
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  uploadCampPhotos: async (campId: string, files: File[], existingPhotos: any[]) => {
    set({ isLoading: true, error: null })
    try {
      const camp = await campsService.uploadCampPhotos(campId, files, existingPhotos)
      set({ wizardCamp: camp, isLoading: false })
      return camp
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  publishCamp: async (campId: string) => {
    set({ isLoading: true, error: null })
    try {
      const camp = await campsService.publishCamp(campId)
      set({ wizardCamp: null, wizardStep: 1, isLoading: false })
      return camp
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  saveDraft: async () => {
    const { wizardCamp } = get()
    if (!wizardCamp) return

    set({ isLoading: true, error: null })
    try {
      // The camp is already saved as draft by default
      // This is just to provide user feedback
      set({ hasUnsavedChanges: false, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  // Camp management actions
  fetchCamps: async (filters?: GetCampsFilters) => {
    set({ isLoading: true, error: null })
    try {
      const camps = await campsService.getCamps(filters)
      set({ camps, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  fetchCamp: async (campId: string) => {
    set({ isLoading: true, error: null })
    try {
      const camp = await campsService.getCamp(campId)
      // Set both currentCamp and wizardCamp to support both wizard and editor modes
      set({ currentCamp: camp, wizardCamp: camp, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  fetchStatistics: async () => {
    set({ isLoading: true, error: null })
    try {
      const statistics = await campsService.getCampStatistics()
      set({ statistics, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  archiveCamp: async (campId: string) => {
    set({ isLoading: true, error: null })
    try {
      await campsService.archiveCamp(campId)
      const { camps } = get()
      set({
        camps: camps.map(c => (c.id === campId ? { ...c, status: 'archived' as const } : c)),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  duplicateCamp: async (campId: string) => {
    set({ isLoading: true, error: null })
    try {
      const newCamp = await campsService.duplicateCamp(campId)
      const { camps } = get()
      set({ camps: [newCamp, ...camps], isLoading: false })
      return newCamp
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  deleteCamp: async (campId: string) => {
    set({ isLoading: true, error: null })
    try {
      await campsService.deleteCamp(campId)
      const { camps } = get()
      set({ camps: camps.filter(c => c.id !== campId), isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  // Editor actions
  updateBasicInfo: async (campId: string, data: Partial<Camp>) => {
    set({ isLoading: true, error: null })
    try {
      const camp = await campsService.updateBasicInfo(campId, data)
      set({ currentCamp: camp, isLoading: false })
      return camp
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  updateSection: async (campId: string, section: string, data: any) => {
    set({ isLoading: true, error: null })
    try {
      let camp: Camp
      switch (section) {
        case 'photos':
          camp = await campsService.updatePhotos(campId, data)
          break
        case 'whats-included':
          camp = await campsService.updateWhatsIncluded(campId, data)
          break
        case 'daily-schedule':
          camp = await campsService.updateDailySchedule(campId, data)
          break
        case 'meals':
          camp = await campsService.updateMeals(campId, data)
          break
        case 'sports':
          camp = await campsService.updateSports(campId, data)
          break
        case 'languages':
          camp = await campsService.updateLanguages(campId, data)
          break
        case 'arts':
          camp = await campsService.updateArts(campId, data)
          break
        case 'adventure':
          camp = await campsService.updateAdventure(campId, data)
          break
        case 'water':
          camp = await campsService.updateWater(campId, data)
          break
        case 'environmental':
          camp = await campsService.updateEnvironmental(campId, data)
          break
        case 'academics':
          camp = await campsService.updateAcademics(campId, data)
          break
        case 'religion':
          camp = await campsService.updateReligion(campId, data)
          break
        case 'excursions':
          camp = await campsService.updateExcursions(campId, data)
          break
        case 'location-campus':
          camp = await campsService.updateLocationCampus(campId, data)
          break
        case 'accommodation':
          camp = await campsService.updateAccommodation(campId, data)
          break
        case 'getting-there':
          camp = await campsService.updateGettingThere(campId, data)
          break
        case 'camp-focus':
          camp = await campsService.updateCampFocus(campId, data)
          break
        default:
          throw new Error(`Unknown section: ${section}`)
      }
      set({ currentCamp: camp, isLoading: false })
      return camp
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  // Wizard helpers
  setWizardCamp: (camp: Camp | null) => set({ wizardCamp: camp }),
  setWizardStep: (step: number) => set({ wizardStep: step }),
  setHasUnsavedChanges: (hasChanges: boolean) => set({ hasUnsavedChanges: hasChanges }),
  resetWizard: () => set({ wizardCamp: null, wizardStep: 1, hasUnsavedChanges: false }),

  // General helpers
  setCurrentCamp: (camp: Camp | null) => set({ currentCamp: camp }),
  clearError: () => set({ error: null }),
}))
