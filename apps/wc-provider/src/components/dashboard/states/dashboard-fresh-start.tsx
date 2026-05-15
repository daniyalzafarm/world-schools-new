'use client'

import { Camera, ClipboardList, Sparkles, Tent } from 'lucide-react'
import type { ChecklistItemViewModel } from '@/types/provider-dashboard'
import type { OnboardingStatus } from '@/types/onboarding'
import { GreetingHeader } from '../greeting-header'
import { WelcomeHero } from '../welcome-hero'
import { Section } from '../section'
import { Checklist } from '../checklist'
import { QuickActionsGrid } from '../quick-actions-grid'
import { QuickActionTile } from '../quick-action-tile'

interface DashboardFreshStartProps {
  businessName: string | null
  onboardingStatus: OnboardingStatus | null
}

function buildChecklist(status: OnboardingStatus | null): ChecklistItemViewModel[] {
  const c = status?.stepCompletion
  return [
    {
      id: 'business-profile',
      label: 'Complete your business profile',
      done: Boolean(c?.step1 && c?.step2),
      actionHref: '/onboarding/status',
    },
    {
      id: 'first-camp',
      label: 'Create your first camp',
      done: false,
      actionHref: '/camps',
    },
    {
      id: 'photos',
      label: 'Upload camp photos',
      done: false,
      actionHref: '/camps',
    },
    {
      id: 'banking',
      label: 'Connect payouts',
      done: Boolean(status?.stripeOnboardingCompleted),
      actionHref: '/onboarding/stripe-connect',
    },
  ]
}

export function DashboardFreshStart({ businessName, onboardingStatus }: DashboardFreshStartProps) {
  const items = buildChecklist(onboardingStatus)

  return (
    <>
      <GreetingHeader
        businessName={businessName}
        subtitle="You're approved — let's get your first camp live."
      />
      <WelcomeHero
        emoji="🎉"
        title="You're approved!"
        subtitle="Welcome to World Camps. Create your first camp listing to start receiving bookings."
        ctaLabel="Create your first camp"
        ctaHref="/camps"
      />
      <Checklist title="Getting started" items={items} />
      <Section title="Tips from successful camps">
        <QuickActionsGrid>
          <QuickActionTile
            href="/camps"
            icon={<Camera size={20} />}
            label="Upload great photos"
            description="Camps with 6+ photos get 3× more views"
          />
          <QuickActionTile
            href="/camps"
            icon={<ClipboardList size={20} />}
            label="Detail your schedule"
            description="Parents look for daily activity breakdowns"
          />
          <QuickActionTile
            href="/camps"
            icon={<Tent size={20} />}
            label="Highlight what's included"
            description="Meals, gear, transportation — be specific"
          />
        </QuickActionsGrid>
      </Section>
      <Section title="Your journey to the first booking">
        <div className="rounded-2xl border border-default-200 bg-background p-6">
          <ol className="space-y-4">
            {[
              { step: 1, title: 'Create your camp', desc: 'Add your camp details and photos.' },
              { step: 2, title: 'Add sessions', desc: 'Set dates, prices, and capacity.' },
              { step: 3, title: 'Publish & share', desc: 'Go live and share with your community.' },
              { step: 4, title: 'Welcome bookings', desc: 'Review and accept booking requests.' },
            ].map(s => (
              <li key={s.step} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">
                  {s.step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="text-xs text-default-500">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 text-xs text-primary-700">
            <Sparkles size={14} />
            <span>Most providers receive their first booking within 14 days of publishing.</span>
          </div>
        </div>
      </Section>
    </>
  )
}
