'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { formatSessionRange, statusBadgeClass, statusLabel } from '@world-schools/wc-frontend-utils'
import type { ParentBookingGroupDetail, ParentBookingGroupStatus } from '@/types/camp-booking'

/**
 * Simplified view shown when a booking was declined. A declined booking has no
 * map, drop-off/pick-up, "Message camp" or "Getting there" — those are
 * irrelevant once the camp says no. Instead we show a short summary and point
 * the parent forward: find another camp, or reach out to support.
 */
export function BookingDeclinedSummary({ detail }: { detail: ParentBookingGroupDetail }) {
  const status = detail.status as ParentBookingGroupStatus
  const cover = detail.camp.coverImageUrl
  const sessionLine = formatSessionRange(
    detail.session.startDate,
    detail.session.endDate,
    detail.session.name
  )

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-default-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="relative aspect-16/10 w-full bg-default-100">
          {cover ? (
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <span
            className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(status)}`}
          >
            {statusLabel(status)}
          </span>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <h2 className="text-xl font-semibold text-secondary">{detail.camp.name}</h2>
            {detail.provider.legalCompanyName ? (
              <p className="mt-1 text-sm text-default-500">
                Organized by {detail.provider.legalCompanyName}
              </p>
            ) : null}
          </div>
          <p className="text-sm text-default-600">{sessionLine}</p>
        </div>
      </div>

      <div className="rounded-xl border border-default-200 bg-default-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
        <h3 className="font-semibold text-secondary">This booking didn&apos;t go ahead</h3>
        <p className="mt-1 text-sm text-default-600">
          The camp wasn&apos;t able to confirm this request. No payment has been taken. You can
          search for similar camps or contact our team if you need a hand.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button as={Link} href="/camps" color="primary" radius="lg" className="flex-1">
          Search for similar camps
        </Button>
        <Button
          as={Link}
          href="/support/tickets/new"
          variant="bordered"
          radius="lg"
          className="flex-1"
        >
          Contact support
        </Button>
      </div>
    </div>
  )
}
