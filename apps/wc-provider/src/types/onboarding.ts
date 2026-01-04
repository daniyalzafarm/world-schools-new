export type ApprovalStatus =
  | 'pending'
  | 'under_review'
  | 'info_requested'
  | 'approved'
  | 'rejected'
  | 'suspended'

export type DocumentType =
  | 'business_registration'
  | 'insurance_certificate'
  | 'tax_document'
  | 'other'

export type DocumentReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_reupload'

export type DepositType = 'percentage' | 'fixed_amount'

export type CancellationPolicy = 'flexible' | 'moderate' | 'strict' | 'super_strict' | 'custom'

export interface OnboardingStatus {
  currentStep: number
  isCompleted: boolean
  onboardingStartedAt?: string
  onboardingCompletedAt?: string | null
  approvalStatus: ApprovalStatus
  trustScore?: number | null
  rejectionReason?: string | null
  rejectionCategory?: string | null
  stepCompletion: {
    step1: boolean
    step2: boolean
    step3: boolean
    step4: boolean
    step5: boolean
    step6: boolean
  }
  termsAcceptedAt?: string | null
  termsVersion?: string | null
  providerAgreementAcceptedAt?: string | null
  providerAgreementVersion?: string | null
}

export interface GoogleBusinessSearchResult {
  placeId: string
  businessName: string
  formattedAddress: string
  lat: number
  lng: number
  rating?: number
  reviewsCount?: number
  phone?: string
  website?: string
  photos?: string[]
  types?: string[]
}

export interface GoogleBusinessProfile {
  id: string
  placeId: string
  businessName: string
  formattedAddress: string
  lat: number
  lng: number
  rating?: number
  reviewsCount?: number
  phone?: string
  website?: string
  photos?: string[]
  types?: string[]
  streetNumber?: string
  streetName?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface ContactInfo {
  contactFirstName: string
  contactLastName: string
  contactRole: string
  contactPhone: string
  contactPhoneCountryCode: string
  legalCompanyName: string
  legalStreetAddress: string
  legalAptSuite?: string
  legalCity: string
  legalStateProvince: string
  legalPostalCode: string
  legalCountry: string
  yearFounded: number
}

export interface VerificationDocument {
  id: string
  documentType: DocumentType
  fileUrl: string
  fileName: string
  fileSizeBytes: number
  mimeType: string
  reviewStatus: DocumentReviewStatus
  uploadedAt: string
  reviewedAt?: string | null
  reviewNotes?: string | null
  rejectionReason?: string | null
}

export interface ProviderSettings {
  id: string
  currency: string
  timezone: string
  depositRequired: boolean
  depositType?: 'percentage' | 'fixed' | null // Backend uses 'fixed', not 'fixed_amount'
  depositPercentage?: number | null
  depositFixedAmount?: number | null
  cancellationPolicy: CancellationPolicy
  cancellationPolicyCustom?: string | null
}

export interface SearchGoogleBusinessRequest {
  query: string
  lat?: number
  lng?: number
}

export interface SaveGoogleBusinessProfileRequest {
  placeId: string
}

export interface UploadDocumentRequest {
  file: File
  documentType: DocumentType
}

export interface SaveProviderSettingsRequest {
  currency: string
  timezone: string
  depositRequired: boolean
  depositType?: 'percentage' | 'fixed' | null // Backend expects 'fixed', not 'fixed_amount'
  depositPercentage?: number | null
  depositFixedAmount?: number | null
  cancellationPolicy: CancellationPolicy
  cancellationPolicyCustom?: string | null
}
