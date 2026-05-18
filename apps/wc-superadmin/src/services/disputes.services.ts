import apiClient from '@/utils/api-client'
import type { ApiResult } from '@world-schools/wc-types'

export type DisputeOutcome = 'open' | 'won' | 'lost' | 'warning_closed' | 'other'

export type EvidenceTextField =
  | 'customer_name'
  | 'customer_email_address'
  | 'customer_purchase_ip'
  | 'product_description'
  | 'customer_communication'
  | 'shipping_address'
  | 'service_date'
  | 'refund_policy'
  | 'refund_policy_disclosure'
  | 'cancellation_policy'
  | 'cancellation_policy_disclosure'
  | 'access_activity_log'
  | 'uncategorized_text'

export type EvidenceFileField = 'shipping_documentation' | 'service_documentation'

export interface DisputeRow {
  id: string
  paymentId: string
  bookingGroupId: string
  stripeDisputeId: string
  amount: string
  currency: string
  reason: string
  status: string
  outcome: DisputeOutcome
  evidenceDueBy: string | null
  /** Timestamp Stripe debited the connected account for this dispute. */
  fundsWithdrawnAt: string | null
  /** Timestamp Stripe reinstated the funds (e.g. dispute won). */
  fundsReinstatedAt: string | null
  createdAt: string
  updatedAt: string
  payment?: {
    id: string
    kind: string
    stripeChargeId: string | null
    stripePaymentIntentId: string | null
    amount: string
    currency: string
  }
  bookingGroup?: {
    id: string
    bookingGroupNumber: string
    status: string
    camp: { id: string; name: string }
    parent: {
      user: { firstName: string | null; lastName: string | null; email: string | null } | null
    }
    provider: { id: string; legalCompanyName: string | null }
  }
}

export interface ListDisputesResponse {
  rows: DisputeRow[]
  total: number
  limit: number
  offset: number
}

export interface ListDisputesQuery {
  outcome?: DisputeOutcome
  limit?: number
  offset?: number
}

export interface SubmitEvidenceTextFields {
  customer_name?: string
  customer_email_address?: string
  customer_purchase_ip?: string
  product_description?: string
  customer_communication?: string
  shipping_address?: string
  service_date?: string
  refund_policy?: string
  refund_policy_disclosure?: string
  cancellation_policy?: string
  cancellation_policy_disclosure?: string
  access_activity_log?: string
  uncategorized_text?: string
}

export interface SubmitEvidencePayload {
  submit: boolean
  text: SubmitEvidenceTextFields
  files: Array<{ field: EvidenceFileField; file: File }>
}

export interface OverrideOutcomePayload {
  outcome: Exclude<DisputeOutcome, 'open'>
  note?: string
}

export const disputesService = {
  async list(query: ListDisputesQuery = {}): Promise<ApiResult<ListDisputesResponse>> {
    const sp = new URLSearchParams()
    if (query.outcome) sp.set('outcome', query.outcome)
    if (query.limit != null) sp.set('limit', String(query.limit))
    if (query.offset != null) sp.set('offset', String(query.offset))
    const q = sp.toString()
    return apiClient.get<ListDisputesResponse>(
      q ? `superadmin/disputes?${q}` : 'superadmin/disputes'
    )
  },

  async getById(id: string): Promise<ApiResult<DisputeRow>> {
    return apiClient.get<DisputeRow>(`superadmin/disputes/${id}`)
  },

  /**
   * Multipart submission: each file is keyed by its evidence-slot name (the
   * `fieldname` arrives at the backend as a `DisputeEvidenceField`). Text
   * fields ride on the same FormData. `submit` defaults to false (draft) so
   * the user can review the Stripe response before committing.
   */
  async submitEvidence(id: string, payload: SubmitEvidencePayload): Promise<ApiResult<DisputeRow>> {
    const form = new FormData()
    form.set('submit', payload.submit ? 'true' : 'false')
    for (const [key, value] of Object.entries(payload.text)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        form.set(key, value)
      }
    }
    for (const upload of payload.files) {
      // Backend uses `AnyFilesInterceptor`: each file's multipart fieldname IS
      // the evidence slot (e.g. `service_documentation`). Stripe maps the
      // resulting file id to the matching evidence key.
      form.append(upload.field, upload.file, upload.file.name)
    }
    return apiClient.post<DisputeRow>(`superadmin/disputes/${id}/evidence`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  async overrideOutcome(
    id: string,
    payload: OverrideOutcomePayload
  ): Promise<ApiResult<DisputeRow>> {
    return apiClient.post<DisputeRow>(`superadmin/disputes/${id}/override-outcome`, payload)
  },
}
