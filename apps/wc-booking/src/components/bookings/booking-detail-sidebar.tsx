'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { ChevronRight } from 'lucide-react'
import {
  ageFromDateOfBirth,
  ContextType,
  formatDropoffPickupLabels,
  formatSessionRange,
  journeyStepStates,
  statusBadgeClass,
  statusLabel,
} from '@world-schools/wc-frontend-utils'
import { formatCurrency } from '@/utils/currency'
import type { ParentBookingGroupDetail, ParentBookingGroupStatus } from '@/types/camp-booking'
import { useMessagingStore } from '@/stores/messaging-store'
import { bookingGroupsService } from '@/services/booking-groups.services'
import { CancelBookingModal } from './cancel-booking-modal'
import { RescheduleConsentModal } from './reschedule-consent-modal'

/**
 * Statuses where the parent's "Cancel booking" CTA is shown. Mirrors the
 * backend's `NON_CANCELABLE_BOOKING_STATUSES` (in inverse). Draft has its
 * own flow (delete-draft) which lives elsewhere; everything else terminal
 * hides the button.
 */
const PARENT_CANCELABLE_STATUSES = new Set<ParentBookingGroupStatus>([
  'request',
  'accepted',
  'deposit_paid',
  'fully_paid',
])

function ActionRow({
  href,
  label,
  onClick,
}: {
  href?: string
  label: string
  onClick?: () => void
}) {
  const rowClassName =
    'flex items-center justify-between border-b border-default-200 py-4 text-default-800 transition-opacity hover:opacity-80'
  const rowContent = (
    <>
      <span className="text-sm font-medium">{label}</span>
      <ChevronRight className="h-5 w-5 text-default-300" aria-hidden />
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${rowClassName} w-full text-left`}>
        {rowContent}
      </button>
    )
  }

  return (
    <Link href={href ?? '#'} className={rowClassName}>
      {rowContent}
    </Link>
  )
}

export function BookingDetailSidebar({
  detail,
  onCancelled,
}: {
  detail: ParentBookingGroupDetail
  /** Called after the parent successfully cancels — parent page should reload state. */
  onCancelled?: () => void
}) {
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
  const [hasPendingReschedule, setHasPendingReschedule] = useState(false)
  const router = useRouter()
  const { setDraftConversation } = useMessagingStore()
  const status = detail.status as ParentBookingGroupStatus
  const showCancelButton = PARENT_CANCELABLE_STATUSES.has(status)
  const currency = detail.currency
  const cover = detail.camp.coverImageUrl
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

  // Surface a pending provider reschedule (Spec v2.5 §9.7) awaiting the
  // customer's consent. Best-effort fetch; a failure simply hides the banner.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await bookingGroupsService.getPendingReschedule(detail.id)
      if (!cancelled && res.success) setHasPendingReschedule(res.data.pending != null)
    })()
    return () => {
      cancelled = true
    }
  }, [detail.id])

  // Open the conversation with this camp's provider. The messages page resolves
  // this draft to the existing thread when one exists (deep-link); otherwise it
  // shows the compose view — so the parent never lands on an empty list.
  const handleMessageCamp = () => {
    setDraftConversation({
      providerId: detail.providerId,
      providerName: detail.provider.legalCompanyName || 'Provider',
      participantType: 'provider',
      contextType: ContextType.CAMP,
      contextId: detail.camp.id,
      contextName: detail.camp.name,
      contextImageUrl: detail.camp.coverImageUrl ?? undefined,
    })
    router.push('/messages')
  }

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
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-default-200 bg-default-200 dark:border-slate-700">
        <div className="bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-default-500">Drop-off</p>
          <p className="mt-1 text-sm font-medium text-secondary">{dropoffDate}</p>
          {dropoffTime ? <p className="text-sm text-default-500">{dropoffTime}</p> : null}
        </div>
        <div className="bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-default-500">Pick-up</p>
          <p className="mt-1 text-sm font-medium text-secondary">{pickupDate}</p>
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
        <ActionRow onClick={handleMessageCamp} label="Message camp" />
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
                    {b.totalPrice > 0 ? ` · ${formatCurrency(b.totalPrice, currency)}` : ''}
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
                      className={`my-1 w-0.5 flex-1 min-h-5 ${
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
            <span className="font-medium">{formatCurrency(detail.subtotalAmount, currency)}</span>
          </div>
          {detail.discountTotal > 0 ? (
            <div className="flex justify-between text-sm">
              <span className="text-default-600">Discounts</span>
              <span className="font-medium text-success-600">
                −{formatCurrency(detail.discountTotal, currency)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between text-sm">
            <span className="text-default-600">Total</span>
            <span className="font-medium">{formatCurrency(detail.totalAmount, currency)}</span>
          </div>
          {detail.depositAmount != null && detail.depositAmount > 0 ? (
            <div className="flex justify-between text-sm">
              <span className="text-default-600">Deposit</span>
              <span className="font-medium">{formatCurrency(detail.depositAmount, currency)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-default-200 pt-3 text-sm font-semibold dark:border-slate-600">
            <span>Paid to date</span>
            <span className="text-success-600">{formatCurrency(detail.paidAmount, currency)}</span>
          </div>
          {balanceDue > 0 ? (
            <div className="flex justify-between text-sm font-semibold">
              <span>Balance due</span>
              <span>{formatCurrency(balanceDue, currency)}</span>
            </div>
          ) : null}
          {detail.refundedAmount > 0 ? (
            <div className="flex justify-between text-sm text-default-600">
              <span>Refunded</span>
              <span>{formatCurrency(detail.refundedAmount, currency)}</span>
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

      {hasPendingReschedule ? (
        <section className="border-t border-default-200 pt-6 dark:border-slate-700">
          <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
            <h3 className="mb-1 text-base font-semibold text-warning-800">Date change requested</h3>
            <p className="mb-3 text-sm text-warning-800">
              The camp has proposed new programme dates. Review the new dates and updated payment
              schedule, then agree or decline.
            </p>
            <Button
              color="warning"
              variant="flat"
              size="sm"
              onPress={() => setRescheduleModalOpen(true)}
            >
              Review date change
            </Button>
          </div>
        </section>
      ) : null}

      {showCancelButton ? (
        <section className="border-t border-default-200 pt-6 dark:border-slate-700">
          <h3 className="mb-2 text-lg font-semibold text-secondary">Cancel booking</h3>
          <p className="mb-3 text-sm text-default-600">
            Cancelling shows you the refund you&apos;ll receive based on the camp&apos;s policy
            before you confirm.
          </p>
          <Button color="danger" variant="flat" size="sm" onPress={() => setCancelModalOpen(true)}>
            Cancel this booking
          </Button>
        </section>
      ) : null}

      <CancelBookingModal
        bookingGroupId={detail.id}
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onCancelled={() => {
          setCancelModalOpen(false)
          onCancelled?.()
        }}
      />

      <RescheduleConsentModal
        bookingGroupId={detail.id}
        currency={currency}
        isOpen={rescheduleModalOpen}
        onClose={() => setRescheduleModalOpen(false)}
        onResolved={() => {
          setRescheduleModalOpen(false)
          setHasPendingReschedule(false)
          onCancelled?.()
        }}
      />
    </div>
  )
}
