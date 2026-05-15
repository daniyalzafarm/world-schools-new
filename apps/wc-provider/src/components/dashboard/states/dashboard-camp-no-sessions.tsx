'use client'

import Link from 'next/link'
import { Calendar, Camera, DollarSign } from 'lucide-react'
import { cn } from '@world-schools/ui-web'
import type { Camp, CampStatus } from '@/types/camps'
import type { Session } from '@/types/sessions'
import { GreetingHeader } from '../greeting-header'
import { WelcomeHero } from '../welcome-hero'
import { Section } from '../section'
import { QuickActionsGrid } from '../quick-actions-grid'
import { QuickActionTile } from '../quick-action-tile'

interface DashboardCampNoSessionsProps {
  businessName: string | null
  camps: Camp[]
  sessions?: Session[]
}

const STATUS_LABEL: Record<CampStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

const STATUS_TONE: Record<CampStatus, string> = {
  draft: 'bg-warning-50 text-warning-700',
  published: 'bg-success-50 text-success-700',
  archived: 'bg-default-100 text-default-600',
}

export function DashboardCampNoSessions({
  businessName,
  camps,
  sessions,
}: DashboardCampNoSessionsProps) {
  const publishedCamps = camps.filter(c => c.status === 'published')
  const hasPublished = publishedCamps.length > 0
  const primaryCamp = publishedCamps[0] ?? camps[0]
  const sessionCounts = new Map<string, number>()
  if (sessions) {
    for (const s of sessions) {
      sessionCounts.set(s.campId, (sessionCounts.get(s.campId) ?? 0) + 1)
    }
  }

  const heroTitle = hasPublished ? 'Your camp is published!' : 'Finish your camp setup'
  const heroSubtitle = hasPublished
    ? primaryCamp
      ? `${primaryCamp.name} is live. Add sessions with dates and pricing to start receiving requests.`
      : 'Add sessions with dates and pricing to start receiving requests.'
    : primaryCamp
      ? `${primaryCamp.name} is still a draft. Publish it (and add sessions) to start receiving requests.`
      : 'Publish your camp and add sessions to start receiving requests.'
  const heroCta = hasPublished ? 'Add sessions' : 'Continue setup'
  const subtitle = hasPublished
    ? 'Add session dates so parents can start booking.'
    : 'Publish your camp and add sessions to go live.'

  return (
    <>
      <GreetingHeader businessName={businessName} subtitle={subtitle} />
      <WelcomeHero
        emoji={hasPublished ? '📅' : '🛠️'}
        title={heroTitle}
        subtitle={heroSubtitle}
        ctaLabel={heroCta}
        ctaHref="/camps"
      />
      <Section title="Next steps">
        <QuickActionsGrid>
          <QuickActionTile
            href="/camps"
            icon={<Calendar size={20} />}
            label="Create sessions"
            description="Set dates, capacity, and pricing"
          />
          <QuickActionTile
            href="/camps"
            icon={<Camera size={20} />}
            label="Add more photos"
            description="Strong photos drive bookings"
          />
          {hasPublished && (
            <QuickActionTile
              href="/camps"
              icon={<DollarSign size={20} />}
              label="Review pricing"
              description="Set competitive rates"
            />
          )}
          {!hasPublished && (
            <QuickActionTile
              href="/camps"
              icon={<Calendar size={20} />}
              label="Publish your camp"
              description="Finish required sections and go live"
            />
          )}
        </QuickActionsGrid>
      </Section>
      <Section title="Your camps">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {camps.map(c => {
            const count = sessionCounts.get(c.id) ?? 0
            const sessionLine =
              count === 0
                ? 'No sessions yet'
                : c.status === 'published'
                  ? `${count} session${count === 1 ? '' : 's'}`
                  : `${count} session${count === 1 ? '' : 's'} — publish camp to go live`
            return (
              <Link
                key={c.id}
                href={`/camps/${c.id}/edit/basic-info`}
                className="rounded-2xl border border-default-200 bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      STATUS_TONE[c.status]
                    )}
                  >
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs capitalize text-default-500">{c.type} camp</p>
                <p className="mt-2 text-xs text-warning-600">{sessionLine}</p>
              </Link>
            )
          })}
        </div>
      </Section>
    </>
  )
}
