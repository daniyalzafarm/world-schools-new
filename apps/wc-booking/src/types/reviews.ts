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
  editedAt?: string | null
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

/** API/Prisma returns flat `*Rating` fields; UI uses nested `ratings`. */
export function normalizeCampReviewFromApi(raw: unknown): CampReview {
  if (raw == null || typeof raw !== 'object') {
    throw new TypeError('normalizeCampReviewFromApi: expected a review object')
  }
  const r = raw as Record<string, unknown> & {
    ratings?: ReviewRatings
    visit?: ReviewVisit
    tags?: ReviewTag[]
    photos?: string[]
    outcomes?: string[]
    happinessRating?: number | null
    safetyRating?: number | null
    communicationRating?: number | null
    asDescribedRating?: number | null
    growthRating?: number | null
    valueRating?: number | null
    visitMonth?: number | null
    visitYear?: number | null
    kidCount?: number | null
    kidAges?: number[]
    kidTags?: string[]
  }

  const ratings: ReviewRatings = {
    happiness: r.ratings?.happiness ?? r.happinessRating ?? undefined,
    safety: r.ratings?.safety ?? r.safetyRating ?? undefined,
    communication: r.ratings?.communication ?? r.communicationRating ?? undefined,
    asDescribed: r.ratings?.asDescribed ?? r.asDescribedRating ?? undefined,
    growth: r.ratings?.growth ?? r.growthRating ?? undefined,
    value: r.ratings?.value ?? r.valueRating ?? undefined,
  }

  const visit: ReviewVisit | undefined =
    r.visit ??
    (r.visitMonth != null ||
    r.visitYear != null ||
    r.kidCount != null ||
    (r.kidAges?.length ?? 0) > 0 ||
    (r.kidTags?.length ?? 0) > 0
      ? {
          month: r.visitMonth ?? undefined,
          year: r.visitYear ?? undefined,
          kidCount: r.kidCount ?? undefined,
          kidAges: r.kidAges,
          kidTags: r.kidTags,
        }
      : undefined)

  const {
    happinessRating: _h,
    safetyRating: _s,
    communicationRating: _c,
    asDescribedRating: _a,
    growthRating: _g,
    valueRating: _v,
    visitMonth: _vm,
    visitYear: _vy,
    kidCount: _kc,
    kidAges: _ka,
    kidTags: _kt,
    ratings: _flatRatingsDrop,
    visit: _flatVisitDrop,
    tags: tagList,
    photos: photoList,
    outcomes: outcomeList,
    ...rest
  } = r

  return {
    ...(rest as Omit<CampReview, 'ratings' | 'visit' | 'tags' | 'photos' | 'outcomes'>),
    ratings,
    visit,
    tags: Array.isArray(tagList) ? tagList : [],
    photos: Array.isArray(photoList) ? photoList : [],
    outcomes: Array.isArray(outcomeList) ? outcomeList : [],
  }
}

// Compute overall average rating from a CampReview
export function computeAvgRating(review: CampReview): number {
  const ratings = review.ratings ?? {}
  const values = [
    ratings.happiness,
    ratings.safety,
    ratings.communication,
    ratings.asDescribed,
    ratings.growth,
    ratings.value,
  ].filter((v): v is number => v != null)
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}
