import apiClient, { type ApiResult } from '@/utils/api-client'
import type {
  CreateDraftBookingGroupRequest,
  DraftBookingGroupResponse,
  DraftBookingPreview,
  ParentBookingGroupDetail,
  ParentBookingGroupSummary,
  SaveBookingGroupAddOnsRequest,
} from '@/types/camp-booking'

export const bookingGroupsService = {
  async list(): Promise<ApiResult<ParentBookingGroupSummary[]>> {
    return apiClient.get<ParentBookingGroupSummary[]>('/user/booking-groups')
  },

  async createDraft(
    payload: CreateDraftBookingGroupRequest
  ): Promise<ApiResult<DraftBookingGroupResponse>> {
    return apiClient.post<DraftBookingGroupResponse>('/user/booking-groups/draft', payload)
  },

  async getById(bookingGroupId: string): Promise<ApiResult<ParentBookingGroupDetail>> {
    return apiClient.get<ParentBookingGroupDetail>(`/user/booking-groups/${bookingGroupId}`)
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

  async deleteDraft(
    bookingGroupId: string
  ): Promise<ApiResult<{ bookingGroupId: string; deleted: boolean }>> {
    return apiClient.del<{ bookingGroupId: string; deleted: boolean }>(
      `/user/booking-groups/${bookingGroupId}`
    )
  },
}
