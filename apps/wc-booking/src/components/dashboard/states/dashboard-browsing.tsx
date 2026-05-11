'use client'

import type { Child } from '@/types/child'
import type { Wishlist } from '@/types/wishlists'
import { GreetingHeader } from '../greeting-header'
import { ChildrenRow } from '../children-row'
import { Section } from '../section'
import { WishlistGrid } from '../wishlist-grid'
import { WishlistNudge } from '../wishlist-nudge'

interface DashboardBrowsingProps {
  children: Child[]
  wishlists: Wishlist[]
}

export function DashboardBrowsing({ children, wishlists }: DashboardBrowsingProps) {
  return (
    <>
      <GreetingHeader subtitle="Pick up where you left off." />
      <ChildrenRow children={children} />
      {wishlists.length > 0 ? (
        <Section title="Your lists" linkHref="/wishlists" linkLabel="Manage">
          <WishlistGrid wishlists={wishlists} />
        </Section>
      ) : (
        <WishlistNudge />
      )}
    </>
  )
}
