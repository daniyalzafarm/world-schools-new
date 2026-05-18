import { create } from 'zustand'
import { type CalendarDate, parseDate } from '@internationalized/date'
import type {
  ContactInfo,
  GoogleBusinessProfile,
  GoogleBusinessSearchResult,
  OnboardingStatus,
  SaveDepositSettingsRequest,
  SaveProviderSettingsRequest,
  VerificationDocument,
} from '../types/onboarding'
import { onboardingService } from '../services/onboarding.services'
import type { ValidationResult } from '../utils/onboarding-validation'

export interface CalculatorConfig {
  currency: string
  appFeePercentage: number
}

// Default calculator start date — 8 months out, so providers see a realistic
// distance-from-today preview when the deposit-settings / payment-policies
// pages first render.
const computeDefaultCalcStartDate = (): CalendarDate | null => {
  const date = new Date()
  date.setMonth(date.getMonth() + 8)
  const dateString = date.toISOString().split('T')[0]
  if (!dateString) return null
  try {
    return parseDate(dateString)
  } catch {
    return null
  }
}

interface OnboardingStore {
  // State
  status: OnboardingStatus | null
  googleBusinessProfile: GoogleBusinessProfile | null
  searchResults: GoogleBusinessSearchResult[]
  documents: VerificationDocument[]
  validationResult: ValidationResult | null
  calculatorConfig: CalculatorConfig | null
  isCalculatorConfigLoading: boolean
  // Shared inputs for the deposit-settings + payment-policies preview
  // calculators. Held in the store so values persist when the user moves
  // between those two onboarding steps.
  calcPrice: number
  calcStartDate: CalendarDate | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchStatus: () => Promise<void>
  fetchCalculatorConfig: () => Promise<void>
  setCalcPrice: (price: number) => void
  setCalcStartDate: (date: CalendarDate | null) => void
  fetchGoogleBusinessProfile: () => Promise<void>
  searchGoogleBusiness: (query: string, lat?: number, lng?: number) => Promise<void>
  saveGoogleBusinessProfile: (
    placeId: string,
    legalInfo: {
      legalCompanyName: string
      legalStreetAddress: string
      legalAptSuite?: string
      legalCity: string
      legalStateProvince: string
      legalPostalCode: string
      legalCountry: string
      yearFounded: number
      providerPhone?: string
      providerEmail?: string
      website?: string
      currency: string
      timezone: string
    }
  ) => Promise<void>
  saveContactInfo: (data: ContactInfo) => Promise<void>
  saveCampInfo: (data: { description: string; campTypes: string[] }) => Promise<void>
  uploadDocument: (file: File, documentType: string, customTitle?: string) => Promise<void>
  fetchDocuments: () => Promise<void>
  deleteDocument: (documentId: string) => Promise<void>
  completeStep4: () => Promise<void>
  // C3 audit fix: return whether the save succeeded so callers can branch on
  // success vs. failure. Previously `saveDepositSettings` would throw on
  // failure while `saveProviderSettings` returned void silently — the
  // inconsistency caused dead try/catch in one page and silent navigation
  // past failures in the other. Both now consistently return `boolean` and
  // leave the human-readable error on `state.error` for the UI to render.
  saveDepositSettings: (data: SaveDepositSettingsRequest) => Promise<boolean>
  saveProviderSettings: (data: SaveProviderSettingsRequest) => Promise<boolean>
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
  calculatorConfig: null,
  isCalculatorConfigLoading: false,
  calcPrice: 2000,
  calcStartDate: computeDefaultCalcStartDate(),
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

  // Cached: only fetches once per session. Resolved values don't change while
  // the user is moving through onboarding, so subsequent calls (e.g. when the
  // user navigates back to deposit-settings or payment-policies) are no-ops.
  fetchCalculatorConfig: async () => {
    const { calculatorConfig, isCalculatorConfigLoading } = get()
    if (calculatorConfig !== null || isCalculatorConfigLoading) return

    set({ isCalculatorConfigLoading: true })
    try {
      const response = await onboardingService.getCalculatorConfig()
      if (response.success) {
        const data = response.data
        if (
          data &&
          typeof data.currency === 'string' &&
          typeof data.appFeePercentage === 'number'
        ) {
          set({
            calculatorConfig: { currency: data.currency, appFeePercentage: data.appFeePercentage },
          })
        }
      }
    } finally {
      set({ isCalculatorConfigLoading: false })
    }
  },

  setCalcPrice: (price: number) => set({ calcPrice: price }),
  setCalcStartDate: (date: CalendarDate | null) => set({ calcStartDate: date }),

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

  saveGoogleBusinessProfile: async (
    placeId: string,
    legalInfo: {
      legalCompanyName: string
      legalStreetAddress: string
      legalAptSuite?: string
      legalCity: string
      legalStateProvince: string
      legalPostalCode: string
      legalCountry: string
      yearFounded: number
      providerPhone?: string
      providerEmail?: string
      website?: string
      currency: string
      timezone: string
    }
  ) => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.saveGoogleBusinessProfile({
      placeId,
      ...legalInfo,
    })

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

  saveCampInfo: async (data: { description: string; campTypes: string[] }) => {
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

  uploadDocument: async (file: File, documentType: string, customTitle?: string) => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.uploadDocument({
      file,
      documentType: documentType as any,
      customTitle,
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

  saveDepositSettings: async (data: SaveDepositSettingsRequest): Promise<boolean> => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.saveDepositSettings(data)

    if (response.success) {
      await get().fetchStatus()
      set({ isLoading: false })
      return true
    }
    const errorMessage =
      'data' in response &&
      typeof response.data === 'object' &&
      response.data &&
      'message' in response.data
        ? String(response.data.message)
        : 'Failed to save deposit settings'
    set({ error: errorMessage, isLoading: false })
    return false
  },

  saveProviderSettings: async (data: SaveProviderSettingsRequest): Promise<boolean> => {
    set({ isLoading: true, error: null })
    const response = await onboardingService.saveProviderSettings(data)

    if (response.success) {
      await get().fetchStatus()
      set({ isLoading: false })
      return true
    }
    const errorMessage =
      'data' in response &&
      typeof response.data === 'object' &&
      response.data &&
      'message' in response.data
        ? String(response.data.message)
        : 'Failed to save settings'
    set({ error: errorMessage, isLoading: false })
    return false
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
