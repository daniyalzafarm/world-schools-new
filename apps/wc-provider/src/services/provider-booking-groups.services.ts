import apiClient, { type ApiResult } from '@/utils/api-client'
import type {
  ProviderBookingGroupDetail,
  ProviderBookingGroupSummary,
} from '@world-schools/wc-types'

export const providerBookingGroupsService = {
  async list(): Promise<ApiResult<ProviderBookingGroupSummary[]>> {
    return apiClient.get<ProviderBookingGroupSummary[]>('/provider/booking-groups')
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
    body: { providerNote?: string }
  ): Promise<ApiResult<{ bookingGroupId: string; status: string }>> {
    return apiClient.post<{ bookingGroupId: string; status: string }>(
      `/provider/booking-groups/${encodeURIComponent(id)}/decline`,
      body
    )
  },
}
