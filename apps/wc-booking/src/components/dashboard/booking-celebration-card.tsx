'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { ArrowRight } from 'lucide-react'
import { formatSessionRange } from '@world-schools/wc-frontend-utils'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import { daysUntil } from '@/utils/dashboard'

interface BookingCelebrationCardProps {
  booking: ParentBookingGroupSummary
}

export function BookingCelebrationCard({ booking }: BookingCelebrationCardProps) {
  const days = daysUntil(booking.session.startDate)
  const range = formatSessionRange(
    booking.session.startDate,
    booking.session.endDate,
    booking.session.name
  )

  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-primary-50 via-primary-100/40 to-default-100 p-8 text-center sm:p-10">
      <div className="pointer-events-none absolute left-[10%] top-5 text-2xl opacity-60">🎉</div>
      <div className="pointer-events-none absolute right-[15%] top-10 text-2xl opacity-60">✨</div>
      <div className="pointer-events-none absolute bottom-7 left-[20%] text-2xl opacity-60">🎊</div>
      <div className="pointer-events-none absolute bottom-5 right-[10%] text-2xl opacity-60">
        ⭐
      </div>

      <div className="mb-4 text-5xl">🎉</div>
      <h2 className="mb-2 text-2xl font-bold text-secondary-500 sm:text-3xl">
        You&apos;re going to camp!
      </h2>
      <p className="mb-6 text-base text-default-500 sm:text-lg">
        Your booking is confirmed. Get ready for an unforgettable experience.
      </p>

      <div className="mx-auto mb-6 flex max-w-xl flex-col items-center gap-3 rounded-2xl bg-background p-5 shadow-md sm:flex-row sm:gap-4 sm:p-6">
        {booking.camp.coverImageUrl ? (
          <div
            className="h-16 w-16 shrink-0 rounded-2xl bg-cover bg-center"
            style={{ backgroundImage: `url(${booking.camp.coverImageUrl})` }}
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-2xl">
            🏕️
          </div>
        )}
        <div className="flex-1 text-left">
          <p className="text-base font-semibold text-foreground">{booking.camp.name}</p>
          <p className="text-sm text-default-500">{range}</p>
        </div>
        {days != null && days >= 0 && (
          <span className="rounded-full bg-secondary-500 px-4 py-2 text-sm font-semibold text-white">
            {days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'} to go`}
          </span>
        )}
      </div>

      <Button
        as={Link}
        href={`/bookings/${booking.id}`}
        color="secondary"
        radius="lg"
        size="lg"
        endContent={<ArrowRight size={18} />}
      >
        View booking details
      </Button>
    </div>
  )
}
