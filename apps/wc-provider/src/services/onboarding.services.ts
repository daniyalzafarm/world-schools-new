import apiClient from '../utils/api-client'
import type {
  ContactInfo,
  GoogleBusinessProfile,
  GoogleBusinessSearchResult,
  OnboardingStatus,
  ProviderSettings,
  SaveGoogleBusinessProfileRequest,
  SaveProviderSettingsRequest,
  SearchGoogleBusinessRequest,
  UploadDocumentRequest,
  VerificationDocument,
} from '../types/onboarding'
import type { ValidationResult } from '../utils/onboarding-validation'

export const onboardingService = {
  /**
   * Get onboarding status
   */
  async getStatus(): Promise<OnboardingStatus> {
    const response = await apiClient.get<OnboardingStatus>('/provider/onboarding/status')
    return response.data as OnboardingStatus
  },

  /**
   * Search Google Business (Step 1)
   */
  async searchGoogleBusiness(
    request: SearchGoogleBusinessRequest
  ): Promise<GoogleBusinessSearchResult[]> {
    const response = await apiClient.post<GoogleBusinessSearchResult[]>(
      '/provider/onboarding/step-1/search',
      request
    )
    return response.data as GoogleBusinessSearchResult[]
  },

  /**
   * Get Google Business Profile (Step 1)
   */
  async getGoogleBusinessProfile(): Promise<GoogleBusinessProfile | null> {
    try {
      const response = await apiClient.get<GoogleBusinessProfile | null>(
        '/provider/onboarding/step-1/profile'
      )
      return response.data as GoogleBusinessProfile | null
    } catch {
      return null
    }
  },

  /**
   * Save Google Business Profile (Step 1)
   */
  async saveGoogleBusinessProfile(
    request: SaveGoogleBusinessProfileRequest
  ): Promise<GoogleBusinessProfile> {
    const response = await apiClient.post<GoogleBusinessProfile>(
      '/provider/onboarding/step-1/save',
      request
    )
    return response.data as GoogleBusinessProfile
  },

  /**
   * Get contact and legal info (Step 2)
   */
  async getContactInfo(): Promise<ContactInfo | null> {
    try {
      const response = await apiClient.get<ContactInfo | null>('/provider/onboarding/step-2/info')
      return (response.data as any)?.data || response.data
    } catch {
      return null
    }
  },

  /**
   * Save contact and legal info (Step 2)
   */
  async saveContactInfo(data: ContactInfo): Promise<void> {
    await apiClient.post('/provider/onboarding/step-2/save', data)
  },

  /**
   * Get camp info (Step 3)
   */
  async getCampInfo(): Promise<{
    description: string
    campTypes: string[]
    minAge: number
    maxAge: number
  } | null> {
    try {
      const response = await apiClient.get<{
        description: string
        campTypes: string[]
        minAge: number
        maxAge: number
      } | null>('/provider/onboarding/step-3/info')
      return (response.data as any)?.data || response.data
    } catch {
      return null
    }
  },

  /**
   * Save camp info (Step 3)
   */
  async saveCampInfo(data: {
    description: string
    campTypes: string[]
    minAge: number
    maxAge: number
  }): Promise<void> {
    await apiClient.post('/provider/onboarding/step-3/save', data)
  },

  /**
   * Upload document (Step 4)
   */
  async uploadDocument(request: UploadDocumentRequest): Promise<VerificationDocument> {
    const formData = new FormData()
    formData.append('file', request.file)
    formData.append('documentType', request.documentType)

    const response = await apiClient.post<VerificationDocument>(
      '/provider/onboarding/step-4/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )

    // Check if the upload was successful
    if (!response.success) {
      const errorMessage = (response.data as any)?.message || 'Failed to upload document'
      throw new Error(errorMessage)
    }

    return response.data as VerificationDocument
  },

  /**
   * Get uploaded documents (Step 4)
   */
  async getDocuments(): Promise<VerificationDocument[]> {
    const response = await apiClient.get<VerificationDocument[]>(
      '/provider/onboarding/step-4/documents'
    )
    return response.data as VerificationDocument[]
  },

  /**
   * Delete document (Step 4)
   */
  async deleteDocument(documentId: string): Promise<void> {
    const response = await apiClient.del(`/provider/onboarding/step-4/documents/${documentId}`)

    // Check if the deletion was successful
    if (!response.success) {
      const errorMessage = (response.data as any)?.message || 'Failed to delete document'
      throw new Error(errorMessage)
    }
  },

  /**
   * Complete Step 4 (advance to Step 5)
   */
  async completeStep4(): Promise<void> {
    await apiClient.post('/provider/onboarding/step-4/complete', {})
  },

  /**
   * Get provider settings (Step 5)
   */
  async getProviderSettings(): Promise<ProviderSettings | null> {
    try {
      const response = await apiClient.get<ProviderSettings | null>(
        '/provider/onboarding/step-5/settings'
      )
      return (response.data as any)?.data || response.data
    } catch {
      return null
    }
  },

  /**
   * Save provider settings (Step 5)
   */
  async saveProviderSettings(data: SaveProviderSettingsRequest): Promise<ProviderSettings> {
    const response = await apiClient.post<ProviderSettings>(
      '/provider/onboarding/step-5/save',
      data
    )
    return response.data as ProviderSettings
  },

  /**
   * Validate onboarding completion
   */
  async validateOnboarding(): Promise<ValidationResult> {
    const response = await apiClient.get<ValidationResult>('/provider/onboarding/validate')
    return response.data as ValidationResult
  },

  /**
   * Complete onboarding
   */
  async completeOnboarding(): Promise<void> {
    await apiClient.post('/provider/onboarding/complete', {})
  },

  /**
   * Get trust score breakdown (debug)
   */
  async getTrustScoreBreakdown(): Promise<{ score: number; breakdown: any }> {
    const response = await apiClient.get<{ score: number; breakdown: any }>(
      '/provider/onboarding/trust-score/breakdown'
    )
    return response.data as { score: number; breakdown: any }
  },
}
