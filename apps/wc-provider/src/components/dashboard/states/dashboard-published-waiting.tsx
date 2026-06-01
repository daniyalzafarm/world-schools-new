'use client'

import { useCallback } from 'react'
import { addToast } from '@heroui/react'
import {
  BarChart3,
  Calendar,
  Camera,
  ClipboardList,
  Clock,
  DollarSign,
  MessageCircle,
  Share2,
} from 'lucide-react'
import type { Camp } from '@/types/camps'
import type { Session } from '@/types/sessions'
import { type CampStatistics, generatePreviewToken } from '@/services/camps.services'
import config from '@/config/config'
import { GreetingHeader } from '../greeting-header'
import { WelcomeHero } from '../welcome-hero'
import { Section } from '../section'
import { SessionStatusList } from '../session-status-list'
import { QuickActionsGrid } from '../quick-actions-grid'
import { QuickActionTile } from '../quick-action-tile'
import { StatsGrid } from '../stats-grid'
import { StatCard } from '../stat-card'
import { SetupProgressCard, type SetupStep } from '../setup-progress-card'
import { InfoTipsCard } from '../info-tips-card'
import { HelpBanner } from '../help-banner'

interface DashboardPublishedWaitingProps {
  businessName: string | null
  camps: Camp[]
  sessions: Session[]
  statistics: CampStatistics
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

export function DashboardPublishedWaiting({
  businessName,
  camps,
  sessions,
  statistics,
}: DashboardPublishedWaitingProps) {
  const publishedCampIds = new Set(camps.filter(c => c.status === 'published').map(c => c.id))
  const publishedSessions = sessions.filter(
    s => s.status === 'published' && publishedCampIds.has(s.campId)
  )
  const currency = statistics.currency
  const primaryCamp = camps.find(c => c.status === 'published') ?? camps[0] ?? null

  const handleViewPublicProfile = useCallback(async () => {
    if (!primaryCamp) {
      addToast({
        title: 'No camp available',
        description: 'Create or publish a camp before previewing your public profile.',
        color: 'danger',
      })
      return
    }
    const response = await generatePreviewToken(primaryCamp.id)
    if (!response.success) {
      addToast({
        title: 'Error',
        description: 'Failed to open camp preview. Please try again.',
        color: 'danger',
      })
      return
    }
    const campUrl = `${config.app.bookingAppUrl}/camps/${primaryCamp.slug}?preview=${response.data.token}`
    window.open(campUrl, '_blank')
  }, [primaryCamp])

  const heroSubtitle = primaryCamp
    ? `${primaryCamp.name} is live and searchable. Parents can now discover and book your sessions. Bookings typically start within the first 2 weeks of going live.`
    : 'Parents can now discover and book your sessions. Bookings typically start within the first 2 weeks of going live.'

  const setupSteps: SetupStep[] = [
    { id: 'approved', title: 'Account approved', status: 'completed', doneText: 'Complete' },
    { id: 'listing', title: 'Camp listing created', status: 'completed', doneText: 'Complete' },
    {
      id: 'sessions',
      title: 'Sessions published',
      status: 'completed',
      doneText: `${publishedSessions.length} ${publishedSessions.length === 1 ? 'session' : 'sessions'} live`,
    },
    {
      id: 'first-booking',
      title: 'Receive your first booking',
      status: 'current',
      ctaLabel: 'Boost visibility',
      ctaHref: '/camps',
    },
  ]

  return (
    <>
      <GreetingHeader
        businessName={businessName}
        subtitle="Your sessions are live. Hang tight — parents will start booking soon."
      />
      <WelcomeHero
        emoji="✅"
        title="Your camp is live and searchable!"
        subtitle={heroSubtitle}
        ctaLabel="View your public profile"
        onCtaPress={handleViewPublicProfile}
        stats={[{ label: 'Sessions live', value: publishedSessions.length }]}
      />
      <SetupProgressCard steps={setupSteps} />
      <Section title="Your sessions" linkHref="/camps" linkLabel="Manage all">
        <SessionStatusList
          sessions={publishedSessions}
          limit={6}
          badgeLabel="Waiting for bookings"
          statusLabel="Live and searchable"
          currency={currency}
        />
      </Section>
      <Section title="Boost your visibility">
        <QuickActionsGrid>
          <QuickActionTile
            href="/camps"
            icon={<Camera size={20} />}
            label="Add more photos"
            description="Camps with 6+ photos get 3× more views from parents."
          />
          <QuickActionTile
            href="/camps"
            icon={<ClipboardList size={20} />}
            label="Complete daily schedule"
            description="Parents love knowing what a typical day looks like at your camp."
          />
          <QuickActionTile
            href="/camps"
            icon={<DollarSign size={20} />}
            label="Review pricing"
            description="Early-bird discounts help sessions fill 40% faster on average."
          />
        </QuickActionsGrid>
      </Section>
      <Section title="Stats overview">
        <StatsGrid>
          <StatCard
            icon={<Calendar size={20} />}
            label="Bookings"
            value={0}
            hint="No requests yet"
            tone="default"
          />
          <StatCard
            icon={<DollarSign size={20} />}
            label="Revenue"
            value={formatCurrency(0, currency)}
            hint="—"
            tone="default"
          />
        </StatsGrid>
      </Section>
      <InfoTipsCard
        icon={<Clock size={22} />}
        iconTone="warning"
        title="When do parents book?"
        subtitle="Understanding booking patterns helps you plan ahead"
        tips={[
          {
            id: '2-4-weeks',
            icon: <Calendar size={16} />,
            title: '2–4 weeks ahead',
            description: 'Most parents browse and book 2–4 weeks before camp start dates',
          },
          {
            id: 'peak-season',
            icon: <BarChart3 size={16} />,
            title: 'Peak season: March – May',
            description: 'Summer camps see the highest booking volume during spring months',
          },
          {
            id: 'enquiries',
            icon: <MessageCircle size={16} />,
            title: 'Enquiries come first',
            description: 'Parents usually send a message or enquiry before committing to a booking',
          },
          {
            id: 'social',
            icon: <Share2 size={16} />,
            title: 'Share on social media',
            description: 'Sharing your camp link increases visibility and drives more traffic',
          },
        ]}
      />
      <HelpBanner
        title="Need help getting your first booking?"
        subtitle="Read our guide on optimising your listing, or talk to our support team"
        ctaLabel="Visit Help Center"
        ctaHref="/help"
      />
    </>
  )
}
