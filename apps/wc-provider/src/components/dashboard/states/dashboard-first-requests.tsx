'use client'

import { Calendar, DollarSign, MailOpen, MessageCircle, Tent } from 'lucide-react'
import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'
import type { Session } from '@/types/sessions'
import { GreetingHeader } from '../greeting-header'
import { Section } from '../section'
import { StatsGrid } from '../stats-grid'
import { StatCard } from '../stat-card'
import { BookingRequestList } from '../booking-request-list'
import { SessionCapacityList } from '../session-capacity-list'
import { QuickActionsGrid } from '../quick-actions-grid'
import { QuickActionTile } from '../quick-action-tile'
import { ActivityFeed, buildBookingActivity } from '../activity-feed'

interface DashboardFirstRequestsProps {
  businessName: string | null
  bookingRequests: ProviderBookingGroupSummary[]
  sessions: Session[]
  unreadMessages: number
}

export function DashboardFirstRequests({
  businessName,
  bookingRequests,
  sessions,
  unreadMessages,
}: DashboardFirstRequestsProps) {
  const potentialRevenue = bookingRequests.reduce((sum, r) => sum + r.totalAmount, 0)
  const currency = bookingRequests[0]?.currency ?? 'EUR'
  const formatted = (() => {
    try {
      return new Intl.NumberFormat('en', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(potentialRevenue)
    } catch {
      return `${currency} ${potentialRevenue}`
    }
  })()
  const publishedSessions = sessions.filter(s => s.status === 'published')

  return (
    <>
      <GreetingHeader
        businessName={businessName}
        subtitle="Your first booking requests have arrived. Respond quickly to win parents."
      />
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
          label="Potential revenue"
          value={formatted}
          tone="primary"
        />
        <StatCard
          icon={<Tent size={20} />}
          label="Sessions live"
          value={publishedSessions.length}
          tone="default"
        />
        <StatCard
          icon={<MessageCircle size={20} />}
          label="Unread messages"
          value={unreadMessages}
          tone={unreadMessages > 0 ? 'warning' : 'default'}
          href="/messages"
        />
      </StatsGrid>
      <Section
        title={`Pending requests (${bookingRequests.length})`}
        linkHref="/bookings"
        linkLabel="Review all"
      >
        <BookingRequestList requests={bookingRequests} limit={5} />
      </Section>
      <Section title="Quick response tips">
        <div className="rounded-2xl border border-default-200 bg-background p-5">
          <ul className="grid grid-cols-1 gap-3 text-sm text-default-600 sm:grid-cols-2">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
              <span>Respond within 24 hours — parents are comparing options.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
              <span>Personalize your acceptance message to build trust.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
              <span>Be clear about deposits, refunds, and what to bring.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
              <span>Decline politely — parents may book another session later.</span>
            </li>
          </ul>
        </div>
      </Section>
      <Section title="Quick actions">
        <QuickActionsGrid>
          <QuickActionTile
            href="/bookings"
            icon={<MailOpen size={20} />}
            label="Review requests"
            description="Accept or decline pending requests"
          />
          <QuickActionTile
            href="/messages"
            icon={<MessageCircle size={20} />}
            label="Open messages"
            description="Reply to parents"
          />
          <QuickActionTile
            href="/camps"
            icon={<Calendar size={20} />}
            label="Manage sessions"
            description="Adjust dates or capacity"
          />
        </QuickActionsGrid>
      </Section>
      <Section title="Recent activity">
        <ActivityFeed items={buildBookingActivity(bookingRequests, 6)} />
      </Section>
      <Section title="Your sessions" linkHref="/camps" linkLabel="Manage all">
        <SessionCapacityList sessions={publishedSessions} limit={6} />
      </Section>
    </>
  )
}
