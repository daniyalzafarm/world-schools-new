'use client'

import { formatSessionRange } from '@world-schools/wc-frontend-utils'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'

interface AtCampBannerProps {
  booking: ParentBookingGroupSummary
}

export function AtCampBanner({ booking }: AtCampBannerProps) {
  const childNames =
    booking.children.length === 1
      ? booking.children[0].firstName
      : booking.children
          .slice(0, -1)
          .map(c => c.firstName)
          .join(', ') + ` and ${booking.children[booking.children.length - 1].firstName}`
  const range = formatSessionRange(
    booking.session.startDate,
    booking.session.endDate,
    booking.session.name
  )

  return (
    <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 to-primary-700 p-8 text-secondary-500 sm:p-10">
      <div className="mb-3 text-4xl">🏕️</div>
      <p className="mb-1 text-sm font-medium uppercase tracking-wider opacity-80">
        Camp in progress
      </p>
      <h2 className="mb-2 text-2xl font-bold sm:text-3xl">
        {childNames} {booking.children.length > 1 ? 'are' : 'is'} at camp
      </h2>
      <p className="text-sm opacity-90 sm:text-base">
        {booking.camp.name} · {range}
      </p>
    </div>
  )
}
