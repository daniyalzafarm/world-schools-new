'use client'

import Link from 'next/link'
import { ArrowRight, Calendar, DollarSign, Users } from 'lucide-react'
import type { Session } from '@/types/sessions'

interface SessionStatusCardProps {
  session: Session
  badgeLabel: string
  statusLabel?: string
  manageHref?: string
  currency?: string
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

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${currency} ${value}`
  }
}

function formatPrice(session: Session, currency: string): string | null {
  if (session.pricingType === 'single' && typeof session.price === 'number') {
    return `${formatCurrency(session.price, currency)} / child`
  }
  if (
    session.pricingType === 'age_group' &&
    Array.isArray(session.ageGroupPrices) &&
    session.ageGroupPrices.length > 0
  ) {
    const min = Math.min(...session.ageGroupPrices.map(p => p.price))
    return `from ${formatCurrency(min, currency)} / child`
  }
  return null
}

export function SessionStatusCard({
  session,
  badgeLabel,
  statusLabel = 'Live and searchable',
  manageHref = '/camps',
  currency = 'EUR',
}: SessionStatusCardProps) {
  const total = session.totalSpots ?? 0
  const booked = session.bookedCount ?? 0
  const priceLabel = formatPrice(session, currency)

  return (
    <article className="rounded-2xl border border-default-200 bg-background p-5 transition-all hover:border-foreground hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="truncate text-base font-semibold text-foreground">{session.name}</h3>
        <span className="shrink-0 rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
          {badgeLabel}
        </span>
      </div>
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-default-500">
        <div className="inline-flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-default-100">
            <Calendar size={14} />
          </span>
          {formatRange(session.startDate, session.endDate)}
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-default-100">
            <Users size={14} />
          </span>
          {booked} / {total > 0 ? total : '—'} spots filled
        </div>
        {priceLabel && (
          <div className="inline-flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-default-100">
              <DollarSign size={14} />
            </span>
            {priceLabel}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-default-200 pt-3">
        <div className="inline-flex items-center gap-2 text-xs text-default-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
          {statusLabel}
        </div>
        <Link
          href={manageHref}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800"
        >
          Manage session
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  )
}
