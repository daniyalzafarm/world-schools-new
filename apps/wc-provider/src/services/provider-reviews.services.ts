export type ProviderReviewStatus = 'draft' | 'pending' | 'published' | 'rejected'

export interface ProviderReviewSummary {
  id: string
  campId: string
  campName: string
  parent: {
    displayName: string
    profilePhotoUrl: string | null
  }
  averageRating: number
  reviewText: string | null
  status: ProviderReviewStatus
  helpfulCount: number
  publishedAt: string | null
  createdAt: string
  response: {
    id: string
    responseText: string
    createdAt: string
  } | null
}

export interface ProviderReviewsListMeta {
  total: number
  unresponded: number
}
