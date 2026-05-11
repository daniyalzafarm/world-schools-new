'use client'

import type { Child } from '@/types/child'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import { GreetingHeader } from '../greeting-header'
import { ChildrenRow } from '../children-row'
import { CountdownHeader } from '../countdown-header'
import { Checklist } from '../checklist'
import { Section } from '../section'
import { BookingCard } from '../booking-card'

interface DashboardPreCampProps {
  children: Child[]
  primary: ParentBookingGroupSummary
  upcoming: ParentBookingGroupSummary[]
}

export function DashboardPreCamp({ children, primary, upcoming }: DashboardPreCampProps) {
  const others = upcoming.filter(b => b.id !== primary.id)
  return (
    <>
      <GreetingHeader subtitle="Camp is coming up — let's make sure you're ready." />
      <ChildrenRow children={children} />
      <CountdownHeader booking={primary} />
      <Checklist booking={primary} children={children} />
      {others.length > 0 && (
        <Section title="Other upcoming bookings" linkHref="/bookings" linkLabel="See all">
          <div className="grid grid-cols-1 gap-3">
            {others.slice(0, 3).map(b => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        </Section>
      )}
    </>
  )
}
