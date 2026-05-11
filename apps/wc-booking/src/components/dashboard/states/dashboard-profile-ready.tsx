'use client'

import type { Child } from '@/types/child'
import { GreetingHeader } from '../greeting-header'
import { ChildrenRow } from '../children-row'
import { InterestPrompt } from '../interest-prompt'
import { Section } from '../section'

interface DashboardProfileReadyProps {
  children: Child[]
}

export function DashboardProfileReady({ children }: DashboardProfileReadyProps) {
  return (
    <>
      <GreetingHeader subtitle="Your family is set up. Let's find the perfect camp." />
      <ChildrenRow children={children} />
      <InterestPrompt children={children} />
      <Section title="Browse by age" linkHref="/camps" linkLabel="See all camps">
        <p className="text-sm text-default-500">
          Use the search to filter by age range, dates, location, and activities.
        </p>
      </Section>
    </>
  )
}
