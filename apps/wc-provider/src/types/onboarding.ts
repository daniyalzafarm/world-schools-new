export type ApprovalStatus =
  | 'pending'
  | 'under_review'
  | 'info_requested'
  | 'approved'
  | 'rejected'
  | 'suspended'

export type DocumentType =
  // Required documents
  | 'business_registration'
  | 'insurance_certificate'
  // Accreditations
  | 'aca'
  | 'icf'
  | 'bsa'
  | 'national_accreditation'
  | 'regional_accreditation'
  | 'other_accreditation'
  // Safety certifications
  | 'risk_policy'
  | 'first_aid'
  | 'lifeguard'
  | 'background_check'
  | 'emergency_plan'
  | 'food_safety'
  | 'other_safety'

export type DocumentReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_reupload'

import type { CancellationPolicySpecialCircumstance } from '@world-schools/wc-types'

export type { CancellationPolicySpecialCircumstance }

export type DepositType = 'percentage' | 'fixed_amount'

export type CancellationPolicy = 'flexible' | 'moderate' | 'strict' | 'super_strict' | 'custom'

export interface TrustScoreBreakdown {
  // Step 1: Google Business Profile (max 30 pts)
  hasGoogleBusiness?: number // 10 pts
  googleRating?: number // 0-15 pts
  googleReviews?: number // 0-5 pts

  // Step 2: Legal Info + Business Age (max 30 pts)
  legalInfoComplete?: number // 15 pts
  businessAge?: number // 0-15 pts

  // Step 3: Camp Profile (max 10 pts)
  descriptionComplete?: number // 4 pts
  campTypeSelected?: number // 2 pts
  ageRangeDefined?: number // 4 pts

  // Step 4: Document Verification (max 20 pts base + up to 30 pts bonus)
  businessRegistration?: number // 10 pts (required)
  insuranceCertificate?: number // 10 pts (required)
  acaAccreditation?: number // 5 pts (optional)
  icfAccreditation?: number // 5 pts (optional)
  otherAccreditations?: number // up to 10 pts (optional)
  safetyCertifications?: number // up to 15 pts (optional)

  // Step 5: Payment & Policies (max 10 pts)
  depositConfigured?: number // 5 pts
  cancellationPolicy?: number // 0-5 pts
}

export interface OnboardingStatus {
  currentStep: number
  isCompleted: boolean
  onboardingStartedAt?: string
  onboardingCompletedAt?: string | null
  approvalStatus: ApprovalStatus
  trustScore?: number | null
  trustScoreBreakdown?: TrustScoreBreakdown | null
  rejectionReason?: string | null
  rejectionCategory?: string | null
  stepCompletion: {
    step1: boolean
    step2: boolean
    step3: boolean
    step4: boolean
    step5: boolean
    step6: boolean
    step7: boolean
  }
  termsAcceptedAt?: string | null
  termsVersion?: string | null
  providerAgreementAcceptedAt?: string | null
  providerAgreementVersion?: string | null
  // Stripe Connect
  stripeOnboardingCompleted: boolean
  stripeOnboardingSkippedAt?: string | null
  stripeChargesEnabled: boolean
  stripePayoutsEnabled: boolean
  stripeCommissionPercentage?: number | null
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
  // Address components for auto-filling legal business info
  streetNumber?: string
  streetName?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string // Full country name (e.g., "Pakistan", "United States")
  countryCode?: string // ISO 2-letter country code (e.g., "PK", "US", "CH")
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
  legalInfo?: {
    legalCompanyName: string | null
    legalStreetAddress: string | null
    legalAptSuite: string | null
    legalCity: string | null
    legalStateProvince: string | null
    legalPostalCode: string | null
    legalCountry: string | null
    yearFounded: number | null
    providerPhone: string | null
    providerEmail: string | null
    website: string | null
    currency: string | null
    timezone: string | null
  } | null
}

export interface ContactInfo {
  contactFirstName: string
  contactLastName: string
  contactRole: string
  contactPhone: string // E.164 format phone number (e.g., "+12133734253")
  contactEmail: string
}

export interface LegalBusinessInfo {
  legalCompanyName: string
  legalStreetAddress: string
  legalAptSuite?: string
  legalCity: string
  legalStateProvince: string
  legalPostalCode: string
  legalCountry: string
  yearFounded: number
  providerPhone?: string // E.164 format phone number (optional)
  providerEmail?: string
  website?: string
  currency: string
  timezone: string
}

export interface VerificationDocument {
  id: string
  documentType: DocumentType
  customTitle?: string | null
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
  cancellationPolicySpecialCircumstances?: CancellationPolicySpecialCircumstance[] | null
  cancellationPolicyAgreedAt?: string | null
}

export interface SearchGoogleBusinessRequest {
  query: string
  lat?: number
  lng?: number
}

export interface SaveGoogleBusinessProfileRequest {
  placeId: string
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

export interface UploadDocumentRequest {
  file: File
  documentType: DocumentType
  customTitle?: string
}

export interface SaveDepositSettingsRequest {
  depositRequired: boolean
  depositType?: 'percentage' | 'fixed' | null // Backend expects 'fixed', not 'fixed_amount'
  depositPercentage?: number | null
  depositFixedAmount?: number | null
}

export interface SaveProviderSettingsRequest {
  cancellationPolicy: CancellationPolicy
  cancellationPolicyCustom?: Record<string, unknown> | null
  cancellationPolicySpecialCircumstances?: CancellationPolicySpecialCircumstance[] | null
  termsAgreed?: boolean
}
