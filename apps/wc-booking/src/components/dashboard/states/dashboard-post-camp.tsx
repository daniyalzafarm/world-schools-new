'use client'

import type { AttendedEligible } from '@/services/reviews.services'
import { GreetingHeader } from '../greeting-header'
import { ReviewPromptCard } from '../review-prompt-card'
import { RebookOfferCard } from '../rebook-offer-card'
import { ActivityGrid } from '../activity-grid'
import { Section } from '../section'

interface DashboardPostCampProps {
  eligibleReviews: AttendedEligible[]
  bookingsCount: number
  wishlistsCount: number
}

export function DashboardPostCamp({
  eligibleReviews,
  bookingsCount,
  wishlistsCount,
}: DashboardPostCampProps) {
  const latest = eligibleReviews[0]
  return (
    <>
      <GreetingHeader subtitle="Welcome back. How was camp?" />
      {latest && <ReviewPromptCard eligible={latest} />}
      {latest && <RebookOfferCard eligible={latest} />}
      <Section title="At a glance">
        <ActivityGrid bookingsCount={bookingsCount} wishlistsCount={wishlistsCount} />
      </Section>
    </>
  )
}
