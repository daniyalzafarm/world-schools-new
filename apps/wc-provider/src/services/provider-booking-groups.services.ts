import apiClient, { type ApiResult } from '@/utils/api-client'
import type {
  BookingDeclineReason,
  ProviderBookingGroupDetail,
  ProviderBookingGroupsQuery,
  ProviderBookingGroupSummary,
} from '@world-schools/wc-types'

function appendBookingGroupsQuery(
  params: ProviderBookingGroupsQuery | undefined,
  searchParams: URLSearchParams
) {
  if (!params) return
  if (params.tab) searchParams.set('tab', params.tab)
  if (params.status) searchParams.set('status', params.status)
  if (params.search) searchParams.set('search', params.search)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.limit != null) searchParams.set('limit', String(params.limit))
}

export const providerBookingGroupsService = {
  async list(
    params?: ProviderBookingGroupsQuery
  ): Promise<ApiResult<ProviderBookingGroupSummary[]>> {
    const searchParams = new URLSearchParams()
    appendBookingGroupsQuery(params, searchParams)
    const q = searchParams.toString()
    const url = q ? `/provider/booking-groups?${q}` : '/provider/booking-groups'
    return apiClient.get<ProviderBookingGroupSummary[]>(url)
  },

  async getById(id: string): Promise<ApiResult<ProviderBookingGroupDetail>> {
    return apiClient.get<ProviderBookingGroupDetail>(
      `/provider/booking-groups/${encodeURIComponent(id)}`
    )
  },

  async accept(
    id: string,
    body: { providerNote?: string }
  ): Promise<ApiResult<{ bookingGroupId: string; status: string }>> {
    return apiClient.post<{ bookingGroupId: string; status: string }>(
      `/provider/booking-groups/${encodeURIComponent(id)}/accept`,
      body
    )
  },

  async decline(
    id: string,
    body: {
      declineReason: BookingDeclineReason
      declineReasonOther?: string
      providerNote?: string
    }
  ): Promise<ApiResult<{ bookingGroupId: string; status: string }>> {
    return apiClient.post<{ bookingGroupId: string; status: string }>(
      `/provider/booking-groups/${encodeURIComponent(id)}/decline`,
      body
    )
  },

  async patch(
    id: string,
    body: { internalNotes: string | null }
  ): Promise<ApiResult<{ bookingGroupId: string; internalNotes: string | null }>> {
    return apiClient.patch<{ bookingGroupId: string; internalNotes: string | null }>(
      `/provider/booking-groups/${encodeURIComponent(id)}`,
      body
    )
  },

  async requestExtension(
    id: string
  ): Promise<ApiResult<{ bookingGroupId: string; expiresAt: string }>> {
    return apiClient.post<{ bookingGroupId: string; expiresAt: string }>(
      `/provider/booking-groups/${encodeURIComponent(id)}/request-extension`,
      {}
    )
  },
}
