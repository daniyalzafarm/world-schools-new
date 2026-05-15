'use client'

import { MessageCircle, Tent, Users } from 'lucide-react'
import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'
import type { Camp } from '@/types/camps'
import type { Session } from '@/types/sessions'
import type { GoogleBusinessProfile } from '@/types/onboarding'
import { GreetingHeader } from '../greeting-header'
import { LiveBanner } from '../live-banner'
import { Section } from '../section'
import { ScheduleSection } from '../schedule-section'
import { StatsGrid } from '../stats-grid'
import { StatCard } from '../stat-card'
import { EmergencyContactsCard } from '../emergency-contacts-card'
import { SessionCapacityList } from '../session-capacity-list'
import { QuickActionsGrid } from '../quick-actions-grid'
import { QuickActionTile } from '../quick-action-tile'
import { ActivityFeed, buildBookingActivity } from '../activity-feed'

interface DashboardDuringCampProps {
  businessName: string | null
  liveSession: Session
  liveCamp: Camp | null
  atCampBookings: ProviderBookingGroupSummary[]
  sessions: Session[]
  businessProfile: GoogleBusinessProfile | null
  userEmail?: string | null
  unreadMessages: number
}

export function DashboardDuringCamp({
  businessName,
  liveSession,
  liveCamp,
  atCampBookings,
  sessions,
  businessProfile,
  userEmail,
  unreadMessages,
}: DashboardDuringCampProps) {
  const campersAtCamp = atCampBookings.reduce((sum, b) => sum + b.children.length, 0)
  const otherSessions = sessions.filter(s => s.id !== liveSession.id && s.status === 'published')

  return (
    <>
      <GreetingHeader
        businessName={businessName}
        subtitle="Camp is in session. Everything you need at a glance."
      />
      <LiveBanner session={liveSession} campName={liveCamp?.name} />
      <StatsGrid>
        <StatCard
          icon={<Users size={20} />}
          label="Campers at camp"
          value={campersAtCamp}
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
          icon={<Tent size={20} />}
          label="Other sessions"
          value={otherSessions.length}
          tone="default"
          href="/camps"
        />
        <StatCard
          icon={<Users size={20} />}
          label="Active bookings"
          value={atCampBookings.length}
          tone="primary"
          href="/bookings"
        />
      </StatsGrid>
      {liveCamp && <ScheduleSection camp={liveCamp} liveSession={liveSession} />}
      <Section title="Emergency contacts">
        <EmergencyContactsCard businessProfile={businessProfile} fallbackEmail={userEmail} />
      </Section>
      <Section title="Quick actions">
        <QuickActionsGrid>
          <QuickActionTile
            href="/bookings"
            icon={<Users size={20} />}
            label="Attendee list"
            description="View campers and medical info"
          />
          <QuickActionTile
            href="/messages"
            icon={<MessageCircle size={20} />}
            label="Message parents"
            description={unreadMessages > 0 ? `${unreadMessages} unread` : 'Send an update'}
          />
          <QuickActionTile
            href="/bookings"
            icon={<Tent size={20} />}
            label="Booking details"
            description="Review all bookings"
          />
        </QuickActionsGrid>
      </Section>
      <Section title="Today's activity">
        <ActivityFeed items={buildBookingActivity(atCampBookings, 6)} />
      </Section>
      {otherSessions.length > 0 && (
        <Section title="Other sessions" linkHref="/camps" linkLabel="Manage all">
          <SessionCapacityList sessions={otherSessions} limit={6} />
        </Section>
      )}
    </>
  )
}
