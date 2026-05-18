import apiClient, { type ApiResult } from '../utils/api-client'
import type {
  CancellationPolicySpecialCircumstance,
  ContactInfo,
  GoogleBusinessProfile,
  GoogleBusinessSearchResult,
  LegalBusinessInfo,
  OnboardingStatus,
  SaveDepositSettingsRequest,
  SaveGoogleBusinessProfileRequest,
  SaveProviderSettingsRequest,
  SearchGoogleBusinessRequest,
  UploadDocumentRequest,
  VerificationDocument,
} from '../types/onboarding'
import type { ValidationResult } from '../utils/onboarding-validation'

type ProviderSettingsResponse = {
  cancellationPolicy: string
  cancellationPolicyCustom?: Record<string, unknown> | null
  cancellationPolicySpecialCircumstances?: CancellationPolicySpecialCircumstance[] | null
  cancellationPolicyAgreedAt?: string | null
}

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
   * Update company details without changing the Google Business Profile.
   * Works for both onboarded and CSV-imported providers (no placeId required).
   */
  async updateCompanyDetails(data: LegalBusinessInfo): Promise<ApiResult<null>> {
    return await apiClient.patch<null>('/provider/onboarding/find-your-camp/legal-info', data)
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
   * Get deposit settings (Step 5)
   */
  async getDepositSettings(): Promise<
    ApiResult<{
      depositRequired: boolean
      depositType?: 'percentage' | 'fixed' | null
      depositPercentage?: number | null
      depositFixedAmount?: number | null
    } | null>
  > {
    return await apiClient.get<{
      depositRequired: boolean
      depositType?: 'percentage' | 'fixed' | null
      depositPercentage?: number | null
      depositFixedAmount?: number | null
    } | null>('/provider/onboarding/deposit-settings/info')
  },

  /**
   * Save deposit settings (Step 5) - automatically advances to Step 6
   */
  async saveDepositSettings(data: SaveDepositSettingsRequest): Promise<
    ApiResult<{
      depositRequired: boolean
      depositType?: 'percentage' | 'fixed' | null
      depositPercentage?: number | null
      depositFixedAmount?: number | null
    }>
  > {
    return await apiClient.post<{
      depositRequired: boolean
      depositType?: 'percentage' | 'fixed' | null
      depositPercentage?: number | null
      depositFixedAmount?: number | null
    }>('/provider/onboarding/deposit-settings/save', data)
  },

  /**
   * Get provider settings (Step 6 - Cancellation Policy only)
   */
  async getProviderSettings(): Promise<ApiResult<ProviderSettingsResponse | null>> {
    return await apiClient.get<ProviderSettingsResponse | null>(
      '/provider/onboarding/payment-policies/settings'
    )
  },

  /**
   * Save provider settings (Step 6 - Cancellation Policy only)
   */
  async saveProviderSettings(
    data: SaveProviderSettingsRequest
  ): Promise<ApiResult<ProviderSettingsResponse>> {
    return await apiClient.post<ProviderSettingsResponse>(
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

  /**
   * Calculator config — currency + app fee percentage to drive the
   * deposit-settings + payment-policies preview calculators. Sourced from
   * `Provider.appFeePercentage` (snapshotted at Stripe Connect
   * onboarding) with fallback to `SystemSettings.defaultAppFee`.
   *
   * Replaces the prior hardcoded `0.1` / `€` / `$` literals on those pages.
   */
  async getCalculatorConfig(): Promise<ApiResult<{ currency: string; appFeePercentage: number }>> {
    return await apiClient.get<{ currency: string; appFeePercentage: number }>(
      '/provider/onboarding/calculator-config'
    )
  },

  /**
   * Get provider logo URL
   */
  async getProviderLogo(): Promise<ApiResult<{ logoUrl: string | null }>> {
    return await apiClient.get<{ logoUrl: string | null }>('/provider/onboarding/logo')
  },

  /**
   * Upload provider logo
   */
  async uploadProviderLogo(file: File): Promise<ApiResult<{ logoUrl: string }>> {
    const formData = new FormData()
    formData.append('logo', file)

    return await apiClient.patch<{ logoUrl: string }>('/provider/onboarding/logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  /**
   * Delete provider logo
   */
  async deleteProviderLogo(): Promise<ApiResult<void>> {
    return await apiClient.del('/provider/onboarding/logo')
  },
}
