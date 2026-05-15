'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useCampsStore } from '@/stores/camps-store'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { useUnreadMessagesCount } from '@/hooks/use-unread-messages-count'
import { providerBookingGroupsService } from '@/services/provider-booking-groups.services'
import { getCamp } from '@/services/camps.services'
import { getAllSessions } from '@/services/sessions.service'
import {
  type ProviderReviewsListMeta,
  providerReviewsService,
  type ProviderReviewSummary,
} from '@/services/provider-reviews.services'
import type { Camp } from '@/types/camps'
import type { Session } from '@/types/sessions'
import type { ProviderDashboardSnapshot } from '@/types/provider-dashboard'
import { daysSince, daysUntil } from '@/utils/provider-dashboard'
import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'

interface UseProviderDashboardData extends ProviderDashboardSnapshot {
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useProviderDashboardData(): UseProviderDashboardData {
  const user = useAuthStore(s => s.user)
  const camps = useCampsStore(s => s.camps)
  const statistics = useCampsStore(s => s.statistics)
  const fetchCamps = useCampsStore(s => s.fetchCamps)
  const fetchStatistics = useCampsStore(s => s.fetchStatistics)

  const onboardingStatus = useOnboardingStore(s => s.status)
  const googleBusinessProfile = useOnboardingStore(s => s.googleBusinessProfile)
  const fetchStatus = useOnboardingStore(s => s.fetchStatus)
  const fetchGoogleBusinessProfile = useOnboardingStore(s => s.fetchGoogleBusinessProfile)

  const unreadMessages = useUnreadMessagesCount()

  const [sessions, setSessions] = useState<Session[]>([])
  const [bookingRequests, setBookingRequests] = useState<ProviderBookingGroupSummary[]>([])
  const [upcomingBookings, setUpcomingBookings] = useState<ProviderBookingGroupSummary[]>([])
  const [atCampBookings, setAtCampBookings] = useState<ProviderBookingGroupSummary[]>([])
  const [pastBookings, setPastBookings] = useState<ProviderBookingGroupSummary[]>([])
  const [liveCamp, setLiveCamp] = useState<Camp | null>(null)
  const [recentReviews, setRecentReviews] = useState<ProviderReviewSummary[]>([])
  const [reviewsMeta, setReviewsMeta] = useState<ProviderReviewsListMeta>({
    total: 0,
    unresponded: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const phase1 = await Promise.allSettled([
      fetchCamps(),
      fetchStatistics(),
      fetchStatus(),
      fetchGoogleBusinessProfile(),
      providerBookingGroupsService.list({ tab: 'requests', limit: 20 }),
      providerBookingGroupsService.list({ tab: 'upcoming', limit: 20 }),
      providerBookingGroupsService.list({ tab: 'at-camp', limit: 10 }),
      providerBookingGroupsService.list({ tab: 'past', limit: 10 }),
      providerReviewsService.list({ status: 'published', limit: 5 }),
    ])

    const requestsRes = phase1[4]
    const upcomingRes = phase1[5]
    const atCampRes = phase1[6]
    const pastRes = phase1[7]
    const reviewsRes = phase1[8]

    if (requestsRes.status === 'fulfilled' && requestsRes.value.success) {
      setBookingRequests(requestsRes.value.data ?? [])
    }
    if (upcomingRes.status === 'fulfilled' && upcomingRes.value.success) {
      setUpcomingBookings(upcomingRes.value.data ?? [])
    }
    if (atCampRes.status === 'fulfilled' && atCampRes.value.success) {
      setAtCampBookings(atCampRes.value.data ?? [])
    }
    if (pastRes.status === 'fulfilled' && pastRes.value.success) {
      setPastBookings(pastRes.value.data ?? [])
    }
    if (reviewsRes.status === 'fulfilled' && reviewsRes.value.success) {
      setRecentReviews(reviewsRes.value.data ?? [])
      const meta = reviewsRes.value.meta as ProviderReviewsListMeta | undefined
      if (meta) setReviewsMeta(meta)
    }

    const currentCamps = useCampsStore.getState().camps
    const sessionResults = await Promise.allSettled(currentCamps.map(c => getAllSessions(c.id)))
    const allSessions: Session[] = []
    sessionResults.forEach(r => {
      if (r.status === 'fulfilled') allSessions.push(...r.value.sessions)
    })
    setSessions(allSessions)

    const now = new Date()
    const live = allSessions.find(s => {
      if (s.status !== 'published') return false
      const start = daysUntil(s.startDate, now)
      const end = daysSince(s.endDate, now)
      return start != null && end != null && start <= 0 && end <= 0
    })

    type LiveCampResult = PromiseSettledResult<Awaited<ReturnType<typeof getCamp>>>
    let liveCampRes: LiveCampResult | null = null
    if (live) {
      const [settled] = await Promise.allSettled([getCamp(live.campId)])
      liveCampRes = settled
      if (settled.status === 'fulfilled' && settled.value.success) {
        setLiveCamp(settled.value.data.camp)
      }
    } else {
      setLiveCamp(null)
    }

    const failures = [...phase1, ...sessionResults, ...(liveCampRes ? [liveCampRes] : [])].filter(
      r => r.status === 'rejected'
    )
    if (failures.length > 0) {
      setError('Some dashboard data could not be loaded.')
    }

    setIsLoading(false)
  }, [fetchCamps, fetchStatistics, fetchStatus, fetchGoogleBusinessProfile])

  useEffect(() => {
    void load()
  }, [])

  const businessName =
    googleBusinessProfile?.legalInfo?.legalCompanyName ??
    googleBusinessProfile?.businessName ??
    user?.firstName ??
    null

  return {
    user,
    businessName,
    camps,
    statistics,
    sessions,
    bookingRequests,
    upcomingBookings,
    atCampBookings,
    pastBookings,
    onboardingStatus,
    businessProfile: googleBusinessProfile,
    liveCamp,
    recentReviews,
    reviewsMeta,
    unreadMessages,
    isLoading,
    error,
    refetch: load,
  }
}
