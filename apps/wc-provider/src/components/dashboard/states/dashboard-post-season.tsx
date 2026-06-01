'use client'

import { Calendar, Camera, Copy, DollarSign, Sparkles, Star, Tent, Users } from 'lucide-react'
import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'
import type { Camp } from '@/types/camps'
import type { CampStatistics } from '@/services/camps.services'
import type { ProviderReviewSummary } from '@/services/provider-reviews.services'
import { GreetingHeader } from '../greeting-header'
import { RecapBanner } from '../recap-banner'
import { Section } from '../section'
import { StatsGrid } from '../stats-grid'
import { StatCard } from '../stat-card'
import { QuickActionsGrid } from '../quick-actions-grid'
import { QuickActionTile } from '../quick-action-tile'
import { ReviewsList } from '../reviews-list'

interface DashboardPostSeasonProps {
  businessName: string | null
  pastBookings: ProviderBookingGroupSummary[]
  camps: Camp[]
  statistics: CampStatistics
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

export function DashboardPostSeason({
  businessName,
  pastBookings,
  camps,
  statistics,
  recentReviews,
}: DashboardPostSeasonProps) {
  const completed = pastBookings.filter(b => b.status === 'completed')
  const totalCampers = completed.reduce((sum, b) => sum + b.children.length, 0)
  const sessionsRun = new Set(completed.map(b => `${b.camp.name}|${b.session.startDate}`)).size
  const totalRevenue = completed.reduce((sum, b) => sum + (b.paidAmount ?? 0), 0)
  const currency = statistics.currency
  const averageRating = statistics.averageRating

  const year = (() => {
    if (pastBookings.length === 0) return new Date().getFullYear()
    const mostRecent = [...pastBookings].sort(
      (a, b) => new Date(b.session.endDate).getTime() - new Date(a.session.endDate).getTime()
    )[0]
    return new Date(mostRecent.session.endDate).getFullYear()
  })()

  return (
    <>
      <GreetingHeader
        businessName={businessName}
        subtitle="Season wrapped — time to reflect and plan for next year."
      />
      <RecapBanner
        year={year}
        stats={[
          { label: 'Bookings', value: completed.length },
          { label: 'Campers', value: totalCampers },
          { label: 'Revenue', value: formatCurrency(totalRevenue, currency) },
          {
            label: 'Avg rating',
            value: averageRating > 0 ? averageRating.toFixed(1) : '—',
          },
        ]}
      />
      <Section title="Season highlights">
        <StatsGrid>
          <StatCard
            icon={<Calendar size={20} />}
            label="Bookings completed"
            value={completed.length}
            tone="primary"
          />
          <StatCard
            icon={<Users size={20} />}
            label="Total campers"
            value={totalCampers}
            tone="primary"
          />
          <StatCard
            icon={<DollarSign size={20} />}
            label="Total revenue"
            value={formatCurrency(totalRevenue, currency)}
            tone="success"
          />
          <StatCard
            icon={<Star size={20} />}
            label="Avg rating"
            value={averageRating > 0 ? averageRating.toFixed(1) : '—'}
            hint={statistics.reviewCount ? `${statistics.reviewCount} reviews` : undefined}
            tone="warning"
          />
        </StatsGrid>
      </Section>
      {recentReviews.length > 0 && (
        <Section title="Recent reviews">
          <ReviewsList reviews={recentReviews} limit={5} />
        </Section>
      )}
      <Section title="Rebook for next year">
        <QuickActionsGrid>
          <QuickActionTile
            href="/camps"
            icon={<Copy size={20} />}
            label="Duplicate camp"
            description="Reuse details for next year"
          />
          <QuickActionTile
            href="/camps"
            icon={<Calendar size={20} />}
            label="Add new sessions"
            description="Open dates for next season"
          />
          <QuickActionTile
            href="/camps"
            icon={<Camera size={20} />}
            label="Refresh photos"
            description="Add highlights from this year"
          />
        </QuickActionsGrid>
      </Section>
      <Section title="Camps overview">
        <StatsGrid>
          <StatCard
            icon={<Tent size={20} />}
            label="Sessions run"
            value={sessionsRun}
            tone="primary"
          />
          <StatCard
            icon={<Sparkles size={20} />}
            label="Active camps"
            value={camps.length}
            tone="default"
            href="/camps"
          />
        </StatsGrid>
      </Section>
    </>
  )
}
