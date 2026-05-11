'use client'

import type { Child } from '@/types/child'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import { GreetingHeader } from '../greeting-header'
import { ChildrenRow } from '../children-row'
import { BookingCelebrationCard } from '../booking-celebration-card'
import { Checklist } from '../checklist'
import { Section } from '../section'

interface DashboardFirstBookingProps {
  children: Child[]
  booking: ParentBookingGroupSummary
}

export function DashboardFirstBooking({ children, booking }: DashboardFirstBookingProps) {
  return (
    <>
      <GreetingHeader subtitle="Your first camp is locked in. Here's what's next." />
      <ChildrenRow children={children} />
      <BookingCelebrationCard booking={booking} />
      <Checklist booking={booking} children={children} />
      <Section title="Plan more adventures" linkHref="/camps" linkLabel="Browse camps">
        <p className="text-sm text-default-500">
          Save more camps to your wishlists or book another session for the same dates.
        </p>
      </Section>
    </>
  )
}
