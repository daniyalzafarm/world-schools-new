'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useUnreadMessagesCount } from '@/hooks/use-unread-messages-count'
import { type DashboardSnapshotResponse, getDashboard } from '@/services/dashboard.services'
import type { ProviderDashboardSnapshot } from '@/types/provider-dashboard'

interface UseProviderDashboardData extends ProviderDashboardSnapshot {
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const EMPTY_SNAPSHOT: DashboardSnapshotResponse = {
  businessName: null,
  camps: [],
  statistics: null,
  sessions: [],
  bookingRequests: [],
  upcomingBookings: [],
  atCampBookings: [],
  pastBookings: [],
  onboardingStatus: null,
  businessProfile: null,
  liveCamp: null,
  recentReviews: [],
  reviewsMeta: { total: 0, unresponded: 0 },
}

export function useProviderDashboardData(): UseProviderDashboardData {
  const user = useAuthStore(s => s.user)
  const unreadMessages = useUnreadMessagesCount()

  const [snapshot, setSnapshot] = useState<DashboardSnapshotResponse>(EMPTY_SNAPSHOT)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getDashboard()
      if (result.success && result.data) {
        setSnapshot(result.data)
      } else {
        setError('Some dashboard data could not be loaded.')
      }
    } catch {
      setError('Some dashboard data could not be loaded.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return {
    ...snapshot,
    // Fall back to the user's first name when the provider hasn't set a business name yet.
    businessName: snapshot.businessName ?? user?.firstName ?? null,
    user,
    unreadMessages,
    isLoading,
    error,
    refetch: load,
  }
}
