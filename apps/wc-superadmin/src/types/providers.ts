import type { ApprovalStatus, ProviderSettings, VerificationDocument } from './application-review'

export interface ProviderCampSummary {
  id: string
  slug: string
  name: string
  type: string
  status: string
  ageGroups: unknown
  _count: {
    sessions: number
    bookingGroups: number
  }
}

export interface ProviderRecentBooking {
  id: string
  bookingGroupNumber: string
  parent: {
    user: {
      firstName: string | null
      lastName: string | null
    }
  }
  camp: {
    name: string
  }
  session: {
    name: string
    startDate: string
    endDate: string
  }
  totalAmount: number
  status: string
  requestedAt: string
}

export interface ProviderStats {
  activeCampsCount: number
  totalSessionsCount: number
  totalBookingsCount: number
  totalRevenue: number
  averageRating: number | null
  reviewsCount: number
}

export interface ProviderDetail {
  id: string
  businessName: string
  legalCompanyName: string | null
  logoUrl: string | null
  email: string | null
  phone: string | null
  website: string | null
  description: string | null
  legalCity: string | null
  legalStateProvince: string | null
  legalCountry: string | null
  legalStreetAddress: string | null
  legalAptSuite: string | null
  legalPostalCode: string | null
  yearFounded: number | null
  approvalStatus: ApprovalStatus
  trustScore: number | null
  createdAt: string
  lastLoginAt: string | null
  approvalDecisionAt: string | null
  contactFirstName: string | null
  contactLastName: string | null
  contactEmail: string | null
  contactPhone: string | null
  contactRole: string | null
  owner: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }
  settings: ProviderSettings | null
  verificationDocuments: VerificationDocument[]
  camps: ProviderCampSummary[]
  bookingGroups: ProviderRecentBooking[]
  _count: {
    camps: number
    bookingGroups: number
  }
  stats: ProviderStats
}
