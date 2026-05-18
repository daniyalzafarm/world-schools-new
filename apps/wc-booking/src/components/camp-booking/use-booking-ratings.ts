import { useCampBookingStore } from '@/stores/camp-booking-store'
import { getGoogleReviewsUrl } from '@/components/camp-booking/booking-flow-format'

export interface BookingRatings {
  systemRating: number | null
  systemReviewsCount: number
  hasSystemReviews: boolean
  googleRating: number | null
  googleReviewsCount: number
  hasGoogleReviews: boolean
  googleReviewsUrl: string | null
}

export function useBookingRatings(): BookingRatings {
  const campReviews = useCampBookingStore(state => state.campReviews)
  const gbp = useCampBookingStore(state => state.camp?.provider?.googleBusinessProfile)

  const systemReviewsCount = campReviews?.totalReviews ?? 0
  const googleReviewsCount = gbp?.reviewsCount ?? 0

  return {
    systemRating: campReviews?.overallRating ?? null,
    systemReviewsCount,
    hasSystemReviews: systemReviewsCount > 0,
    googleRating: gbp?.rating != null ? Number(gbp.rating) : null,
    googleReviewsCount,
    hasGoogleReviews: googleReviewsCount > 0,
    googleReviewsUrl: getGoogleReviewsUrl(gbp?.placeId),
  }
}
