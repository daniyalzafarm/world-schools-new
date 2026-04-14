import type { AgeGroup, BaseCampStatus, CampPhoto, CampType, Gender } from '@world-schools/wc-types'

// Re-export shared primitives used in admin views
export type { AgeGroup, CampPhoto, CampType, Gender }

/**
 * Admin-specific camp status — extends the shared base with moderation states.
 * wc-booking and wc-provider only use BaseCampStatus ('draft' | 'published' | 'archived').
 */
export type AdminCampStatus = BaseCampStatus | 'pending_review' | 'suspended'

export interface CampFilters {
  search?: string
  status?: AdminCampStatus
  providerId?: string
  category?: string
  country?: string
}

export interface CampSummary {
  id: string
  name: string
  status: AdminCampStatus
  providerName: string
  providerId: string
  location: string
  coverImageUrl: string | null
  ageGroups: AgeGroup[]
  averageRating: number | null
  totalBookings: number
  sessionsCount: number
}

export interface CampStats {
  totalCamps: number
  published: number
  draft: number
  pendingReview: number
  suspended: number
  archived: number
}

export interface CampUpcomingSession {
  id: string
  name: string
  startDate: string
  endDate: string
  capacity: number
  enrolled: number
  status: 'upcoming' | 'full' | 'active'
}

export interface CampDetail {
  id: string
  name: string
  status: AdminCampStatus
  type: CampType
  gender: Gender
  isFeatured: boolean
  isVerified: boolean
  providerName: string
  providerId: string
  providerMemberSince: string
  providerCampsCount: number
  providerAvgRating: number | null
  location: string
  ageGroups: AgeGroup[]
  priceMin: number | null
  priceMax: number | null
  sessionsCount: number
  totalBookings: number
  averageRating: number | null
  totalRevenue: number
  avgOccupancy: number | null
  description: string | null
  primaryFocus: string[]
  keyActivities: string[]
  photos: CampPhoto[]
  createdAt: string
  upcomingSessions: CampUpcomingSession[]
  ratingsDistribution: { stars: number; count: number }[]
  totalReviews: number
}

export interface GetCampsResponse {
  data: CampSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface GetCampsQuery extends CampFilters {
  page?: number
  limit?: number
}

// ─── Tab-level paginated sub-resources ────────────────────────────────────

export interface PaginatedCampSubResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CampSessionItem {
  id: string
  name: string
  startDate: string
  endDate: string
  price: number
  pricingType: string
  totalSpots: number
  enrolledCount: number
  status: 'draft' | 'published'
}

export interface CampBookingItem {
  id: string
  bookingGroupNumber: string
  sessionId: string
  sessionName: string
  sessionStartDate: string
  sessionEndDate: string
  parentName: string
  childrenCount: number
  totalAmount: number
  status: string
  requestedAt: string
}

export interface CampReviewItem {
  id: string
  parentName: string
  happinessRating: number | null
  reviewText: string | null
  status: string
  visitMonth: number | null
  visitYear: number | null
  createdAt: string
  returnChoice: string | null
  kidCount: number
}
