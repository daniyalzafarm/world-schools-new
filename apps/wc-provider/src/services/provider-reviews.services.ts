import apiClient, { type ApiResult } from '@/utils/api-client'

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

interface ListParams {
  status?: ProviderReviewStatus
  limit?: number
}

export const providerReviewsService = {
  async list(params: ListParams = {}): Promise<ApiResult<ProviderReviewSummary[]>> {
    const search = new URLSearchParams()
    if (params.status) search.set('status', params.status)
    if (params.limit != null) search.set('limit', String(params.limit))
    const q = search.toString()
    const url = q ? `/provider/reviews?${q}` : '/provider/reviews'
    return apiClient.get<ProviderReviewSummary[]>(url)
  },
}
