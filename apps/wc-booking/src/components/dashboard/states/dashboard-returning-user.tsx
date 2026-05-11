'use client'

import type { Child } from '@/types/child'
import type { Wishlist } from '@/types/wishlists'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import { GreetingHeader } from '../greeting-header'
import { ChildrenRow } from '../children-row'
import { LocationBadge } from '../location-badge'
import { Section } from '../section'
import { BookingCard } from '../booking-card'
import { QuickLinksGrid } from '../quick-links-grid'
import { WishlistGrid } from '../wishlist-grid'
import { ActivityGrid } from '../activity-grid'

interface DashboardReturningUserProps {
  children: Child[]
  wishlists: Wishlist[]
  upcoming: ParentBookingGroupSummary[]
  bookingsCount: number
  locationLabel?: string | null
}

export function DashboardReturningUser({
  children,
  wishlists,
  upcoming,
  bookingsCount,
  locationLabel,
}: DashboardReturningUserProps) {
  const next = upcoming[0]
  return (
    <>
      <GreetingHeader
        subtitle="Welcome back — ready for another adventure?"
        trailing={locationLabel ? <LocationBadge label={locationLabel} /> : undefined}
      />
      <ChildrenRow children={children} />
      {next ? (
        <Section title="Next up" linkHref="/bookings" linkLabel="All bookings">
          <BookingCard booking={next} />
        </Section>
      ) : (
        <Section title="Quick actions">
          <QuickLinksGrid />
        </Section>
      )}
      {wishlists.length > 0 && (
        <Section title="Your lists" linkHref="/wishlists" linkLabel="Manage">
          <WishlistGrid wishlists={wishlists} />
        </Section>
      )}
      <Section title="At a glance">
        <ActivityGrid bookingsCount={bookingsCount} wishlistsCount={wishlists.length} />
      </Section>
    </>
  )
}
