import { create } from 'zustand'
import type {
  ContactInfo,
  GoogleBusinessProfile,
  GoogleBusinessSearchResult,
  OnboardingStatus,
  SaveProviderSettingsRequest,
  VerificationDocument,
} from '../types/onboarding'
import { onboardingService } from '../services/onboarding.services'
import type { ValidationResult } from '../utils/onboarding-validation'

interface OnboardingStore {
  // State
  status: OnboardingStatus | null
  googleBusinessProfile: GoogleBusinessProfile | null
  searchResults: GoogleBusinessSearchResult[]
  documents: VerificationDocument[]
  validationResult: ValidationResult | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchStatus: () => Promise<void>
  fetchGoogleBusinessProfile: () => Promise<void>
  searchGoogleBusiness: (query: string, lat?: number, lng?: number) => Promise<void>
  saveGoogleBusinessProfile: (placeId: string) => Promise<void>
  saveContactInfo: (data: ContactInfo) => Promise<void>
  saveCampInfo: (data: {
    description: string
    campTypes: string[]
    minAge: number
    maxAge: number
  }) => Promise<void>
  uploadDocument: (file: File, documentType: string) => Promise<void>
  fetchDocuments: () => Promise<void>
  deleteDocument: (documentId: string) => Promise<void>
  completeStep4: () => Promise<void>
  saveProviderSettings: (data: SaveProviderSettingsRequest) => Promise<void>
  validateOnboarding: () => Promise<ValidationResult>
  completeOnboarding: () => Promise<void>
  clearError: () => void
  reset: () => void
}

const initialState = {
  status: null,
  googleBusinessProfile: null,
  searchResults: [],
  documents: [],
  validationResult: null,
  isLoading: false,
  error: null,
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  ...initialState,

  fetchStatus: async () => {
    set({ isLoading: true, error: null })
    try {
      const status = await onboardingService.getStatus()
      set({ status, isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch onboarding status', isLoading: false })
    }
  },

  fetchGoogleBusinessProfile: async () => {
    set({ isLoading: true, error: null })
    try {
      const profile = await onboardingService.getGoogleBusinessProfile()
      set({ googleBusinessProfile: profile, isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch Google Business Profile', isLoading: false })
    }
  },

  searchGoogleBusiness: async (query: string, lat?: number, lng?: number) => {
    set({ isLoading: true, error: null })
    try {
      const results = await onboardingService.searchGoogleBusiness({ query, lat, lng })
      set({ searchResults: results, isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to search businesses', isLoading: false })
    }
  },

  saveGoogleBusinessProfile: async (placeId: string) => {
    set({ isLoading: true, error: null })
    try {
      await onboardingService.saveGoogleBusinessProfile({ placeId })
      await get().fetchStatus()
      set({ isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to save business profile', isLoading: false })
    }
  },

  saveContactInfo: async (data: ContactInfo) => {
    set({ isLoading: true, error: null })
    try {
      await onboardingService.saveContactInfo(data)
      await get().fetchStatus()
      set({ isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to save contact info', isLoading: false })
    }
  },

  saveCampInfo: async (data: {
    description: string
    campTypes: string[]
    minAge: number
    maxAge: number
  }) => {
    set({ isLoading: true, error: null })
    try {
      await onboardingService.saveCampInfo(data)
      await get().fetchStatus()
      set({ isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to save camp info', isLoading: false })
    }
  },

  uploadDocument: async (file: File, documentType: string) => {
    set({ isLoading: true, error: null })
    try {
      await onboardingService.uploadDocument({ file, documentType: documentType as any })
      await get().fetchDocuments()
      await get().fetchStatus()
      set({ isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to upload document', isLoading: false })
    }
  },

  fetchDocuments: async () => {
    set({ isLoading: true, error: null })
    try {
      const documents = await onboardingService.getDocuments()
      set({ documents, isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch documents', isLoading: false })
    }
  },

  deleteDocument: async (documentId: string) => {
    set({ isLoading: true, error: null })
    try {
      await onboardingService.deleteDocument(documentId)
      await get().fetchDocuments()
      await get().fetchStatus()
      set({ isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete document', isLoading: false })
    }
  },

  completeStep4: async () => {
    set({ isLoading: true, error: null })
    try {
      await onboardingService.completeStep4()
      await get().fetchStatus()
      set({ isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to complete step 4', isLoading: false })
      throw error // Re-throw to allow caller to handle errors
    }
  },

  saveProviderSettings: async (data: SaveProviderSettingsRequest) => {
    set({ isLoading: true, error: null })
    try {
      await onboardingService.saveProviderSettings(data)
      await get().fetchStatus()
      set({ isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'Failed to save settings', isLoading: false })
      throw error // Re-throw to allow caller to handle errors
    }
  },

  validateOnboarding: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await onboardingService.validateOnboarding()
      set({ validationResult: result, isLoading: false })
      return result
    } catch (error: any) {
      set({ error: error.message || 'Failed to validate onboarding', isLoading: false })
      throw error
    }
  },

  completeOnboarding: async () => {
    set({ isLoading: true, error: null })
    try {
      await onboardingService.completeOnboarding()
      await get().fetchStatus()
      set({ isLoading: false, validationResult: null })
    } catch (error: any) {
      set({ error: error.message || 'Failed to complete onboarding', isLoading: false })
      throw error
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))
