import apiClient, { type ApiResult } from '@/utils/api-client'
import type { CampReview, CreateReviewPayload, UpdateReviewPayload } from '@/types/reviews'

export interface ReviewsResponse {
  published: CampReview[]
  pendingModeration: CampReview[]
}

export interface EligibleCampItem {
  id: string
  name: string
  locationName?: string | null
  photos?: unknown
  slug: string
}

export interface AttendedEligible {
  id: string
  name: string
  locationName?: string | null
  photos?: unknown
  slug: string
  attended: { date: string; bookingGroupId: string; bookingId: string }
}

export interface EligibleResponse {
  attended: AttendedEligible[]
  allCamps: EligibleCampItem[]
}

export const reviewsService = {
  async getAll(): Promise<ApiResult<ReviewsResponse>> {
    return apiClient.get<ReviewsResponse>('/user/reviews')
  },

  async getEligible(): Promise<ApiResult<EligibleResponse>> {
    return apiClient.get<EligibleResponse>('/user/reviews/eligible')
  },

  async create(payload: CreateReviewPayload): Promise<ApiResult<{ review: CampReview }>> {
    return apiClient.post<{ review: CampReview }>('/user/reviews', payload)
  },

  async update(
    id: string,
    payload: UpdateReviewPayload
  ): Promise<ApiResult<{ review: CampReview }>> {
    return apiClient.patch<{ review: CampReview }>(`/user/reviews/${id}`, payload)
  },

  async remove(id: string): Promise<ApiResult<{ message: string }>> {
    return apiClient.del<{ message: string }>(`/user/reviews/${id}`)
  },
}
