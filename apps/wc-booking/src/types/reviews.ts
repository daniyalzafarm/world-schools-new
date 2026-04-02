import type { ReviewStatus, ReviewTagDimension } from '@world-schools/wc-types'

export type { ReviewStatus, ReviewTagDimension }

export interface ReviewTag {
  id: string
  dimension: ReviewTagDimension
  tagValue: string
}

export interface ReviewRatings {
  happiness?: number
  safety?: number
  communication?: number
  asDescribed?: number
  growth?: number
  value?: number
}

export interface ReviewVisit {
  month?: number
  year?: number
  kidCount?: number
  kidAges?: number[]
  kidTags?: string[]
}

export interface CampReviewResponse {
  id: string
  responseText: string
  createdAt: string
  updatedAt: string
}

export interface ReviewCamp {
  id: string
  name: string
  locationName?: string | null
  photos?: unknown
  slug: string
}

export interface CampReview {
  id: string
  campId: string
  parentId: string
  bookingGroupId?: string | null
  bookingId?: string | null
  visit?: ReviewVisit
  ratings: ReviewRatings
  tags: ReviewTag[]
  reviewText?: string | null
  photos: string[]
  returnChoice?: boolean | null
  outcomes: string[]
  status: ReviewStatus
  helpfulCount: number
  response?: CampReviewResponse | null
  camp: ReviewCamp
  createdAt: string
  updatedAt: string
  submittedAt?: string | null
  publishedAt?: string | null
}

export interface EligibleCamp {
  id: string
  name: string
  locationName?: string | null
  photos?: unknown
  slug: string
  attended?: {
    date: string
    bookingGroupId: string
    bookingId: string
  }
  avgRating?: number
  reviewCount?: number
}

export interface CreateReviewPayload {
  campId: string
  bookingGroupId?: string
  bookingId?: string
  visitMonth?: number
  visitYear?: number
  kidCount?: number
  kidAges?: number[]
  kidTags?: string[]
  happinessRating?: number
  safetyRating?: number
  communicationRating?: number
  asDescribedRating?: number
  growthRating?: number
  valueRating?: number
  tags?: { dimension: ReviewTagDimension; tagValue: string }[]
  reviewText?: string
  photos?: string[]
  returnChoice?: boolean
  outcomes?: string[]
  status: 'draft' | 'pending'
}

export interface UpdateReviewPayload extends Partial<Omit<CreateReviewPayload, 'campId'>> {}

// Compute overall average rating from a CampReview
export function computeAvgRating(review: CampReview): number {
  const values = [
    review.ratings.happiness,
    review.ratings.safety,
    review.ratings.communication,
    review.ratings.asDescribed,
    review.ratings.growth,
    review.ratings.value,
  ].filter((v): v is number => v != null)
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}
