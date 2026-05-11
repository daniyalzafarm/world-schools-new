'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { MessageCircle } from 'lucide-react'
import { formatSessionRange } from '@world-schools/wc-frontend-utils'
import type { ParentBookingGroupSummary } from '@/types/camp-booking'
import { daysUntil } from '@/utils/dashboard'

interface CountdownHeaderProps {
  booking: ParentBookingGroupSummary
}

export function CountdownHeader({ booking }: CountdownHeaderProps) {
  const days = daysUntil(booking.session.startDate) ?? 0
  const status =
    days <= 0 ? "It's almost time!" : `Starts in ${days} ${days === 1 ? 'day' : 'days'}`
  const range = formatSessionRange(
    booking.session.startDate,
    booking.session.endDate,
    booking.session.name
  )

  return (
    <div className="mb-8 overflow-hidden rounded-3xl bg-secondary-500 p-6 text-white sm:p-10">
      <div className="mb-3 text-3xl">🎒</div>
      <p className="mb-1 text-sm font-medium uppercase tracking-wider text-primary-200">{status}</p>
      <h2 className="mb-1 text-2xl font-bold sm:text-3xl">{booking.camp.name}</h2>
      <p className="mb-6 text-sm text-default-100/80 sm:text-base">{range}</p>
      <div className="flex flex-wrap gap-3">
        <Button as={Link} href={`/bookings/${booking.id}`} color="primary" radius="lg">
          View booking
        </Button>
        <Button
          as={Link}
          href="/messages"
          variant="bordered"
          radius="lg"
          className="border-white/40 text-white hover:bg-white/10"
          startContent={<MessageCircle size={18} />}
        >
          Message camp
        </Button>
      </div>
    </div>
  )
}
