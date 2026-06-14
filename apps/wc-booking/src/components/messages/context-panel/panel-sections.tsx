'use client'

import Link from 'next/link'
import { Clock } from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'
import { StarRating } from '@world-schools/ui-web'
import {
  ageFromDateOfBirth,
  formatDropoffPickupLabels,
  formatSessionDateRange,
} from '@world-schools/wc-frontend-utils'
import { formatCurrency } from '@/utils/currency'
import { formatRating, formatReviewCount } from '@/utils/rating-format'
import type { ParentBookingGroupDetail } from '@/types/camp-booking'
import type { Session } from '@/types/sessions'

// ─── Camp info card (shared) ──────────────────────────────────────────────────

/** Human label for the camp's average response time (minutes). */
function formatResponseTime(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null
  if (minutes < 60) return `Usually responds in ${Math.round(minutes)} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Usually responds in ${hours} hour${hours !== 1 ? 's' : ''}`
  const days = Math.round(hours / 24)
  return `Usually responds within ${days} day${days !== 1 ? 's' : ''}`
}

export function CampInfoCard({
  photoUrl,
  name,
  location,
  appRating,
  appReviewCount = 0,
  googleRating,
  googleReviewCount = 0,
  googleReviewsUrl,
  responseTimeMinutes,
  compact = false,
}: {
  photoUrl: string | null
  name: string
  location: string | null
  appRating?: number | null
  appReviewCount?: number
  googleRating?: number | null
  googleReviewCount?: number
  googleReviewsUrl?: string | null
  responseTimeMinutes?: number | null
  /** When true, hides the "usually responds in …" pill (the rating row stays). */
  compact?: boolean
}) {
  const responseLabel = formatResponseTime(responseTimeMinutes ?? null)
  const hasApp = appReviewCount > 0 && appRating != null
  const hasGoogle = googleReviewCount > 0 && googleRating != null

  // Always render both rating sides, falling back to an empty "(0 reviews)"
  // state when a source has none — mirroring the camp profile page.
  const appSide = hasApp ? (
    <span className="flex items-center gap-1 text-secondary">
      <StarRating rating={1} maxRating={1} showRating={false} color="primary" size={14} />
      <span className="font-bold">{formatRating(appRating)}</span>
      <span className="text-default-500">({formatReviewCount(appReviewCount)} reviews)</span>
    </span>
  ) : (
    <span className="flex items-center gap-1 text-default-500">
      <StarRating rating={0} maxRating={1} showRating={false} color="primary" size={14} />
      <span>(0 reviews)</span>
    </span>
  )

  const googleInner = hasGoogle ? (
    <>
      <FcGoogle size={16} aria-label="Google" />
      <StarRating rating={1} maxRating={1} showRating={false} color="yellow" size={14} />
      <span className="font-bold text-secondary">{formatRating(googleRating)}</span>
      <span className="text-default-500">({formatReviewCount(googleReviewCount)} reviews)</span>
    </>
  ) : (
    <>
      <FcGoogle size={16} aria-label="Google" />
      <StarRating rating={0} maxRating={1} showRating={false} color="yellow" size={14} />
      <span className="text-default-500">(0 reviews)</span>
    </>
  )

  const googleSide =
    hasGoogle && googleReviewsUrl ? (
      <a
        href={googleReviewsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:opacity-80"
      >
        {googleInner}
      </a>
    ) : (
      <span className="flex items-center gap-1">{googleInner}</span>
    )

  return (
    <div className="border-b border-default-200 px-6 py-6 text-center dark:border-slate-700">
      {photoUrl ? (
        <img src={photoUrl} alt="" className="mb-4 h-40 w-full rounded-xl object-cover" />
      ) : (
        <div className="mb-4 h-40 w-full rounded-xl bg-default-100 dark:bg-slate-800" />
      )}
      <h2 className="text-lg font-semibold text-secondary">{name}</h2>
      {location ? <p className="mt-1 text-sm text-default-500">{location}</p> : null}

      {/* App + Google ratings on a single line, mirroring the camp profile —
          always shown, with a "(0 reviews)" empty state when a source has none. */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
        {appSide}
        <span className="text-default-400">·</span>
        {googleSide}
      </div>

      {!compact && responseLabel ? (
        <div className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-default-100 px-4 py-2 text-xs font-medium text-default-600 dark:bg-slate-800">
          <Clock className="h-3.5 w-3.5" />
          {responseLabel}
        </div>
      ) : null}
    </div>
  )
}

// ─── Status banner ────────────────────────────────────────────────────────────

export type StatusBannerVariant = 'success' | 'warning' | 'info' | 'pending' | 'neutral' | 'danger'

const BANNER_STYLES: Record<StatusBannerVariant, { box: string; dot: string }> = {
  success: { box: 'bg-success-100 dark:bg-success-500/10', dot: 'bg-success-500' },
  warning: { box: 'bg-warning-100 dark:bg-warning-500/10', dot: 'bg-warning-500 animate-pulse' },
  info: { box: 'bg-info-100 dark:bg-blue-500/10', dot: 'bg-info-500' },
  pending: { box: 'bg-primary-50 dark:bg-primary-500/10', dot: 'bg-primary-600' },
  neutral: { box: 'bg-default-100 dark:bg-slate-800', dot: 'bg-default-400' },
  danger: { box: 'bg-danger-100 dark:bg-danger-500/10', dot: 'bg-danger-500' },
}

export function StatusBanner({
  variant,
  title,
  subtitle,
}: {
  variant: StatusBannerVariant
  title: string
  subtitle?: string
}) {
  const styles = BANNER_STYLES[variant]
  return (
    <div className={`flex items-center gap-3 px-6 py-3.5 ${styles.box}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-secondary">{title}</p>
        {subtitle ? <p className="text-sm text-default-500">{subtitle}</p> : null}
      </div>
    </div>
  )
}

// ─── Generic section wrapper ──────────────────────────────────────────────────

export function PanelSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-default-200 px-6 py-5 last:border-b-0 dark:border-slate-700">
      {title ? (
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-default-500">
          {title}
        </h3>
      ) : null}
      {children}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  valueClass = 'text-secondary',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-start justify-between py-2 first:pt-0 last:pb-0">
      <span className="text-sm text-default-500">{label}</span>
      <span className={`text-sm font-medium ${valueClass}`}>{value}</span>
    </div>
  )
}

// ─── Booking summary ──────────────────────────────────────────────────────────

export function BookingSummarySection({
  detail,
  title = 'Session details',
}: {
  detail: ParentBookingGroupDetail
  title?: string
}) {
  const dates = formatSessionDateRange(detail.session.startDate, detail.session.endDate, '—')
  const children = detail.bookings.map(b => b.child.firstName).join(', ')
  return (
    <PanelSection title={title}>
      <div className="divide-y divide-default-200 rounded-xl bg-default-50 px-4 py-2 dark:divide-slate-700 dark:bg-slate-800/50">
        <SummaryRow label="Dates" value={dates} />
        {detail.session.name ? <SummaryRow label="Program" value={detail.session.name} /> : null}
        {children ? <SummaryRow label="Children" value={children} /> : null}
      </div>
    </PanelSection>
  )
}

// ─── Children ─────────────────────────────────────────────────────────────────

export function ChildrenSection({
  detail,
  title = 'Children enrolled',
}: {
  detail: ParentBookingGroupDetail
  title?: string
}) {
  return (
    <PanelSection title={title}>
      <ul className="flex flex-col gap-2">
        {detail.bookings.map(b => {
          const age = ageFromDateOfBirth(b.child.dateOfBirth)
          const initial = b.child.firstName.charAt(0).toUpperCase()
          return (
            <li
              key={b.id}
              className="flex items-center gap-3 rounded-lg bg-default-50 px-3 py-2.5 dark:bg-slate-800/50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-secondary">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-secondary">{b.child.firstName}</p>
                {age !== null ? <p className="text-xs text-default-500">{age} years old</p> : null}
              </div>
            </li>
          )
        })}
      </ul>
    </PanelSection>
  )
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export function PaymentSection({ detail }: { detail: ParentBookingGroupDetail }) {
  const { currency } = detail
  const balanceDue = Math.max(0, detail.totalAmount - detail.paidAmount)
  return (
    <PanelSection title="Payment">
      <div className="space-y-2 rounded-xl bg-default-50 p-4 dark:bg-slate-800/50">
        <div className="flex justify-between text-sm">
          <span className="text-default-500">Subtotal</span>
          <span className="text-secondary">{formatCurrency(detail.subtotalAmount, currency)}</span>
        </div>
        {detail.discountTotal > 0 ? (
          <div className="flex justify-between text-sm">
            <span className="text-default-500">Discounts</span>
            <span className="text-success-600">
              −{formatCurrency(detail.discountTotal, currency)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-default-200 pt-2 text-sm font-semibold dark:border-slate-700">
          <span className="text-secondary">Total</span>
          <span className="text-secondary">{formatCurrency(detail.totalAmount, currency)}</span>
        </div>
        {detail.paidAmount > 0 ? (
          <div className="flex justify-between text-sm">
            <span className="text-default-500">Paid to date</span>
            <span className="text-success-600">{formatCurrency(detail.paidAmount, currency)}</span>
          </div>
        ) : null}
        {balanceDue > 0 ? (
          <div className="mt-1 flex items-center justify-between rounded-lg bg-warning-100 px-3 py-2 dark:bg-warning-500/10">
            <span className="text-sm font-medium text-warning-700 dark:text-warning-500">
              Balance due
            </span>
            <span className="text-sm font-semibold text-warning-700 dark:text-warning-500">
              {formatCurrency(balanceDue, currency)}
            </span>
          </div>
        ) : null}
        {detail.refundedAmount > 0 ? (
          <div className="flex justify-between text-sm text-default-500">
            <span>Refunded</span>
            <span>{formatCurrency(detail.refundedAmount, currency)}</span>
          </div>
        ) : null}
      </div>
    </PanelSection>
  )
}

// ─── Forms (stub — no forms backend yet) ──────────────────────────────────────

export function FormsSection() {
  return (
    <PanelSection title="Required forms">
      <div className="rounded-xl bg-default-50 p-4 dark:bg-slate-800/50">
        <p className="text-sm text-default-600">
          Form collection and uploads will appear here when your camp enables them.
        </p>
      </div>
    </PanelSection>
  )
}

// ─── Check-in note ────────────────────────────────────────────────────────────

export function CheckinSection({ detail }: { detail: ParentBookingGroupDetail }) {
  const { dropoffDate, dropoffTime } = formatDropoffPickupLabels(
    detail.session.startDate,
    detail.session.endDate,
    detail.session.arrivalTime,
    detail.session.departureTime,
    detail.session.sessionDayType
  )
  return (
    <PanelSection title="Check-in">
      <div className="rounded-xl bg-info-100 p-4 dark:bg-blue-500/10">
        <p className="text-sm font-semibold text-secondary">📍 {dropoffDate}</p>
        <p className="mt-1 text-sm text-default-600">
          {dropoffTime
            ? `Drop-off from ${dropoffTime}. Full check-in details will be shared by the camp closer to the date.`
            : 'Full check-in details will be shared by the camp closer to the date.'}
        </p>
      </div>
    </PanelSection>
  )
}

// ─── Refund (cancelled) ───────────────────────────────────────────────────────

export function RefundSection({ detail }: { detail: ParentBookingGroupDetail }) {
  const { currency } = detail
  return (
    <PanelSection title="Refund">
      <div className="divide-y divide-default-200 rounded-xl bg-default-50 px-4 py-2 dark:divide-slate-700 dark:bg-slate-800/50">
        <SummaryRow label="Amount paid" value={formatCurrency(detail.paidAmount, currency)} />
        <SummaryRow
          label="Refunded"
          value={formatCurrency(detail.refundedAmount, currency)}
          valueClass="text-success-600"
        />
      </div>
    </PanelSection>
  )
}

// ─── Review prompt (past) ─────────────────────────────────────────────────────

export function ReviewPromptSection() {
  return (
    <PanelSection>
      <div className="rounded-xl bg-primary-50 p-4 text-center dark:bg-primary-500/10">
        <div className="mb-2 text-2xl">⭐</div>
        <p className="text-sm font-semibold text-secondary">How was your experience?</p>
        <p className="mt-1 text-sm text-default-500">
          Share your feedback to help other families find great camps.
        </p>
        <Link
          href="/reviews/write"
          className="mt-3 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-secondary transition-opacity hover:opacity-90"
        >
          Write a review
        </Link>
      </div>
    </PanelSection>
  )
}

// ─── Inquiry: available sessions ──────────────────────────────────────────────

function sessionPrice(session: Session): number | null {
  if (session.pricingType === 'single' && session.price != null) return session.price
  if (session.pricingType === 'age_group' && session.ageGroupPrices?.length) {
    return Math.min(...session.ageGroupPrices.map(a => a.price))
  }
  return null
}

const PREVIEW_SESSIONS = 3

export function InquirySessionsSection({
  sessions,
  currency,
  campSlug,
}: {
  sessions: Session[]
  currency: string | null
  campSlug: string | null
}) {
  if (!sessions.length) return null
  const preview = sessions.slice(0, PREVIEW_SESSIONS)
  return (
    <PanelSection title="Available sessions">
      <div className="flex flex-col gap-3">
        {preview.map(session => {
          const price = sessionPrice(session)
          const spotsLeft =
            session.totalSpots != null && session.bookedCount != null
              ? session.totalSpots - session.bookedCount
              : null
          const dates = formatSessionDateRange(session.startDate, session.endDate, '')
          return (
            <div
              key={session.id}
              className="rounded-xl border border-default-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-secondary">
                  {session.name || dates || 'Session'}
                </p>
                {price != null && currency ? (
                  <p className="shrink-0 text-sm font-bold text-secondary">
                    {formatCurrency(price, currency)}
                  </p>
                ) : null}
              </div>
              {session.name && dates ? (
                <p className="mt-0.5 text-xs text-default-500">{dates}</p>
              ) : null}
              {spotsLeft != null && spotsLeft > 0 && spotsLeft <= 5 ? (
                <p className="mt-1 text-xs font-medium text-warning-600">
                  Only {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      {campSlug ? (
        <Link
          href={`/camp/${campSlug}`}
          className="mt-3 block text-center text-sm font-semibold text-secondary underline underline-offset-2 hover:opacity-70"
        >
          View all {sessions.length} sessions →
        </Link>
      ) : null}
    </PanelSection>
  )
}
