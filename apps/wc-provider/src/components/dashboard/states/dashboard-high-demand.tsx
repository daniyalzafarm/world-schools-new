'use client'

import { Calendar, DollarSign, Flame, MailOpen, Plus, TrendingUp } from 'lucide-react'
import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'
import type { CampStatistics } from '@/services/camps.services'
import type { Session } from '@/types/sessions'
import { GreetingHeader } from '../greeting-header'
import { DemandBanner } from '../demand-banner'
import { Section } from '../section'
import { StatsGrid } from '../stats-grid'
import { StatCard } from '../stat-card'
import { BookingRequestList } from '../booking-request-list'
import { SessionCapacityList } from '../session-capacity-list'
import { QuickActionsGrid } from '../quick-actions-grid'
import { QuickActionTile } from '../quick-action-tile'
import { ActivityFeed, buildBookingActivity } from '../activity-feed'

interface DashboardHighDemandProps {
  businessName: string | null
  hotSessions: Session[]
  bookingRequests: ProviderBookingGroupSummary[]
  upcomingBookings: ProviderBookingGroupSummary[]
  sessions: Session[]
  statistics: CampStatistics
}

export function DashboardHighDemand({
  businessName,
  hotSessions,
  bookingRequests,
  upcomingBookings,
  sessions,
  statistics,
}: DashboardHighDemandProps) {
  const otherPublished = sessions.filter(
    s => s.status === 'published' && !hotSessions.some(h => h.id === s.id)
  )
  const avgOccupancy = (() => {
    const published = sessions.filter(s => s.status === 'published' && (s.totalSpots ?? 0) > 0)
    if (published.length === 0) return 0
    const total = published.reduce((sum, s) => sum + (s.bookedCount ?? 0) / (s.totalSpots ?? 1), 0)
    return Math.round((total / published.length) * 100)
  })()
  const pendingRevenue = bookingRequests.reduce((sum, r) => sum + r.totalAmount, 0)
  const confirmedPaid = upcomingBookings.reduce((sum, b) => sum + (b.paidAmount ?? 0), 0)
  const revenueProjection = confirmedPaid + pendingRevenue
  const currency = statistics.currency

  const formatCurrency = (value: number) => {
    try {
      return new Intl.NumberFormat('en', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(value)
    } catch {
      return `${currency} ${value}`
    }
  }

  const formattedPending = formatCurrency(pendingRevenue)
  const formattedProjection = formatCurrency(revenueProjection)
  const formattedConfirmed = formatCurrency(confirmedPaid)

  return (
    <>
      <GreetingHeader
        businessName={businessName}
        subtitle="Demand is high. Move quickly on requests and consider opening more capacity."
      />
      <DemandBanner hotSessionCount={hotSessions.length} />
      <StatsGrid>
        <StatCard
          icon={<MailOpen size={20} />}
          label="Pending requests"
          value={bookingRequests.length}
          tone="warning"
          href="/bookings"
        />
        <StatCard
          icon={<DollarSign size={20} />}
          label="Pending revenue"
          value={formattedPending}
          tone="primary"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Avg occupancy"
          value={`${avgOccupancy}%`}
          tone={avgOccupancy >= 75 ? 'success' : 'primary'}
        />
        <StatCard
          icon={<Flame size={20} />}
          label="Hot sessions"
          value={hotSessions.length}
          hint="90%+ full"
          tone="danger"
        />
      </StatsGrid>
      <Section title="Revenue projection">
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-default-200 bg-background p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-default-500">If all confirm</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{formattedProjection}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-default-500">Confirmed paid</p>
            <p className="mt-1 text-2xl font-bold text-success-700">{formattedConfirmed}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-default-500">Pending</p>
            <p className="mt-1 text-2xl font-bold text-warning-700">{formattedPending}</p>
          </div>
        </div>
      </Section>
      {bookingRequests.length > 0 && (
        <Section
          title={`Pending requests (${bookingRequests.length})`}
          linkHref="/bookings"
          linkLabel="Review all"
        >
          <BookingRequestList requests={bookingRequests} limit={5} />
        </Section>
      )}
      <Section title="Hot sessions">
        <SessionCapacityList sessions={hotSessions} limit={6} emptyLabel="No hot sessions." />
      </Section>
      <Section title="Quick actions">
        <QuickActionsGrid>
          <QuickActionTile
            href="/camps"
            icon={<Plus size={20} />}
            label="Add new session"
            description="Open more capacity"
          />
          <QuickActionTile
            href="/camps"
            icon={<DollarSign size={20} />}
            label="Review pricing"
            description="Adjust rates for hot sessions"
          />
          <QuickActionTile
            href="/bookings"
            icon={<Calendar size={20} />}
            label="Manage requests"
            description="Accept or decline quickly"
          />
        </QuickActionsGrid>
      </Section>
      <Section title="Recent activity">
        <ActivityFeed items={buildBookingActivity([...bookingRequests, ...upcomingBookings], 6)} />
      </Section>
      {otherPublished.length > 0 && (
        <Section title="Other sessions" linkHref="/camps" linkLabel="Manage all">
          <SessionCapacityList sessions={otherPublished} limit={6} />
        </Section>
      )}
    </>
  )
}
