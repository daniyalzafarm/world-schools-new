'use client'

import { Button } from '@heroui/react'
import { MainLayout } from '@/components/layout/main-layout'
import {
  DashboardBrowsing,
  DashboardDuringCamp,
  DashboardFirstBooking,
  DashboardFreshStart,
  DashboardPostCamp,
  DashboardPreCamp,
  DashboardProfileReady,
  DashboardReturningUser,
  DashboardShell,
  DashboardSkeleton,
  getDashboardState,
} from '@/components/dashboard'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { daysUntil } from '@/utils/dashboard'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import type { DashboardState } from '@world-schools/wc-types'

const CONFIRMED = new Set(['accepted', 'deposit_paid', 'fully_paid'])

function pickPreCampBooking(
  bookings: ParentBookingGroupSummary[]
): ParentBookingGroupSummary | null {
  const candidates = bookings
    .filter(b => CONFIRMED.has(b.status))
    .map(b => ({ b, days: daysUntil(b.session.startDate) ?? Number.POSITIVE_INFINITY }))
    .filter(({ days }) => days >= 0 && days <= 14)
    .sort((a, b) => a.days - b.days)
  return candidates[0]?.b ?? null
}

function pickAtCampBooking(
  bookings: ParentBookingGroupSummary[]
): ParentBookingGroupSummary | null {
  return bookings.find(b => b.status === 'at_camp') ?? null
}

function pickFirstConfirmed(
  bookings: ParentBookingGroupSummary[]
): ParentBookingGroupSummary | null {
  return (
    bookings.find(
      b => CONFIRMED.has(b.status) || b.status === 'at_camp' || b.status === 'completed'
    ) ?? null
  )
}

function pickUpcoming(bookings: ParentBookingGroupSummary[]): ParentBookingGroupSummary[] {
  return bookings
    .filter(b => CONFIRMED.has(b.status) || b.status === 'request')
    .filter(b => {
      const d = daysUntil(b.session.startDate)
      return d != null && d >= 0
    })
    .sort((a, b) => (daysUntil(a.session.startDate) ?? 0) - (daysUntil(b.session.startDate) ?? 0))
}

export default function HomePage() {
  return (
    <MainLayout>
      <DashboardPage />
    </MainLayout>
  )
}

function DashboardPage() {
  const data = useDashboardData()

  if (data.isLoading) return <DashboardSkeleton />

  const state: DashboardState = getDashboardState(data)
  const upcoming = pickUpcoming(data.bookings)

  return (
    <DashboardShell>
      {data.error && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-foreground">
          <span>{data.error}</span>
          <Button size="sm" variant="flat" onPress={data.refetch}>
            Retry
          </Button>
        </div>
      )}
      {renderState(state, data, upcoming)}
    </DashboardShell>
  )
}

function renderState(
  state: DashboardState,
  data: ReturnType<typeof useDashboardData>,
  upcoming: ParentBookingGroupSummary[]
) {
  switch (state) {
    case 'during-camp': {
      const booking = pickAtCampBooking(data.bookings)
      if (!booking) return <DashboardFreshStart />
      return <DashboardDuringCamp booking={booking} />
    }
    case 'pre-camp': {
      const primary = pickPreCampBooking(data.bookings)
      if (!primary) return <DashboardFreshStart />
      return <DashboardPreCamp children={data.children} primary={primary} upcoming={upcoming} />
    }
    case 'first-booking': {
      const booking = pickFirstConfirmed(data.bookings)
      if (!booking) return <DashboardFreshStart />
      return <DashboardFirstBooking children={data.children} booking={booking} />
    }
    case 'post-camp':
      return (
        <DashboardPostCamp
          eligibleReviews={data.eligibleReviews}
          bookingsCount={data.bookings.length}
          wishlistsCount={data.wishlists.length}
        />
      )
    case 'returning-user':
      return (
        <DashboardReturningUser
          children={data.children}
          wishlists={data.wishlists}
          upcoming={upcoming}
          bookingsCount={data.bookings.length}
        />
      )
    case 'browsing':
      return <DashboardBrowsing children={data.children} wishlists={data.wishlists} />
    case 'profile-ready':
      return <DashboardProfileReady children={data.children} />
    case 'quotes-pending':
    case 'decision-time':
    case 'fresh-start':
    default:
      return <DashboardFreshStart />
  }
}
