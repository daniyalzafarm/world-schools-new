import apiClient from '../utils/api-client'
import type {
  CampBookingItem,
  CampDetail,
  CampReviewItem,
  CampSessionItem,
  CampStats,
  GetCampsQuery,
  GetCampsResponse,
  PaginatedCampSubResponse,
} from '../types/camps'

const CAMPS_ENDPOINT = '/superadmin/camps'

export const campsService = {
  async getCamps(query: GetCampsQuery): Promise<GetCampsResponse> {
    const params = new URLSearchParams()
    params.append('page', String(query.page ?? 1))
    params.append('limit', String(query.limit ?? 20))
    if (query.status) params.append('status', query.status)
    if (query.search) params.append('search', query.search)
    if (query.providerId) params.append('providerId', query.providerId)
    if (query.category) params.append('category', query.category)
    if (query.country) params.append('country', query.country)
    const response = await apiClient.get<GetCampsResponse>(`${CAMPS_ENDPOINT}?${params.toString()}`)
    return response.data as GetCampsResponse
  },

  async getStats(): Promise<CampStats> {
    const response = await apiClient.get<CampStats>(`${CAMPS_ENDPOINT}/stats`)
    return response.data as CampStats
  },

  async getDetail(id: string): Promise<CampDetail> {
    const response = await apiClient.get<CampDetail>(`${CAMPS_ENDPOINT}/${id}`)
    return response.data as CampDetail
  },

  async getCampSessions(
    id: string,
    query: { page?: number; limit?: number; status?: string }
  ): Promise<PaginatedCampSubResponse<CampSessionItem>> {
    const params = new URLSearchParams()
    params.append('page', String(query.page ?? 1))
    params.append('limit', String(query.limit ?? 20))
    if (query.status) params.append('status', query.status)
    const response = await apiClient.get<PaginatedCampSubResponse<CampSessionItem>>(
      `${CAMPS_ENDPOINT}/${id}/sessions?${params.toString()}`
    )
    return response.data as PaginatedCampSubResponse<CampSessionItem>
  },

  async getCampBookings(
    id: string,
    query: { page?: number; limit?: number; status?: string }
  ): Promise<PaginatedCampSubResponse<CampBookingItem>> {
    const params = new URLSearchParams()
    params.append('page', String(query.page ?? 1))
    params.append('limit', String(query.limit ?? 20))
    if (query.status) params.append('status', query.status)
    const response = await apiClient.get<PaginatedCampSubResponse<CampBookingItem>>(
      `${CAMPS_ENDPOINT}/${id}/bookings?${params.toString()}`
    )
    return response.data as PaginatedCampSubResponse<CampBookingItem>
  },

  async getCampReviews(
    id: string,
    query: { page?: number; limit?: number; status?: string }
  ): Promise<PaginatedCampSubResponse<CampReviewItem>> {
    const params = new URLSearchParams()
    params.append('page', String(query.page ?? 1))
    params.append('limit', String(query.limit ?? 20))
    if (query.status) params.append('status', query.status)
    const response = await apiClient.get<PaginatedCampSubResponse<CampReviewItem>>(
      `${CAMPS_ENDPOINT}/${id}/reviews?${params.toString()}`
    )
    return response.data as PaginatedCampSubResponse<CampReviewItem>
  },
}
