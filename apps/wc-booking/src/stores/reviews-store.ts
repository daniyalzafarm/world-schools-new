import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { CampReview, CreateReviewPayload, UpdateReviewPayload } from '@/types/reviews'
import {
  type AttendedEligible,
  type EligibleCampItem,
  reviewsService,
} from '@/services/reviews.services'

interface ReviewsState {
  published: CampReview[]
  pendingModeration: CampReview[]
  attended: AttendedEligible[]
  allCamps: EligibleCampItem[]
  isLoading: boolean
  isEligibleLoading: boolean
  error: string | null
}

interface ReviewsActions {
  fetchReviews: () => Promise<void>
  fetchEligible: () => Promise<void>
  addReview: (payload: CreateReviewPayload) => Promise<CampReview | null>
  updateReview: (id: string, payload: UpdateReviewPayload) => Promise<CampReview | null>
  removeReview: (id: string) => Promise<boolean>
  getPublishedCount: () => number
  getEligibleCount: () => number
  clearError: () => void
}

type ReviewsStore = ReviewsState & ReviewsActions

export const useReviewsStore = create<ReviewsStore>()(
  immer((set, get) => ({
    published: [],
    pendingModeration: [],
    attended: [],
    allCamps: [],
    isLoading: false,
    isEligibleLoading: false,
    error: null,

    fetchReviews: async () => {
      set(state => {
        state.isLoading = true
        state.error = null
      })
      const response = await reviewsService.getAll()
      if (response.success) {
        set(state => {
          state.published = (response.data as any).published ?? []
          state.pendingModeration = (response.data as any).pendingModeration ?? []
          state.isLoading = false
        })
      } else {
        set(state => {
          state.error = (response.data as any)?.message || 'Failed to fetch reviews'
          state.isLoading = false
        })
      }
    },

    fetchEligible: async () => {
      set(state => {
        state.isEligibleLoading = true
        state.error = null
      })
      const response = await reviewsService.getEligible()
      if (response.success) {
        set(state => {
          state.attended = (response.data as any).attended ?? []
          state.allCamps = (response.data as any).allCamps ?? []
          state.isEligibleLoading = false
        })
      } else {
        set(state => {
          state.error = (response.data as any)?.message || 'Failed to fetch eligible camps'
          state.isEligibleLoading = false
        })
      }
    },

    addReview: async payload => {
      const response = await reviewsService.create(payload)
      if (response.success) {
        const review = (response.data as any).review as CampReview
        set(state => {
          if (review.status === 'published') {
            state.published.unshift(review)
          } else if (review.status === 'pending') {
            state.pendingModeration.unshift(review)
          }
        })
        return review
      }
      set(state => {
        state.error = (response.data as any)?.message || 'Failed to create review'
      })
      return null
    },

    updateReview: async (id, payload) => {
      const response = await reviewsService.update(id, payload)
      if (response.success) {
        const updated = (response.data as any).review as CampReview
        set(state => {
          const updateList = (list: CampReview[]) => {
            const idx = list.findIndex(r => r.id === id)
            if (idx !== -1) list[idx] = updated
          }
          updateList(state.published)
          updateList(state.pendingModeration)
        })
        return updated
      }
      set(state => {
        state.error = (response.data as any)?.message || 'Failed to update review'
      })
      return null
    },

    removeReview: async id => {
      const response = await reviewsService.remove(id)
      if (response.success) {
        set(state => {
          state.published = state.published.filter(r => r.id !== id)
          state.pendingModeration = state.pendingModeration.filter(r => r.id !== id)
        })
        return true
      }
      set(state => {
        state.error = (response.data as any)?.message || 'Failed to delete review'
      })
      return false
    },

    getPublishedCount: () => get().published.length,

    getEligibleCount: () => get().attended.length,

    clearError: () => {
      set(state => {
        state.error = null
      })
    },
  }))
)
