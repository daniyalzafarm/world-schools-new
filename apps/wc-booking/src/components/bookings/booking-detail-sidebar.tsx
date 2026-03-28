'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { ChevronRight } from 'lucide-react'
import {
  ageFromDateOfBirth,
  formatDropoffPickupLabels,
  formatSessionRange,
  journeyStepStates,
  progressBarColor,
  progressPercent,
  statusBadgeClass,
  statusLabel,
} from '@/lib/booking-group-ui'
import { formatCurrency } from '@/utils/currency'
import type { ParentBookingGroupDetail, ParentBookingGroupStatus } from '@/types/camp-booking'

function ActionRow({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-b border-default-200 py-4 text-default-800 transition-opacity hover:opacity-80"
    >
      <span className="text-[15px] font-medium">{label}</span>
      <ChevronRight className="h-5 w-5 text-default-300" aria-hidden />
    </Link>
  )
}

export function BookingDetailSidebar({ detail }: { detail: ParentBookingGroupDetail }) {
  const status = detail.status as ParentBookingGroupStatus
  const cover = detail.camp.coverImageUrl
  const pct = progressPercent(status)
  const barColor = progressBarColor(status)
  const sessionLine = formatSessionRange(
    detail.session.startDate,
    detail.session.endDate,
    detail.session.name
  )
  const { dropoffDate, dropoffTime, pickupDate, pickupTime } = formatDropoffPickupLabels(
    detail.session.startDate,
    detail.session.endDate,
    detail.session.arrivalTime,
    detail.session.departureTime,
    detail.session.sessionDayType
  )
  const { steps, states } = journeyStepStates(status)
  const balanceDue = Math.max(0, detail.totalAmount - detail.paidAmount)
  const campSlug = detail.camp.slug
  const campProfileHref = `/camps/${encodeURIComponent(campSlug)}`
  const campusHref = `${campProfileHref}#campus`

  return (
    <div className="space-y-6 px-4 py-6 pb-24 sm:px-6 lg:py-8 lg:pb-10">
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
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-default-500">
              <span>{statusLabel(status)}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-default-100">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-default-200 bg-default-200 dark:border-slate-700">
        <div className="bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-default-500">Drop-off</p>
          <p className="mt-1 text-[15px] font-medium text-secondary">{dropoffDate}</p>
          {dropoffTime ? <p className="text-sm text-default-500">{dropoffTime}</p> : null}
        </div>
        <div className="bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-default-500">Pick-up</p>
          <p className="mt-1 text-[15px] font-medium text-secondary">{pickupDate}</p>
          {pickupTime ? <p className="text-sm text-default-500">{pickupTime}</p> : null}
        </div>
      </div>

      {(detail.camp.locationName || detail.camp.locationAddress) && (
        <div className="rounded-xl border border-default-200 bg-default-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          {detail.camp.locationName ? (
            <h3 className="font-semibold text-secondary">{detail.camp.locationName}</h3>
          ) : null}
          {detail.camp.locationAddress ? (
            <p className="mt-1 text-sm text-default-600">{detail.camp.locationAddress}</p>
          ) : null}
        </div>
      )}

      <div>
        <ActionRow href="/messages" label="Message camp" />
        <ActionRow href={campProfileHref} label="View camp profile" />
        <ActionRow href={campusHref} label="Getting there" />
      </div>

      <section className="border-t border-default-200 pt-6 dark:border-slate-700">
        <h3 className="mb-3 text-lg font-semibold text-secondary">Children</h3>
        <ul className="flex flex-col gap-2">
          {detail.bookings.map(b => {
            const age = ageFromDateOfBirth(b.child.dateOfBirth)
            const initial = b.child.firstName.charAt(0).toUpperCase()
            return (
              <li
                key={b.id}
                className="flex items-center gap-3 rounded-xl border border-default-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-rose-100 to-primary-100 text-sm font-semibold text-secondary">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-secondary">{b.child.firstName}</p>
                  <p className="text-xs text-default-500">
                    {age !== null ? `Age ${age}` : 'Child booking'}
                    {b.totalPrice > 0 ? ` · ${formatCurrency(b.totalPrice)}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="border-t border-default-200 pt-6 dark:border-slate-700">
        <h3 className="mb-3 text-lg font-semibold text-secondary">Required forms</h3>
        <p className="text-sm text-default-600">
          Form collection and uploads will appear here when your camp enables them.
        </p>
        <Button size="sm" variant="flat" className="mt-3" isDisabled>
          Upload forms (coming soon)
        </Button>
      </section>

      <section className="border-t border-default-200 pt-6 dark:border-slate-700">
        <h3 className="mb-4 text-lg font-semibold text-secondary">Your journey</h3>
        <ul className="space-y-0">
          {steps.map((step, i) => {
            const state = states[i] ?? 'upcoming'
            const isDone = state === 'done'
            const isCurrent = state === 'current'
            return (
              <li key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isDone
                        ? 'bg-success-500 text-white'
                        : isCurrent
                          ? 'bg-primary-500 text-white'
                          : 'bg-default-200 text-default-500 dark:bg-slate-700'
                    }`}
                  >
                    {isDone ? '✓' : i + 1}
                  </div>
                  {i < steps.length - 1 ? (
                    <div
                      className={`my-1 w-0.5 flex-1 min-h-[20px] ${
                        isDone ? 'bg-success-500/40' : 'bg-default-200 dark:bg-slate-700'
                      }`}
                    />
                  ) : null}
                </div>
                <div className={`pb-6 ${i === steps.length - 1 ? 'pb-0' : ''}`}>
                  <p className="font-medium text-secondary">{step.label}</p>
                  <p className="text-sm text-default-500">{step.description}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="border-t border-default-200 pt-6 dark:border-slate-700">
        <h3 className="mb-3 text-lg font-semibold text-secondary">Payment summary</h3>
        <div className="space-y-2 rounded-xl border border-default-200 bg-default-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex justify-between text-sm">
            <span className="text-default-600">Subtotal</span>
            <span className="font-medium">{formatCurrency(detail.subtotalAmount)}</span>
          </div>
          {detail.discountTotal > 0 ? (
            <div className="flex justify-between text-sm">
              <span className="text-default-600">Discounts</span>
              <span className="font-medium text-success-600">
                −{formatCurrency(detail.discountTotal)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between text-sm">
            <span className="text-default-600">Total</span>
            <span className="font-medium">{formatCurrency(detail.totalAmount)}</span>
          </div>
          {detail.depositAmount != null && detail.depositAmount > 0 ? (
            <div className="flex justify-between text-sm">
              <span className="text-default-600">Deposit</span>
              <span className="font-medium">{formatCurrency(detail.depositAmount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-default-200 pt-3 text-sm font-semibold dark:border-slate-600">
            <span>Paid to date</span>
            <span className="text-success-600">{formatCurrency(detail.paidAmount)}</span>
          </div>
          {balanceDue > 0 ? (
            <div className="flex justify-between text-sm font-semibold">
              <span>Balance due</span>
              <span>{formatCurrency(balanceDue)}</span>
            </div>
          ) : null}
          {detail.refundedAmount > 0 ? (
            <div className="flex justify-between text-sm text-default-600">
              <span>Refunded</span>
              <span>{formatCurrency(detail.refundedAmount)}</span>
            </div>
          ) : null}
        </div>
      </section>

      {detail.specialRequest?.trim() ? (
        <section className="border-t border-default-200 pt-6 dark:border-slate-700">
          <h3 className="mb-2 text-lg font-semibold text-secondary">Your note to the camp</h3>
          <p className="whitespace-pre-wrap text-sm text-default-600">{detail.specialRequest}</p>
        </section>
      ) : null}

      <section className="border-t border-default-200 pt-6 dark:border-slate-700">
        <h3 className="mb-2 text-lg font-semibold text-secondary">Policies & receipts</h3>
        <p className="text-sm text-default-600">
          Cancellation rules and payment receipts will be linked here as they become available in
          your account.
        </p>
      </section>
    </div>
  )
}
