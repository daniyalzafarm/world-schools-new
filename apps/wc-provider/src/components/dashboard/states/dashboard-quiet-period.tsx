'use client'

import Link from 'next/link'
import { Calendar, Camera, DollarSign, MessageSquareReply, Star, Tent, Users } from 'lucide-react'
import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'
import type { Camp } from '@/types/camps'
import type { ChecklistItemViewModel } from '@/types/provider-dashboard'
import type { CampStatistics } from '@/services/camps.services'
import type { ProviderReviewSummary } from '@/services/provider-reviews.services'
import { GreetingHeader } from '../greeting-header'
import { OffSeasonBanner } from '../off-season-banner'
import { Section } from '../section'
import { Checklist } from '../checklist'
import { StatsGrid } from '../stats-grid'
import { StatCard } from '../stat-card'
import { QuickActionsGrid } from '../quick-actions-grid'
import { QuickActionTile } from '../quick-action-tile'
import { ReviewsList } from '../reviews-list'

interface DashboardQuietPeriodProps {
  businessName: string | null
  camps: Camp[]
  pastBookings: ProviderBookingGroupSummary[]
  statistics: CampStatistics | null
  recentReviews: ProviderReviewSummary[]
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

export function DashboardQuietPeriod({
  businessName,
  camps,
  pastBookings,
  statistics,
  recentReviews,
}: DashboardQuietPeriodProps) {
  const lastSeasonYear = (() => {
    if (pastBookings.length === 0) return new Date().getFullYear()
    const mostRecent = [...pastBookings].sort(
      (a, b) => new Date(b.session.endDate).getTime() - new Date(a.session.endDate).getTime()
    )[0]
    return new Date(mostRecent.session.endDate).getFullYear()
  })()

  const totalCampers = pastBookings.reduce((sum, b) => sum + b.children.length, 0)
  const currency = statistics?.currency ?? 'EUR'
  const lastSeasonRevenue = statistics?.revenueLastSeason ?? 0
  const averageRating = statistics?.averageRating ?? 0
  const unrespondedReviews = statistics?.unrespondedReviews ?? 0

  const items: ChecklistItemViewModel[] = [
    {
      id: 'refresh-photos',
      label: 'Refresh your camp photos',
      done: false,
      actionHref: '/camps',
    },
    {
      id: 'update-pricing',
      label: 'Review and update pricing',
      done: false,
      actionHref: '/camps',
    },
    {
      id: 'plan-sessions',
      label: 'Plan next year sessions',
      done: false,
      actionHref: '/camps',
    },
    { id: 'review-camps', label: 'Update camp descriptions', done: false, actionHref: '/camps' },
  ]

  return (
    <>
      <GreetingHeader
        businessName={businessName}
        subtitle={`Reflecting on ${lastSeasonYear}. Let's set up an even stronger next season.`}
      />
      <StatsGrid>
        <StatCard
          icon={<DollarSign size={20} />}
          label="Last-season revenue"
          value={formatCurrency(lastSeasonRevenue, currency)}
          tone="success"
        />
        <StatCard
          icon={<Users size={20} />}
          label="Total campers"
          value={totalCampers}
          tone="primary"
        />
        <StatCard
          icon={<Star size={20} />}
          label="Avg rating"
          value={averageRating > 0 ? averageRating.toFixed(1) : '—'}
          hint={statistics?.reviewCount ? `${statistics.reviewCount} reviews` : undefined}
          tone="warning"
        />
        <StatCard
          icon={<MessageSquareReply size={20} />}
          label="Unresponded reviews"
          value={unrespondedReviews}
          tone={unrespondedReviews > 0 ? 'warning' : 'default'}
        />
      </StatsGrid>
      <OffSeasonBanner year={lastSeasonYear} />
      <Section title="Prepare for next year">
        <QuickActionsGrid>
          <QuickActionTile
            href="/camps"
            icon={<Calendar size={20} />}
            label="Plan new sessions"
            description="Add session dates for next year"
          />
          <QuickActionTile
            href="/camps"
            icon={<Camera size={20} />}
            label="Refresh photos"
            description="Update with your best shots"
          />
          <QuickActionTile
            href="/camps"
            icon={<DollarSign size={20} />}
            label="Adjust pricing"
            description="Review your rates and policies"
          />
        </QuickActionsGrid>
      </Section>
      <Checklist title="Off-season to-do" items={items} />
      {recentReviews.length > 0 && (
        <Section title="Recent reviews">
          <ReviewsList reviews={recentReviews} limit={5} />
        </Section>
      )}
      {camps.length > 0 && (
        <Section title="Your camps" linkHref="/camps" linkLabel="Manage all">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {camps.slice(0, 6).map(c => (
              <Link
                key={c.id}
                href={`/camps/${c.id}/edit/basic-info`}
                className="flex items-start gap-3 rounded-2xl border border-default-200 bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-default-100 text-default-700">
                  <Tent size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                  <p className="text-xs capitalize text-default-500">
                    {c.type} · {c.status}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}
