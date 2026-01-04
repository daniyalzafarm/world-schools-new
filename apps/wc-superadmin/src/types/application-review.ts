export type ApprovalStatus =
  | 'pending'
  | 'under_review'
  | 'info_requested'
  | 'approved'
  | 'rejected'
  | 'suspended'

export type DocumentReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_reupload'

export type DocumentType =
  | 'business_registration'
  | 'insurance_certificate'
  | 'tax_document'
  | 'other'

export interface ApplicationListItem {
  id: string
  businessName: string
  email: string
  legalCompanyName?: string
  contactFirstName?: string
  contactLastName?: string
  approvalStatus: ApprovalStatus
  trustScore?: number | null
  onboardingStartedAt?: string
  onboardingCompletedAt?: string | null
  createdAt: string
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

export interface TrustScoreBreakdown {
  totalScore: number
  breakdown: {
    googleBusinessProfile: {
      score: number
      maxScore: number
      details: any
    }
    verificationDocuments: {
      score: number
      maxScore: number
      details: any
    }
    businessAge: {
      score: number
      maxScore: number
      details: any
    }
    contactInformation: {
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
  phoneVerified: boolean
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
  contactFirstName?: string
  contactLastName?: string
  contactRole?: string
  contactPhone?: string
  contactPhoneCountryCode?: string
  legalCompanyName?: string
  legalStreetAddress?: string
  legalAptSuite?: string
  legalCity?: string
  legalStateProvince?: string
  legalPostalCode?: string
  legalCountry?: string
  yearFounded?: number
  googleBusinessProfile?: GoogleBusinessProfile | null
  documents: VerificationDocument[]
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
  notes?: string
  rejectionReason?: string
}
