'use client'

import Link from 'next/link'
import { Calendar, Users } from 'lucide-react'
import type { ProviderBookingGroupSummary } from '@world-schools/wc-types'

interface BookingRequestListItemProps {
  request: ProviderBookingGroupSummary
}

function formatRange(start: string, end: string): string {
  try {
    const s = new Date(start)
    const e = new Date(end)
    const sMonth = s.toLocaleString('en', { month: 'short' })
    const eMonth = e.toLocaleString('en', { month: 'short' })
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
    if (sameMonth) return `${sMonth} ${s.getDate()}–${e.getDate()}`
    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`
  } catch {
    return ''
  }
}

function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value}`
  }
}

export function BookingRequestListItem({ request }: BookingRequestListItemProps) {
  const childCount = request.children.length
  return (
    <Link
      href="/bookings"
      className="flex items-center justify-between gap-4 rounded-2xl border border-default-200 bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {request.parent.displayName}
        </p>
        <p className="truncate text-xs text-default-500">{request.camp.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-default-500">
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} />
            {formatRange(request.session.startDate, request.session.endDate)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users size={12} />
            {childCount} {childCount === 1 ? 'child' : 'children'}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-foreground">
          {formatAmount(request.totalAmount, request.currency)}
        </p>
        <p className="text-xs text-warning-600">Pending</p>
      </div>
    </Link>
  )
}
