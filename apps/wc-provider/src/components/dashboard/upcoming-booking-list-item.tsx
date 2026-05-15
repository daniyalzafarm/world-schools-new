'use client'

import Link from 'next/link'
import { Calendar, Users } from 'lucide-react'
import type { BookingGroupStatus, ProviderBookingGroupSummary } from '@world-schools/wc-types'

interface UpcomingBookingListItemProps {
  booking: ProviderBookingGroupSummary
}

const STATUS_LABEL: Partial<Record<BookingGroupStatus, string>> = {
  accepted: 'Accepted',
  deposit_paid: 'Deposit paid',
  fully_paid: 'Fully paid',
  at_camp: 'At camp',
  completed: 'Completed',
  request: 'Request',
}

const STATUS_TONE: Partial<Record<BookingGroupStatus, string>> = {
  accepted: 'bg-primary-50 text-primary-700',
  deposit_paid: 'bg-primary-50 text-primary-700',
  fully_paid: 'bg-success-50 text-success-700',
  at_camp: 'bg-secondary-50 text-secondary-700',
  completed: 'bg-default-100 text-default-700',
  request: 'bg-warning-50 text-warning-700',
}

function formatRange(start: string, end: string): string {
  try {
    const s = new Date(start)
    const e = new Date(end)
    const sMonth = s.toLocaleString('en', { month: 'short' })
    const eMonth = e.toLocaleString('en', { month: 'short' })
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
    if (sameMonth) return `${sMonth} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`
    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${e.getFullYear()}`
  } catch {
    return ''
  }
}

export function UpcomingBookingListItem({ booking }: UpcomingBookingListItemProps) {
  const childCount = booking.children.length
  const label = STATUS_LABEL[booking.status] ?? booking.status
  const tone = STATUS_TONE[booking.status] ?? 'bg-default-100 text-default-700'

  return (
    <Link
      href="/bookings"
      className="flex items-center justify-between gap-4 rounded-2xl border border-default-200 bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{booking.camp.name}</p>
        <p className="truncate text-xs text-default-500">{booking.session.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-default-500">
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} />
            {formatRange(booking.session.startDate, booking.session.endDate)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users size={12} />
            {childCount} {childCount === 1 ? 'child' : 'children'}
          </span>
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{label}</span>
    </Link>
  )
}
