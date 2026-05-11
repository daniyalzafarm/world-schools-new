'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatSessionRange } from '@world-schools/wc-frontend-utils'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import { daysUntil } from '@/utils/dashboard'

interface BookingCardProps {
  booking: ParentBookingGroupSummary
}

export function BookingCard({ booking }: BookingCardProps) {
  const days = daysUntil(booking.session.startDate)
  const range = formatSessionRange(
    booking.session.startDate,
    booking.session.endDate,
    booking.session.name
  )

  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="flex items-center gap-4 rounded-2xl border border-default-200 bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-md sm:p-5"
    >
      {booking.camp.coverImageUrl ? (
        <div
          className="h-16 w-16 shrink-0 rounded-xl bg-cover bg-center"
          style={{ backgroundImage: `url(${booking.camp.coverImageUrl})` }}
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-2xl">
          🏕️
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">{booking.camp.name}</p>
        <p className="truncate text-sm text-default-500">{range}</p>
        <p className="mt-1 truncate text-xs text-default-500">
          {booking.children.map(c => c.firstName).join(', ')}
        </p>
      </div>
      {days != null && days >= 0 && (
        <span className="hidden whitespace-nowrap rounded-full bg-default-100 px-3 py-1 text-xs font-semibold text-foreground sm:inline-block">
          {days === 0 ? 'Today' : `${days}d`}
        </span>
      )}
      <ChevronRight size={20} className="shrink-0 text-default-500" />
    </Link>
  )
}
