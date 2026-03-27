import apiClient, { type ApiResult } from '@/utils/api-client'
import type {
  BookingGroupDetails,
  CreateDraftBookingGroupRequest,
  DraftBookingGroupResponse,
  DraftBookingPreview,
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

  async getLatestDraftPreviews(campId: string): Promise<ApiResult<DraftBookingPreview[]>> {
    return apiClient.get<DraftBookingPreview[]>(
      `/user/booking-groups/draft-previews/latest?campId=${encodeURIComponent(campId)}`
    )
  },

  async updateDraft(
    bookingGroupId: string,
    payload: { sessionId: string; childIds: string[] }
  ): Promise<ApiResult<{ bookingGroupId: string; status: string }>> {
    return apiClient.post<{ bookingGroupId: string; status: string }>(
      `/user/booking-groups/${bookingGroupId}/draft`,
      payload
    )
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
