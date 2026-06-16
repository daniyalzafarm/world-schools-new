import { create } from 'zustand'
import { addToast } from '@heroui/react'
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

  // Auto-save state (for sections using auto-save only)
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error'
  hasPendingAutoSave: boolean
  autoSaveFlush: (() => Promise<void>) | null

  // Sidebar completion counts for sections not stored in Camp object
  sidebarEligibilityCount: number | null
  sidebarAddonEnabledCount: number | null
  sidebarAddonTotalCount: number | null

  // Actions - Wizard
  createCamp: (data: CreateCampDto) => Promise<Camp | undefined>
  updateCampAudience: (campId: string, data: UpdateCampAudienceDto) => Promise<Camp | undefined>
  updateCampPrograms: (campId: string, data: UpdateCampProgramsDto) => Promise<Camp | undefined>
  updateCampPhotos: (campId: string, photos: any) => Promise<Camp | undefined>
  uploadCampPhotos: (
    campId: string,
    files: File[],
    existingPhotos: any[]
  ) => Promise<Camp | undefined>
  publishCamp: (campId: string) => Promise<Camp | undefined>
  saveDraft: () => void

  // Actions - Camp Management
  fetchCamps: (filters?: GetCampsFilters) => Promise<void>
  fetchCamp: (campId: string) => Promise<void>
  fetchStatistics: () => Promise<void>
  archiveCamp: (campId: string) => Promise<void>
  duplicateCamp: (campId: string) => Promise<Camp | undefined>
  deleteCamp: (campId: string) => Promise<void>

  // Actions - Editor
  updateBasicInfo: (campId: string, data: Partial<Camp>) => Promise<Camp | undefined>
  updateSection: (campId: string, section: string, data: any) => Promise<Camp | undefined>

  // Wizard helpers
  setWizardCamp: (camp: Camp | null) => void
  setWizardStep: (step: number) => void
  setHasUnsavedChanges: (hasChanges: boolean) => void
  setWizardFormValid: (isValid: boolean) => void
  setWizardFormSubmit: (submitFn: (() => Promise<void>) | null) => void
  setAutoSaveFlush: (flushFn: (() => Promise<void>) | null) => void
  resetWizard: () => void

  // General helpers
  setCurrentCamp: (camp: Camp | null) => void
  clearError: () => void
  setSidebarEligibilityCount: (n: number) => void
  setSidebarAddonEnabledCount: (n: number) => void
  setSidebarAddonTotalCount: (n: number) => void
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
  autoSaveStatus: 'idle',
  hasPendingAutoSave: false,
  autoSaveFlush: null,
  sidebarEligibilityCount: null,
  sidebarAddonEnabledCount: null,
  sidebarAddonTotalCount: null,

  // Wizard actions
  createCamp: async (data: CreateCampDto) => {
    set({ isLoading: true, error: null })
    const response = await campsService.createCamp(data)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const camp = response.data.camp
    set({ wizardCamp: camp, wizardStep: 2, isLoading: false })
    return camp
  },

  updateCampAudience: async (campId: string, data: UpdateCampAudienceDto) => {
    set({ isLoading: true, error: null })
    const response = await campsService.updateCampAudience(campId, data)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const camp = response.data.camp
    set({ wizardCamp: camp, currentCamp: camp, isLoading: false, hasUnsavedChanges: false })
    return camp
  },

  updateCampPrograms: async (campId: string, data: UpdateCampProgramsDto) => {
    set({ isLoading: true, error: null })
    const response = await campsService.updateCampPrograms(campId, data)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const camp = response.data.camp
    set({ wizardCamp: camp, currentCamp: camp, isLoading: false, hasUnsavedChanges: false })
    return camp
  },

  updateCampPhotos: async (campId: string, photos: any) => {
    set({ isLoading: true, error: null })
    const response = await campsService.updateCampPhotos(campId, photos)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const camp = response.data.camp
    set({ wizardCamp: camp, isLoading: false })
    return camp
  },

  uploadCampPhotos: async (campId: string, files: File[], existingPhotos: any[]) => {
    set({ isLoading: true, error: null })
    const response = await campsService.uploadCampPhotos(campId, files, existingPhotos)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const camp = response.data.camp
    set({ wizardCamp: camp, isLoading: false })
    return camp
  },

  publishCamp: async (campId: string) => {
    set({ isLoading: true, error: null })
    const response = await campsService.publishCamp(campId)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const camp = response.data.camp
    set({ wizardCamp: null, wizardStep: 1, isLoading: false })
    return camp
  },

  saveDraft: () => {
    const { wizardCamp } = get()
    if (!wizardCamp) return
    set({ hasUnsavedChanges: false })
  },

  // Camp management actions
  fetchCamps: async (filters?: GetCampsFilters) => {
    set({ isLoading: true, error: null })
    const response = await campsService.getCamps(filters)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    set({ camps: response.data.camps, isLoading: false })
  },

  fetchCamp: async (campId: string) => {
    set({ isLoading: true, error: null })
    const response = await campsService.getCamp(campId)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    set({ currentCamp: response.data.camp, isLoading: false })
  },

  fetchStatistics: async () => {
    set({ isLoading: true, error: null })
    const response = await campsService.getCampStatistics()
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    set({ statistics: response.data.stats, isLoading: false })
  },

  archiveCamp: async (campId: string) => {
    set({ isLoading: true, error: null })
    const response = await campsService.archiveCamp(campId)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const { camps } = get()
    set({
      camps: camps.map(c => (c.id === campId ? { ...c, status: 'archived' as const } : c)),
      isLoading: false,
    })
    await get().fetchStatistics()
  },

  duplicateCamp: async (campId: string) => {
    set({ isLoading: true, error: null })
    const response = await campsService.duplicateCamp(campId)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const newCamp = response.data.camp
    const { camps } = get()
    set({ camps: [newCamp, ...camps], isLoading: false })
    await get().fetchStatistics()
    return newCamp
  },

  deleteCamp: async (campId: string) => {
    set({ isLoading: true, error: null })
    const response = await campsService.deleteCamp(campId)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const { camps } = get()
    set({ camps: camps.filter(c => c.id !== campId), isLoading: false })
    await get().fetchStatistics()
  },

  // Editor actions
  updateBasicInfo: async (campId: string, data: Partial<Camp>) => {
    set({ isLoading: true, error: null })
    const response = await campsService.updateBasicInfo(campId, data)
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const camp = response.data.camp
    set({ wizardCamp: camp, currentCamp: camp, isLoading: false, hasUnsavedChanges: false })
    return camp
  },

  updateSection: async (campId: string, section: string, data: any) => {
    set({ isLoading: true, error: null })
    let response: any
    switch (section) {
      case 'photos':
        response = await campsService.updatePhotos(campId, data.photos)
        break
      case 'whats-included':
        response = await campsService.updateWhatsIncluded(campId, data.whatsIncluded)
        break
      case 'daily-schedule':
        response = await campsService.updateDailySchedule(campId, data)
        break
      case 'meals':
        response = await campsService.updateMeals(campId, data.meals)
        break
      case 'sports':
        response = await campsService.updateSports(campId, data.sportsActivities)
        break
      case 'languages':
        response = await campsService.updateLanguages(campId, data.languagePrograms)
        break
      case 'arts':
        response = await campsService.updateArts(campId, data.artsAndCrafts)
        break
      case 'adventure':
        response = await campsService.updateAdventure(campId, data.adventureActivities)
        break
      case 'water':
        response = await campsService.updateWater(campId, data.waterActivities)
        break
      case 'environmental':
        response = await campsService.updateEnvironmental(campId, data.environmentalActivities)
        break
      case 'academics':
        response = await campsService.updateAcademics(campId, data.academics)
        break
      case 'religion':
        response = await campsService.updateReligion(campId, data.religionPrograms)
        break
      case 'excursions':
        response = await campsService.updateExcursions(campId, data.excursionsTrips)
        break
      case 'location-campus':
        response = await campsService.updateLocationCampus(campId, data.campusFacilities)
        break
      case 'accommodation':
        response = await campsService.updateAccommodation(campId, data.accommodation)
        break
      case 'getting-there':
        response = await campsService.updateGettingThere(campId, data.gettingThere)
        break
      case 'camp-focus':
        response = await campsService.updateCampFocus(campId, data.campFocus)
        break
      case 'safety-policies':
        response = await campsService.updateSafetyPolicies(
          campId,
          data.safetySupervision,
          data.screenPolicy
        )
        break
      default:
        console.error(`Unknown section: ${section}`)
        set({ isLoading: false })
        return
    }
    if (!response.success) {
      const message = response.data.message
      set({ error: message, isLoading: false })
      addToast({ title: 'Error', description: message, color: 'danger' })
      return
    }
    const camp = response.data.camp as Camp
    // Section-update endpoints return the raw camp without `currency` (a
    // provider-level, immutable value loaded once by the editor layout). Preserve
    // it so currency-dependent UI (e.g. session pricing) doesn't break on save.
    set(state => ({
      currentCamp: { ...camp, currency: camp.currency || state.currentCamp?.currency || '' },
      isLoading: false,
    }))
    return camp
  },

  // Wizard helpers
  setWizardCamp: (camp: Camp | null) => set({ wizardCamp: camp }),
  setWizardStep: (step: number) => set({ wizardStep: step }),
  setHasUnsavedChanges: (hasChanges: boolean) => set({ hasUnsavedChanges: hasChanges }),
  setWizardFormValid: (isValid: boolean) => set({ wizardFormValid: isValid }),
  setWizardFormSubmit: (submitFn: (() => Promise<void>) | null) =>
    set({ wizardFormSubmit: submitFn }),
  setAutoSaveFlush: (flushFn: (() => Promise<void>) | null) => set({ autoSaveFlush: flushFn }),
  resetWizard: () => set({ wizardCamp: null, wizardStep: 1, hasUnsavedChanges: false }),

  // General helpers
  setCurrentCamp: (camp: Camp | null) => set({ currentCamp: camp }),
  clearError: () => set({ error: null }),
  setSidebarEligibilityCount: (n: number) => set({ sidebarEligibilityCount: n }),
  setSidebarAddonEnabledCount: (n: number) => set({ sidebarAddonEnabledCount: n }),
  setSidebarAddonTotalCount: (n: number) => set({ sidebarAddonTotalCount: n }),
}))
