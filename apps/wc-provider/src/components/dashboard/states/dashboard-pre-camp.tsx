'use client'

import { Calendar, DollarSign, MessageCircle, Users } from 'lucide-react'
import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'
import type { Session } from '@/types/sessions'
import type { ChecklistItemViewModel } from '@/types/provider-dashboard'
import type { CampStatistics } from '@/services/camps.services'
import { GreetingHeader } from '../greeting-header'
import { CountdownBanner } from '../countdown-banner'
import { Section } from '../section'
import { Checklist } from '../checklist'
import { StatsGrid } from '../stats-grid'
import { StatCard } from '../stat-card'
import { UpcomingBookingsList } from '../upcoming-bookings-list'
import { SessionCapacityList } from '../session-capacity-list'
import { QuickActionsGrid } from '../quick-actions-grid'
import { QuickActionTile } from '../quick-action-tile'

interface DashboardPreCampProps {
  businessName: string | null
  primarySession: Session
  primaryCampName?: string
  upcomingBookings: ProviderBookingGroupSummary[]
  sessions: Session[]
  statistics: CampStatistics | null
  unreadMessages: number
}

function formatCurrency(value: number, currency: string): string {
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

const CONFIRMED_STATUSES = new Set(['accepted', 'deposit_paid', 'fully_paid'])

export function DashboardPreCamp({
  businessName,
  primarySession,
  primaryCampName,
  upcomingBookings,
  sessions,
  statistics,
  unreadMessages,
}: DashboardPreCampProps) {
  const bookingsForPrimary = upcomingBookings.filter(
    b => b.session.startDate === primarySession.startDate
  )
  const confirmed = bookingsForPrimary.filter(b => CONFIRMED_STATUSES.has(b.status))
  const confirmedChildren = confirmed.reduce((sum, b) => sum + b.children.length, 0)
  const totalSpots = primarySession.totalSpots ?? 0
  const sessionRevenue = confirmed.reduce((sum, b) => sum + (b.paidAmount ?? 0), 0)
  const currency = statistics?.currency ?? confirmed[0]?.currency ?? 'EUR'

  const items: ChecklistItemViewModel[] = [
    {
      id: 'confirmed-bookings',
      label: 'All bookings confirmed',
      done: bookingsForPrimary.every(b => CONFIRMED_STATUSES.has(b.status)),
      actionHref: '/bookings',
    },
    {
      id: 'final-headcount',
      label: 'Final headcount confirmed',
      done: confirmedChildren > 0 && (totalSpots === 0 || confirmedChildren <= totalSpots),
      actionHref: '/bookings',
    },
    {
      id: 'message-parents',
      label: 'Send pre-camp briefing to parents',
      done: false,
      actionHref: '/messages',
    },
    {
      id: 'staff-briefing',
      label: 'Brief your team on the session',
      done: false,
    },
  ]

  const otherSessions = sessions.filter(s => s.id !== primarySession.id && s.status === 'published')

  return (
    <>
      <GreetingHeader
        businessName={businessName}
        subtitle="Final preparations — let's make sure everyone arrives ready."
      />
      <CountdownBanner session={primarySession} campName={primaryCampName} />
      <StatsGrid>
        <StatCard
          icon={<Users size={20} />}
          label="Confirmed campers"
          value={confirmedChildren}
          hint={totalSpots > 0 ? `of ${totalSpots} spots` : undefined}
          tone="primary"
          href="/bookings"
        />
        <StatCard
          icon={<Calendar size={20} />}
          label="Bookings"
          value={bookingsForPrimary.length}
          tone="primary"
          href="/bookings"
        />
        <StatCard
          icon={<MessageCircle size={20} />}
          label="Unread messages"
          value={unreadMessages}
          tone={unreadMessages > 0 ? 'warning' : 'default'}
          href="/messages"
        />
        <StatCard
          icon={<DollarSign size={20} />}
          label="Session revenue"
          value={formatCurrency(sessionRevenue, currency)}
          tone="success"
        />
      </StatsGrid>
      <Checklist title="Pre-camp checklist" items={items} />
      <Section title="Confirmed attendees" linkHref="/bookings" linkLabel="See all">
        <UpcomingBookingsList bookings={confirmed} limit={5} />
      </Section>
      <Section title="Quick actions">
        <QuickActionsGrid>
          <QuickActionTile
            href="/messages"
            icon={<MessageCircle size={20} />}
            label="Message all parents"
            description="Send a pre-camp update"
          />
          <QuickActionTile
            href="/bookings"
            icon={<Users size={20} />}
            label="Attendee list"
            description="Review camper details"
          />
          <QuickActionTile
            href="/camps"
            icon={<Calendar size={20} />}
            label="Manage other sessions"
            description="Adjust dates or capacity"
          />
        </QuickActionsGrid>
      </Section>
      {otherSessions.length > 0 && (
        <Section title="Other upcoming sessions" linkHref="/camps" linkLabel="Manage all">
          <SessionCapacityList sessions={otherSessions} limit={6} />
        </Section>
      )}
    </>
  )
}
