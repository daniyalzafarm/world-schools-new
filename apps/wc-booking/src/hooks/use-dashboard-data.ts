'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useChildrenStore } from '@/stores/children-store'
import { useWishlistsStore } from '@/stores/wishlists-store'
import { useReviewsStore } from '@/stores/reviews-store'
import { bookingGroupsService } from '@/services/booking-groups.services'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import type { DashboardSnapshot } from '@/types/dashboard'

interface UseDashboardData extends DashboardSnapshot {
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useDashboardData(): UseDashboardData {
  const { user } = useAuthStore()
  const { children, fetchChildren } = useChildrenStore()
  const { myWishlists, fetchMyWishlists } = useWishlistsStore()
  const { attended, fetchEligible } = useReviewsStore()

  const [bookings, setBookings] = useState<ParentBookingGroupSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const [upcoming, past, childrenRes, wishlistsRes, reviewsRes] = await Promise.allSettled([
      bookingGroupsService.list({ tab: 'upcoming', limit: 20 }),
      bookingGroupsService.list({ tab: 'past', limit: 5 }),
      fetchChildren(),
      fetchMyWishlists(),
      fetchEligible(),
    ])

    const collected: ParentBookingGroupSummary[] = []
    if (upcoming.status === 'fulfilled' && upcoming.value.success) {
      collected.push(...upcoming.value.data)
    }
    if (past.status === 'fulfilled' && past.value.success) {
      collected.push(...past.value.data)
    }
    setBookings(collected)

    const failures = [upcoming, past, childrenRes, wishlistsRes, reviewsRes].filter(
      r => r.status === 'rejected'
    )
    if (failures.length > 0) {
      setError('Some dashboard data could not be loaded.')
    }

    setIsLoading(false)
  }, [fetchChildren, fetchMyWishlists, fetchEligible])

  useEffect(() => {
    void load()
  }, [load])

  return {
    user,
    children,
    bookings,
    wishlists: myWishlists,
    eligibleReviews: attended,
    isLoading,
    error,
    refetch: load,
  }
}
