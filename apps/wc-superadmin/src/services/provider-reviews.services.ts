import apiClient from '@/utils/api-client'
import type { ApiResult } from '@world-schools/wc-types'

export type ProviderReviewStatus = 'pending' | 'under_review' | 'resolved'

export type ProviderSuspensionCategory =
  | 'precautionary'
  | 'safeguarding'
  | 'fraud'
  | 'insolvency'
  | 'failed_capture_escalation'

export interface ProviderReviewRow {
  id: string
  providerId: string
  suspensionType: ProviderSuspensionCategory
  status: ProviderReviewStatus
  affectedListingIds: string[] | null
  affectedBookingCount: number
  reasonText: string
  initiatingRefundId: string | null
  reviewedAt: string | null
  reviewedByUserId: string | null
  decision: string | null
  decisionNotes: string | null
  createdAt: string
  updatedAt: string
  provider?: {
    id: string
    legalCompanyName: string | null
    email: string | null
  }
}

export interface ListProviderReviewsResponse {
  rows: ProviderReviewRow[]
  total: number
  limit: number
  offset: number
}

export interface ListProviderReviewsQuery {
  status?: ProviderReviewStatus
  limit?: number
  offset?: number
}

export interface ResolveProviderReviewPayload {
  status: 'under_review' | 'resolved'
  decision?: string
  decisionNotes?: string
}

export const providerReviewsService = {
  async list(
    query: ListProviderReviewsQuery = {}
  ): Promise<ApiResult<ListProviderReviewsResponse>> {
    const sp = new URLSearchParams()
    if (query.status) sp.set('status', query.status)
    if (query.limit != null) sp.set('limit', String(query.limit))
    if (query.offset != null) sp.set('offset', String(query.offset))
    const q = sp.toString()
    return apiClient.get<ListProviderReviewsResponse>(
      q ? `superadmin/provider-reviews?${q}` : 'superadmin/provider-reviews'
    )
  },

  async getById(id: string): Promise<ApiResult<ProviderReviewRow>> {
    return apiClient.get<ProviderReviewRow>(`superadmin/provider-reviews/${id}`)
  },

  async resolve(
    id: string,
    payload: ResolveProviderReviewPayload
  ): Promise<ApiResult<ProviderReviewRow>> {
    return apiClient.post<ProviderReviewRow>(`superadmin/provider-reviews/${id}/resolve`, payload)
  },
}
