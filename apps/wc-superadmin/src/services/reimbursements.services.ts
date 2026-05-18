import apiClient from '@/utils/api-client'
import type { ApiResult } from '@world-schools/wc-types'

export type ReimbursementStatus =
  | 'not_required'
  | 'pending'
  | 'invoiced'
  | 'settled'
  | 'written_off'

export interface ReimbursementRow {
  id: string
  bookingGroupId: string
  refundId: string
  amountOwed: string
  currency: string
  dueDate: string
  status: ReimbursementStatus
  lastReminderSentAt: string | null
  settledAt: string | null
  settledByUserId: string | null
  createdAt: string
  updatedAt: string
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
  refund?: {
    id: string
    reason: string
    amount: string
    succeededAt: string | null
  }
}

export interface ListReimbursementsResponse {
  rows: ReimbursementRow[]
  total: number
  limit: number
  offset: number
}

export interface ListReimbursementsQuery {
  status?: ReimbursementStatus
  limit?: number
  offset?: number
}

export const reimbursementsService = {
  async list(query: ListReimbursementsQuery = {}): Promise<ApiResult<ListReimbursementsResponse>> {
    const sp = new URLSearchParams()
    if (query.status) sp.set('status', query.status)
    if (query.limit != null) sp.set('limit', String(query.limit))
    if (query.offset != null) sp.set('offset', String(query.offset))
    const q = sp.toString()
    return apiClient.get<ListReimbursementsResponse>(
      q ? `superadmin/reimbursements?${q}` : 'superadmin/reimbursements'
    )
  },

  async getById(id: string): Promise<ApiResult<ReimbursementRow>> {
    return apiClient.get<ReimbursementRow>(`superadmin/reimbursements/${id}`)
  },

  async settle(id: string): Promise<ApiResult<ReimbursementRow>> {
    return apiClient.post<ReimbursementRow>(`superadmin/reimbursements/${id}/settle`, {})
  },

  async writeOff(id: string): Promise<ApiResult<ReimbursementRow>> {
    return apiClient.post<ReimbursementRow>(`superadmin/reimbursements/${id}/write-off`, {})
  },
}
