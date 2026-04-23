import apiClient, { type ApiResult } from '@/utils/api-client'
import type { ParentBookingGroupsQuery } from '@world-schools/wc-types'
import type {
  CreateDraftBookingGroupRequest,
  DraftBookingGroupResponse,
  DraftBookingPreview,
  ParentBookingGroupDetail,
  ParentBookingGroupSummary,
  SaveBookingGroupAddOnsRequest,
} from '@/types/camp-booking'

export const bookingGroupsService = {
  async list(params?: ParentBookingGroupsQuery): Promise<ApiResult<ParentBookingGroupSummary[]>> {
    const sp = new URLSearchParams()
    if (params?.tab) sp.set('tab', params.tab)
    if (params?.status) sp.set('status', params.status)
    if (params?.sortBy) sp.set('sortBy', params.sortBy)
    if (params?.sortOrder) sp.set('sortOrder', params.sortOrder)
    if (params?.page != null) sp.set('page', String(params.page))
    if (params?.limit != null) sp.set('limit', String(params.limit))
    const q = sp.toString()
    return apiClient.get<ParentBookingGroupSummary[]>(
      q ? `/user/booking-groups?${q}` : '/user/booking-groups'
    )
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
