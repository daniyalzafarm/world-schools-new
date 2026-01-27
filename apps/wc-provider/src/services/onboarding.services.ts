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
      '/provider/onboarding/find-your-camp/search',
      request
    )
  },

  /**
   * Get Google Business Profile (Step 1)
   */
  async getGoogleBusinessProfile(): Promise<ApiResult<GoogleBusinessProfile | null>> {
    return await apiClient.get<GoogleBusinessProfile | null>(
      '/provider/onboarding/find-your-camp/profile'
    )
  },

  /**
   * Save Google Business Profile (Step 1)
   */
  async saveGoogleBusinessProfile(
    request: SaveGoogleBusinessProfileRequest
  ): Promise<ApiResult<GoogleBusinessProfile>> {
    return await apiClient.post<GoogleBusinessProfile>(
      '/provider/onboarding/find-your-camp/save',
      request
    )
  },

  /**
   * Get contact and legal info (Step 2)
   */
  async getContactInfo(): Promise<ApiResult<ContactInfo | null>> {
    return await apiClient.get<ContactInfo | null>('/provider/onboarding/contact/info')
  },

  /**
   * Save contact and legal info (Step 2)
   */
  async saveContactInfo(data: ContactInfo): Promise<ApiResult<void>> {
    return await apiClient.post('/provider/onboarding/contact/save', data)
  },

  /**
   * Get camp info (Step 3)
   */
  async getCampInfo(): Promise<
    ApiResult<{
      description: string
      campTypes: string[]
    } | null>
  > {
    return await apiClient.get<{
      description: string
      campTypes: string[]
    } | null>('/provider/onboarding/about-your-camp/info')
  },

  /**
   * Save camp info (Step 3)
   */
  async saveCampInfo(data: { description: string; campTypes: string[] }): Promise<ApiResult<void>> {
    return await apiClient.post('/provider/onboarding/about-your-camp/save', data)
  },

  /**
   * Upload document (Step 4)
   */
  async uploadDocument(request: UploadDocumentRequest): Promise<ApiResult<VerificationDocument>> {
    const formData = new FormData()
    formData.append('file', request.file)
    formData.append('documentType', request.documentType)
    if (request.customTitle) {
      formData.append('customTitle', request.customTitle)
    }

    return await apiClient.post<VerificationDocument>(
      '/provider/onboarding/verification/upload',
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
    return await apiClient.get<VerificationDocument[]>(
      '/provider/onboarding/verification/documents'
    )
  },

  /**
   * Delete document (Step 4)
   */
  async deleteDocument(documentId: string): Promise<ApiResult<void>> {
    return await apiClient.del(`/provider/onboarding/verification/documents/${documentId}`)
  },

  /**
   * Complete Step 4 (advance to Step 5)
   */
  async completeStep4(): Promise<ApiResult<void>> {
    return await apiClient.post('/provider/onboarding/verification/complete', {})
  },

  /**
   * Get provider settings (Step 5)
   */
  async getProviderSettings(): Promise<ApiResult<ProviderSettings | null>> {
    return await apiClient.get<ProviderSettings | null>(
      '/provider/onboarding/payment-policies/settings'
    )
  },

  /**
   * Save provider settings (Step 5)
   */
  async saveProviderSettings(
    data: SaveProviderSettingsRequest
  ): Promise<ApiResult<ProviderSettings>> {
    return await apiClient.post<ProviderSettings>(
      '/provider/onboarding/payment-policies/save',
      data
    )
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
