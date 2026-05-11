'use client'

import type { Child } from '@/types/child'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import type { ChecklistItemViewModel } from '@/types/dashboard'
import { Section } from './section'
import { ChecklistItem } from './checklist-item'

interface ChecklistProps {
  booking: ParentBookingGroupSummary
  children: Child[]
}

const CONFIRMED = new Set(['accepted', 'deposit_paid', 'fully_paid', 'at_camp', 'completed'])

function buildItems(
  booking: ParentBookingGroupSummary,
  children: Child[]
): ChecklistItemViewModel[] {
  const bookedChildIds = new Set(booking.children.map(c => c.id))
  const bookedChildren = children.filter(c => bookedChildIds.has(c.id))

  const allProfilesComplete =
    bookedChildren.length > 0 && bookedChildren.every(c => c.profileCompletion === 100)
  const everyoneHasEmergency =
    bookedChildren.length > 0 && bookedChildren.every(c => c.emergencyContacts.length >= 1)
  const firstIncomplete = bookedChildren.find(c => c.profileCompletion < 100)
  const firstWithoutEmergency = bookedChildren.find(c => c.emergencyContacts.length === 0)

  const items: ChecklistItemViewModel[] = [
    {
      id: 'profile',
      label: 'Complete each child’s profile',
      done: allProfilesComplete,
      actionHref: firstIncomplete ? `/account/children/${firstIncomplete.id}` : undefined,
    },
    {
      id: 'emergency',
      label: 'Add an emergency contact',
      done: everyoneHasEmergency,
      actionHref: firstWithoutEmergency
        ? `/account/children/${firstWithoutEmergency.id}/emergency-contacts`
        : undefined,
    },
    {
      id: 'booking',
      label: 'Confirm booking details',
      done: CONFIRMED.has(booking.status),
      actionHref: `/bookings/${booking.id}`,
    },
  ]

  return items
}

export function Checklist({ booking, children }: ChecklistProps) {
  const items = buildItems(booking, children)
  const doneCount = items.filter(i => i.done).length

  return (
    <Section title={`Pre-camp checklist (${doneCount}/${items.length})`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <ChecklistItem key={item.id} item={item} />
        ))}
      </div>
    </Section>
  )
}
