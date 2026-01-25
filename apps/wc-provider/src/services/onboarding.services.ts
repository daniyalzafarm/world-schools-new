import apiClient, { type ApiResult } from '../utils/api-client'
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
  async getStatus(): Promise<ApiResult<OnboardingStatus>> {
    return await apiClient.get<OnboardingStatus>('/provider/onboarding/status')
  },

  /**
   * Search Google Business (Step 1)
   */
  async searchGoogleBusiness(
    request: SearchGoogleBusinessRequest
  ): Promise<ApiResult<GoogleBusinessSearchResult[]>> {
    return await apiClient.post<GoogleBusinessSearchResult[]>(
      '/provider/onboarding/step-1/search',
      request
    )
  },

  /**
   * Get Google Business Profile (Step 1)
   */
  async getGoogleBusinessProfile(): Promise<ApiResult<GoogleBusinessProfile | null>> {
    return await apiClient.get<GoogleBusinessProfile | null>('/provider/onboarding/step-1/profile')
  },

  /**
   * Save Google Business Profile (Step 1)
   */
  async saveGoogleBusinessProfile(
    request: SaveGoogleBusinessProfileRequest
  ): Promise<ApiResult<GoogleBusinessProfile>> {
    return await apiClient.post<GoogleBusinessProfile>('/provider/onboarding/step-1/save', request)
  },

  /**
   * Get contact and legal info (Step 2)
   */
  async getContactInfo(): Promise<ApiResult<ContactInfo | null>> {
    return await apiClient.get<ContactInfo | null>('/provider/onboarding/step-2/info')
  },

  /**
   * Save contact and legal info (Step 2)
   */
  async saveContactInfo(data: ContactInfo): Promise<ApiResult<void>> {
    return await apiClient.post('/provider/onboarding/step-2/save', data)
  },

  /**
   * Get camp info (Step 3)
   */
  async getCampInfo(): Promise<
    ApiResult<{
      description: string
      campTypes: string[]
      minAge: number
      maxAge: number
    } | null>
  > {
    return await apiClient.get<{
      description: string
      campTypes: string[]
      minAge: number
      maxAge: number
    } | null>('/provider/onboarding/step-3/info')
  },

  /**
   * Save camp info (Step 3)
   */
  async saveCampInfo(data: {
    description: string
    campTypes: string[]
    minAge: number
    maxAge: number
  }): Promise<ApiResult<void>> {
    return await apiClient.post('/provider/onboarding/step-3/save', data)
  },

  /**
   * Upload document (Step 4)
   */
  async uploadDocument(request: UploadDocumentRequest): Promise<ApiResult<VerificationDocument>> {
    const formData = new FormData()
    formData.append('file', request.file)
    formData.append('documentType', request.documentType)

    return await apiClient.post<VerificationDocument>(
      '/provider/onboarding/step-4/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
  },

  /**
   * Get uploaded documents (Step 4)
   */
  async getDocuments(): Promise<ApiResult<VerificationDocument[]>> {
    return await apiClient.get<VerificationDocument[]>('/provider/onboarding/step-4/documents')
  },

  /**
   * Delete document (Step 4)
   */
  async deleteDocument(documentId: string): Promise<ApiResult<void>> {
    return await apiClient.del(`/provider/onboarding/step-4/documents/${documentId}`)
  },

  /**
   * Complete Step 4 (advance to Step 5)
   */
  async completeStep4(): Promise<ApiResult<void>> {
    return await apiClient.post('/provider/onboarding/step-4/complete', {})
  },

  /**
   * Get provider settings (Step 5)
   */
  async getProviderSettings(): Promise<ApiResult<ProviderSettings | null>> {
    return await apiClient.get<ProviderSettings | null>('/provider/onboarding/step-5/settings')
  },

  /**
   * Save provider settings (Step 5)
   */
  async saveProviderSettings(
    data: SaveProviderSettingsRequest
  ): Promise<ApiResult<ProviderSettings>> {
    return await apiClient.post<ProviderSettings>('/provider/onboarding/step-5/save', data)
  },

  /**
   * Validate onboarding completion
   */
  async validateOnboarding(): Promise<ApiResult<ValidationResult>> {
    return await apiClient.get<ValidationResult>('/provider/onboarding/validate')
  },

  /**
   * Complete onboarding
   */
  async completeOnboarding(): Promise<ApiResult<void>> {
    return await apiClient.post('/provider/onboarding/complete', {})
  },

  /**
   * Get trust score breakdown (debug)
   */
  async getTrustScoreBreakdown(): Promise<ApiResult<{ score: number; breakdown: any }>> {
    return await apiClient.get<{ score: number; breakdown: any }>(
      '/provider/onboarding/trust-score/breakdown'
    )
  },
}
