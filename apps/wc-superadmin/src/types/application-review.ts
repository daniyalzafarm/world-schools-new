import type { OperationalStatus as OperationalStatusType } from '@world-schools/wc-types'

export type ApprovalStatus =
  | 'pending'
  | 'under_review'
  | 'info_requested'
  | 'approved'
  | 'rejected'
  | 'suspended'

/** Re-exported from `@world-schools/wc-types` for convenience. */
export { OperationalStatus, OPERATIONAL_STATUS_LABELS } from '@world-schools/wc-types'

export type DocumentReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_reupload'

export type DocumentType =
  | 'business_registration'
  | 'insurance_certificate'
  | 'tax_document'
  | 'other'

/// Underlying conditions that produced `operationalStatus`. Returned by the
/// API so the SuperAdmin tooltip can render "✓ Stripe connected, ✗ No
/// published sessions" without re-deriving the checks on the frontend.
export interface OperationalStatusReasons {
  stripeConnected: boolean
  publishedCampCount: number
  publishedSessionCount: number
  hasRecentFailedPayout: boolean
  /// ISO 8601 timestamp of the most recent provider login. Null when no
  /// one tied to the provider has logged in. The tooltip derives both
  /// the absolute datetime and the relative offset from this field.
  lastLoginAt: string | null
}

export interface ApplicationListItem {
  id: string
  businessName: string
  email: string
  legalCompanyName?: string
  contactFirstName?: string
  contactLastName?: string
  approvalStatus: ApprovalStatus
  trustScore?: number | null
  /// Computed by the API only for approved providers.
  /// Null on rejected/suspended/pending rows so the column renders empty.
  operationalStatus?: OperationalStatusType | null
  /// Per-provider checklist powering the operational-status tooltip.
  /// Null on non-approved rows for symmetry with `operationalStatus`.
  operationalStatusReasons?: OperationalStatusReasons | null
  onboardingStartedAt?: string
  onboardingCompletedAt?: string | null
  createdAt: string
  logoUrl?: string | null
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
  reviewedByAdminId?: string | null
  reviewNotes?: string | null
  rejectionReason?: string | null
}

export interface ProviderSettings {
  id: string
  currency: string
  timezone: string
  depositRequired: boolean
  depositType?: string | null
  depositPercentage?: number | null
  depositFixedAmount?: number | null
  cancellationPolicy: string
  cancellationPolicyCustom?: string | null
}

export interface AdminSummary {
  id: string
  firstName?: string | null
  lastName?: string | null
  email: string
}

export interface TrustScoreBreakdown {
  totalScore: number
  breakdown: {
    googleBusinessProfile: {
      score: number
      maxScore: number
      details: any
    }
    legalInformation: {
      score: number
      maxScore: number
      details: any
    }
    businessAge: {
      score: number
      maxScore: number
      details: any
    }
    campProfile: {
      score: number
      maxScore: number
      details: any
    }
    verificationDocuments: {
      score: number
      maxScore: number
      details: any
    }
    paymentPolicies: {
      score: number
      maxScore: number
      details: any
    }
  }
  recommendedAction: string
  label: string
}

export interface ApplicationDetail {
  id: string
  businessName: string
  email: string
  emailVerified: boolean
  approvalStatus: ApprovalStatus
  trustScore?: number | null
  trustScoreBreakdown?: TrustScoreBreakdown | null
  rejectionReason?: string | null
  rejectionCategory?: string | null
  approvalDecisionAt?: string | null
  approvedByAdminId?: string | null
  onboardingStartedAt?: string
  onboardingCompletedAt?: string | null
  createdAt: string
  ownerFirstName?: string | null
  ownerLastName?: string | null
  ownerEmail?: string
  contactFirstName?: string
  contactLastName?: string
  contactRole?: string
  contactPhone?: string
  contactEmail?: string
  providerPhone?: string
  providerEmail?: string
  website?: string
  legalCompanyName?: string
  legalStreetAddress?: string
  legalAptSuite?: string
  legalCity?: string
  legalStateProvince?: string
  legalPostalCode?: string
  legalCountry?: string
  yearFounded?: number
  googleBusinessProfile?: GoogleBusinessProfile | null
  verificationDocuments: VerificationDocument[]
  settings?: ProviderSettings | null
}

export interface GetApplicationsQuery {
  page?: number
  limit?: number
  status?: ApprovalStatus
  search?: string
  minTrustScore?: number
  maxTrustScore?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface GetApplicationsResponse {
  data: ApplicationListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApproveApplicationRequest {
  notes?: string
}

export interface RejectApplicationRequest {
  reason: string
  category: string
  notes?: string
}

export interface RequestInfoRequest {
  message: string
  fieldsNeeded?: string[]
}

export interface ReviewDocumentRequest {
  reviewStatus: DocumentReviewStatus
  reviewNotes?: string
  rejectionReason?: string
}
