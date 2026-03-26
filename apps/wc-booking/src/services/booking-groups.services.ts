import apiClient, { type ApiResult } from '@/utils/api-client'
import type {
  BookingGroupDetails,
  CreateDraftBookingGroupRequest,
  DraftBookingGroupResponse,
  SaveBookingGroupAddOnsRequest,
} from '@/types/camp-booking'

export const bookingGroupsService = {
  async createDraft(
    payload: CreateDraftBookingGroupRequest
  ): Promise<ApiResult<DraftBookingGroupResponse>> {
    return apiClient.post<DraftBookingGroupResponse>('/user/booking-groups/draft', payload)
  },

  async getById(bookingGroupId: string): Promise<ApiResult<BookingGroupDetails>> {
    return apiClient.get<BookingGroupDetails>(`/user/booking-groups/${bookingGroupId}`)
  },

  async submit(
    bookingGroupId: string
  ): Promise<ApiResult<{ bookingGroupId: string; status: string }>> {
    return apiClient.post<{ bookingGroupId: string; status: string }>(
      `/user/booking-groups/${bookingGroupId}/submit`,
      {}
    )
  },

  async saveAddOns(
    bookingGroupId: string,
    payload: SaveBookingGroupAddOnsRequest
  ): Promise<ApiResult<{ bookingGroupId: string; status: string }>> {
    return apiClient.post<{ bookingGroupId: string; status: string }>(
      `/user/booking-groups/${bookingGroupId}/addons`,
      payload
    )
  },
}
