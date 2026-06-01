'use client'

import { Button } from '@heroui/react'
import {
  DashboardActiveHealthy,
  DashboardCampNoSessions,
  DashboardDuringCamp,
  DashboardFirstRequests,
  DashboardFreshStart,
  DashboardHighDemand,
  DashboardPostSeason,
  DashboardPreCamp,
  DashboardPublishedWaiting,
  DashboardQuietPeriod,
  getProviderDashboardState,
  ProviderDashboardShell,
  ProviderDashboardSkeleton,
} from '@/components/dashboard'
import { useProviderDashboardData } from '@/hooks/use-provider-dashboard-data'
import { daysUntil } from '@/utils/provider-dashboard'
import type { Session } from '@/types/sessions'
import type { ProviderDashboardState } from '@/types/provider-dashboard'

const CONFIRMED = new Set(['accepted', 'deposit_paid', 'fully_paid'])
const PRE_CAMP_WINDOW_DAYS = 14
const HIGH_DEMAND_OCCUPANCY = 0.9

function pickLiveSession(sessions: Session[], now = new Date()): Session | null {
  return (
    sessions.find(s => {
      if (s.status !== 'published') return false
      const start = daysUntil(s.startDate, now)
      const end = daysUntil(s.endDate, now)
      return start != null && end != null && start <= 0 && end >= 0
    }) ?? null
  )
}

function pickPreCampSession(sessions: Session[], now = new Date()): Session | null {
  const candidates = sessions
    .filter(s => s.status === 'published')
    .map(s => ({ s, days: daysUntil(s.startDate, now) ?? Number.POSITIVE_INFINITY }))
    .filter(({ days }) => days >= 0 && days <= PRE_CAMP_WINDOW_DAYS)
    .sort((a, b) => a.days - b.days)
  return candidates[0]?.s ?? null
}

function pickHotSessions(sessions: Session[]): Session[] {
  return sessions.filter(s => {
    if (s.status !== 'published') return false
    if (!s.totalSpots || s.totalSpots <= 0) return false
    return (s.bookedCount ?? 0) / s.totalSpots >= HIGH_DEMAND_OCCUPANCY
  })
}

export default function DashboardPage() {
  const data = useProviderDashboardData()

  // Hold the skeleton until statistics (with provider currency) has resolved
  // — every widget renders amounts in `statistics.currency`, no fallback.
  if (data.isLoading || !data.statistics) return <ProviderDashboardSkeleton />

  const state: ProviderDashboardState = getProviderDashboardState(data)

  return (
    <ProviderDashboardShell>
      {data.error && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-foreground">
          <span>{data.error}</span>
          <Button size="sm" variant="flat" onPress={data.refetch}>
            Retry
          </Button>
        </div>
      )}
      {renderState(state, data)}
    </ProviderDashboardShell>
  )
}

function renderState(
  state: ProviderDashboardState,
  data: ReturnType<typeof useProviderDashboardData>
) {
  const {
    businessName,
    user,
    camps,
    sessions,
    statistics,
    bookingRequests,
    upcomingBookings,
    atCampBookings,
    pastBookings,
    onboardingStatus,
    businessProfile,
    liveCamp,
    recentReviews,
    unreadMessages,
  } = data

  // Caller (DashboardPage) gates rendering on `data.statistics` being loaded,
  // but TS doesn't propagate that narrowing through the function boundary.
  if (!statistics) return null

  switch (state) {
    case 'fresh-start':
      return <DashboardFreshStart businessName={businessName} onboardingStatus={onboardingStatus} />
    case 'camp-no-sessions':
      return (
        <DashboardCampNoSessions businessName={businessName} camps={camps} sessions={sessions} />
      )
    case 'published-waiting':
      return (
        <DashboardPublishedWaiting
          businessName={businessName}
          camps={camps}
          sessions={sessions}
          statistics={statistics}
        />
      )
    case 'first-requests':
      return (
        <DashboardFirstRequests
          businessName={businessName}
          bookingRequests={bookingRequests}
          sessions={sessions}
          unreadMessages={unreadMessages}
          statistics={statistics}
        />
      )
    case 'active-healthy':
      return (
        <DashboardActiveHealthy
          businessName={businessName}
          bookingRequests={bookingRequests}
          upcomingBookings={upcomingBookings}
          sessions={sessions}
          statistics={statistics}
          recentReviews={recentReviews}
          unreadMessages={unreadMessages}
        />
      )
    case 'quiet-period':
      return (
        <DashboardQuietPeriod
          businessName={businessName}
          camps={camps}
          pastBookings={pastBookings}
          statistics={statistics}
          recentReviews={recentReviews}
        />
      )
    case 'pre-camp': {
      const primary = pickPreCampSession(sessions)
      if (!primary) {
        return (
          <DashboardActiveHealthy
            businessName={businessName}
            bookingRequests={bookingRequests}
            upcomingBookings={upcomingBookings}
            sessions={sessions}
            statistics={statistics}
            recentReviews={recentReviews}
            unreadMessages={unreadMessages}
          />
        )
      }
      const campName = camps.find(c => c.id === primary.campId)?.name
      return (
        <DashboardPreCamp
          businessName={businessName}
          primarySession={primary}
          primaryCampName={campName}
          upcomingBookings={upcomingBookings.filter(
            b => CONFIRMED.has(b.status) || b.status === 'request'
          )}
          sessions={sessions}
          statistics={statistics}
          unreadMessages={unreadMessages}
        />
      )
    }
    case 'during-camp': {
      const live = pickLiveSession(sessions)
      if (!live) {
        return (
          <DashboardActiveHealthy
            businessName={businessName}
            bookingRequests={bookingRequests}
            upcomingBookings={upcomingBookings}
            sessions={sessions}
            statistics={statistics}
            recentReviews={recentReviews}
            unreadMessages={unreadMessages}
          />
        )
      }
      return (
        <DashboardDuringCamp
          businessName={businessName}
          liveSession={live}
          liveCamp={liveCamp}
          atCampBookings={atCampBookings}
          sessions={sessions}
          businessProfile={businessProfile}
          userEmail={user?.email ?? null}
          unreadMessages={unreadMessages}
        />
      )
    }
    case 'post-season':
      return (
        <DashboardPostSeason
          businessName={businessName}
          pastBookings={pastBookings}
          camps={camps}
          statistics={statistics}
          recentReviews={recentReviews}
        />
      )
    case 'high-demand': {
      const hot = pickHotSessions(sessions)
      return (
        <DashboardHighDemand
          businessName={businessName}
          hotSessions={hot}
          bookingRequests={bookingRequests}
          upcomingBookings={upcomingBookings}
          sessions={sessions}
          statistics={statistics}
        />
      )
    }
    default:
      return <DashboardFreshStart businessName={businessName} onboardingStatus={onboardingStatus} />
  }
}
