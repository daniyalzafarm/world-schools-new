import apiClient from '@/utils/api-client'
import type { ApiResult } from '@world-schools/wc-types'

export interface PaymentReviewRow {
  id: string
  bookingGroupNumber: string
  status: string
  totalAmount: string
  paidAmount: string
  paymentReviewStatus: string | null
  paymentReviewFlaggedAt: string | null
  camp?: { id: string; name: string }
  provider?: {
    id: string
    legalCompanyName: string | null
    settings?: { currency: string | null } | null
  }
  parent?: {
    user: { firstName: string | null; lastName: string | null; email: string | null } | null
  }
}

export interface ListPaymentReviewsResponse {
  rows: PaymentReviewRow[]
  total: number
  limit: number
  offset: number
}

export interface ListPaymentReviewsQuery {
  limit?: number
  offset?: number
}

export type ResolvePaymentReviewAction = 'cancel' | 'mark_resolved'

export const paymentReviewsService = {
  async list(query: ListPaymentReviewsQuery = {}): Promise<ApiResult<ListPaymentReviewsResponse>> {
    const sp = new URLSearchParams()
    if (query.limit != null) sp.set('limit', String(query.limit))
    if (query.offset != null) sp.set('offset', String(query.offset))
    const q = sp.toString()
    return apiClient.get<ListPaymentReviewsResponse>(
      q ? `superadmin/payment-reviews?${q}` : 'superadmin/payment-reviews'
    )
  },

  async resolve(
    bookingGroupId: string,
    payload: { action: ResolvePaymentReviewAction; notes?: string }
  ): Promise<ApiResult<unknown>> {
    return apiClient.post(`superadmin/payment-reviews/${bookingGroupId}/resolve`, payload)
  },
}
