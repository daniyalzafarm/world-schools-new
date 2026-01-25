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
    const response = await onboardingService.getStatus()

    if (response.success && response.data) {
      set({ status: response.data, isLoading: false })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to fetch onboarding status'
      set({ error: errorMessage, isLoading: false })
    }
  },

  fetchGoogleBusinessProfile: async () => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.getGoogleBusinessProfile()

    if (response.success) {
      set({ googleBusinessProfile: response.data, isLoading: false })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to fetch Google Business Profile'
      set({ error: errorMessage, isLoading: false })
    }
  },

  searchGoogleBusiness: async (query: string, lat?: number, lng?: number) => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.searchGoogleBusiness({ query, lat, lng })

    if (response.success && response.data) {
      set({ searchResults: response.data, isLoading: false })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to search businesses'
      set({ error: errorMessage, isLoading: false })
    }
  },

  saveGoogleBusinessProfile: async (placeId: string) => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.saveGoogleBusinessProfile({ placeId })

    if (response.success) {
      await get().fetchStatus()
      set({ isLoading: false })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to save business profile'
      set({ error: errorMessage, isLoading: false })
    }
  },

  saveContactInfo: async (data: ContactInfo) => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.saveContactInfo(data)

    if (response.success) {
      await get().fetchStatus()
      set({ isLoading: false })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to save contact info'
      set({ error: errorMessage, isLoading: false })
    }
  },

  saveCampInfo: async (data: {
    description: string
    campTypes: string[]
    minAge: number
    maxAge: number
  }) => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.saveCampInfo(data)

    if (response.success) {
      await get().fetchStatus()
      set({ isLoading: false })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to save camp info'
      set({ error: errorMessage, isLoading: false })
    }
  },

  uploadDocument: async (file: File, documentType: string) => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.uploadDocument({
      file,
      documentType: documentType as any,
    })

    if (response.success) {
      await get().fetchDocuments()
      await get().fetchStatus()
      set({ isLoading: false })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to upload document'
      set({ error: errorMessage, isLoading: false })
    }
  },

  fetchDocuments: async () => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.getDocuments()

    if (response.success && response.data) {
      set({ documents: response.data, isLoading: false })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to fetch documents'
      set({ error: errorMessage, isLoading: false })
    }
  },

  deleteDocument: async (documentId: string) => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.deleteDocument(documentId)

    if (response.success) {
      await get().fetchDocuments()
      await get().fetchStatus()
      set({ isLoading: false })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to delete document'
      set({ error: errorMessage, isLoading: false })
    }
  },

  completeStep4: async () => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.completeStep4()

    if (response.success) {
      await get().fetchStatus()
      set({ isLoading: false })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to complete step 4'
      set({ error: errorMessage, isLoading: false })
    }
  },

  saveProviderSettings: async (data: SaveProviderSettingsRequest) => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.saveProviderSettings(data)

    if (response.success) {
      await get().fetchStatus()
      set({ isLoading: false })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to save settings'
      set({ error: errorMessage, isLoading: false })
    }
  },

  validateOnboarding: async () => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.validateOnboarding()

    if (response.success && response.data) {
      set({ validationResult: response.data, isLoading: false })
      return response.data
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to validate onboarding'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  completeOnboarding: async () => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.completeOnboarding()

    if (response.success) {
      await get().fetchStatus()
      set({ isLoading: false, validationResult: null })
    } else {
      const errorMessage =
        'data' in response &&
        typeof response.data === 'object' &&
        response.data &&
        'message' in response.data
          ? String(response.data.message)
          : 'Failed to complete onboarding'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))
