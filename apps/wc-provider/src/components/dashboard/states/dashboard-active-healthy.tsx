'use client'

import { Banknote, Calendar, DollarSign, MailOpen, MessageCircle, Tent } from 'lucide-react'
import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'
import { formatCurrency } from '@world-schools/wc-utils'
import type { Session } from '@/types/sessions'
import type { CampStatistics } from '@/services/camps.services'
import type { ProviderReviewSummary } from '@/services/provider-reviews.services'
import { GreetingHeader } from '../greeting-header'
import { Section } from '../section'
import { StatsGrid } from '../stats-grid'
import { StatCard } from '../stat-card'
import { UpcomingBookingsList } from '../upcoming-bookings-list'
import { SessionCapacityList } from '../session-capacity-list'
import { QuickActionsGrid } from '../quick-actions-grid'
import { QuickActionTile } from '../quick-action-tile'
import { ActivityFeed, buildBookingActivity } from '../activity-feed'
import { ReviewsList } from '../reviews-list'

interface DashboardActiveHealthyProps {
  businessName: string | null
  bookingRequests: ProviderBookingGroupSummary[]
  upcomingBookings: ProviderBookingGroupSummary[]
  sessions: Session[]
  statistics: CampStatistics
  recentReviews: ProviderReviewSummary[]
  unreadMessages: number
}

export function DashboardActiveHealthy({
  businessName,
  bookingRequests,
  upcomingBookings,
  sessions,
  statistics,
  recentReviews,
  unreadMessages,
}: DashboardActiveHealthyProps) {
  const publishedSessions = sessions.filter(s => s.status === 'published')
  const currency = statistics.currency
  const bookingsValueThisMonth = statistics.bookingsValueThisMonth
  const payoutsThisMonth = statistics.payoutsThisMonth
  const totalBookings = statistics.totalBookings
  const activeSessions = statistics.activeSessions

  return (
    <>
      <GreetingHeader
        businessName={businessName}
        subtitle="Things are humming along. Here's what's on your plate today."
      />
      <StatsGrid>
        <StatCard
          icon={<MailOpen size={20} />}
          label="Pending requests"
          value={bookingRequests.length}
          tone={bookingRequests.length > 0 ? 'warning' : 'default'}
          href="/bookings"
        />
        {/* BUG-111: split the old "Revenue this month" card into two —
            bookings value (charges captured) and payouts (Stripe
            disbursements) — so a confirmed booking shows up immediately
            and providers can distinguish earned vs. paid-out. */}
        <StatCard
          icon={<DollarSign size={20} />}
          label="Bookings value this month"
          value={formatCurrency(bookingsValueThisMonth, currency)}
          tone="success"
        />
        <StatCard
          icon={<Banknote size={20} />}
          label="Payouts this month"
          value={formatCurrency(payoutsThisMonth, currency)}
          tone="primary"
        />
        <StatCard
          icon={<Calendar size={20} />}
          label="Total bookings"
          value={totalBookings}
          tone="default"
          href="/bookings"
        />
        <StatCard
          icon={<Tent size={20} />}
          label="Active sessions"
          value={activeSessions}
          tone="default"
          href="/camps"
        />
      </StatsGrid>
      {bookingRequests.length > 0 && (
        <Section
          title={`Pending requests (${bookingRequests.length})`}
          linkHref="/bookings"
          linkLabel="Review all"
        >
          <UpcomingBookingsList bookings={bookingRequests} limit={3} />
        </Section>
      )}
      <Section title="Recent bookings" linkHref="/bookings" linkLabel="See all">
        <UpcomingBookingsList bookings={upcomingBookings} limit={5} />
      </Section>
      <Section title="Quick actions">
        <QuickActionsGrid>
          <QuickActionTile
            href="/bookings"
            icon={<Calendar size={20} />}
            label="Manage bookings"
            description="Review upcoming bookings"
          />
          <QuickActionTile
            href="/messages"
            icon={<MessageCircle size={20} />}
            label="Open messages"
            description={unreadMessages > 0 ? `${unreadMessages} unread` : 'Chat with parents'}
          />
          <QuickActionTile
            href="/camps"
            icon={<Tent size={20} />}
            label="Edit your camps"
            description="Update details and photos"
          />
        </QuickActionsGrid>
      </Section>
      <Section title="Recent activity">
        <ActivityFeed items={buildBookingActivity([...bookingRequests, ...upcomingBookings], 6)} />
      </Section>
      {recentReviews.length > 0 && (
        <Section title="Recent reviews">
          <ReviewsList reviews={recentReviews} limit={5} />
        </Section>
      )}
      <Section title="Session capacity" linkHref="/camps" linkLabel="Manage all">
        <SessionCapacityList sessions={publishedSessions} limit={6} />
      </Section>
    </>
  )
}
