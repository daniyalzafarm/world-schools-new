import { Logger } from '@nestjs/common'
import {
  BOOKING_DECLINE_REASON_LABELS,
  type BookingDeclineReason,
  NotificationType,
} from '@world-schools/wc-types'
import { formatCurrency } from '@world-schools/wc-utils'
import type {
  ParentBookingAcceptedProps,
  ParentBookingCancelledProps,
  ParentBookingDeclinedProps,
  ParentBookingModifiedProps,
  ParentBookingRequestSubmittedProps,
  ParentBookingRequestWithdrawnProps,
  ParentCheckoutAbandonedProps,
  ParentDisputeOpenedProps,
  ParentDisputeResolvedProps,
  ParentMessagingNewFromCampProps,
  ParentPaymentBalanceChargedProps,
  ParentPaymentBalanceFailedProps,
  ParentPaymentBalanceReminderProps,
  ParentPaymentCancelledNonPaymentProps,
  ParentPaymentDepositConfirmedProps,
  ParentPostCampReviewProps,
  ParentPostDeclineAlternativesProps,
  ParentPreCampProps,
  ParentProfileIncompleteProps,
  ParentRefundFailedProps,
  ParentRefundIssuedProps,
  ParentReviewRemovedProps,
  ParentReviewResponsePublishedProps,
  ParentSupportTicketReplyProps,
  ParentSupportTicketStatusChangedProps,
  ParentWishlistEmptyProps,
  ParentWishlistEventProps,
  ParentWishlistItemsNoBookingProps,
  ProviderApplicationStatusProps,
  ProviderBookingEventProps,
  ProviderDisputeEventProps,
  ProviderMessagingEventProps,
  ProviderOperationsNudgeProps,
  ProviderPayoutEventProps,
  ProviderPreCampProps,
  ProviderProfileMilestoneProps,
  ProviderRefundEventProps,
  ProviderReviewEventProps,
  ProviderStripeConnectProps,
  ProviderSupportEventProps,
  SuperadminCampHealthProps,
  SuperadminCampOnboardingProps,
  SuperadminFinanceEventProps,
  SuperadminReviewFlaggedProps,
  SuperadminSupportEventProps,
} from '@world-schools/wc-email-templates'
import type { PrismaService } from '../../../prisma/prisma.service'
import type { NotificationContext } from '../queue/queue.types'
import type { PropLoader } from '../catalog/types'

const logger = new Logger('PropLoaders')

/**
 * Per-trigger prop builders. Each function takes a Prisma client and the
 * job's primitive-IDs context, then returns the typed props that the
 * trigger's React Email component and in-app string builders consume.
 *
 * Loaders run inside the BullMQ worker — never at enqueue time — so the
 * snapshot reflects current DB state even when a scheduled reminder fires
 * days after the originating event. Loaders MUST tolerate the entity
 * having been deleted between enqueue and run (returning null lets the
 * worker mark the job skipped rather than retry forever).
 */

const PARENT_APP_BASE_URL = process.env.BOOKING_PORTAL_URL ?? 'http://localhost:4303'
const PROVIDER_APP_BASE_URL = process.env.PROVIDER_PORTAL_URL ?? 'http://localhost:4302'

/** Pre-formatted helpers. Templates render strings only — no Date /
 *  number coercion inside JSX. */
function formatDate(d: Date | null | undefined): string {
  if (!d) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function toNumber(d: { toNumber?: () => number } | number | null | undefined): number {
  if (d == null) return 0
  if (typeof d === 'number') return d
  return d.toNumber?.() ?? 0
}

const parentBookingAccepted: PropLoader<ParentBookingAcceptedProps | null> = async (
  prisma: PrismaService,
  { bookingGroupId }: NotificationContext
) => {
  if (!bookingGroupId) return null

  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: {
      bookingGroupNumber: true,
      depositAmount: true,
      totalAmount: true,
      balanceDueAt: true,
      parent: { select: { user: { select: { firstName: true } } } },
      camp: { select: { name: true } },
      session: { select: { name: true, startDate: true } },
      bookings: {
        select: { child: { select: { firstName: true } } },
        take: 1,
      },
    },
  })
  if (!bg) {
    logger.warn(`parentBookingAccepted: BookingGroup ${bookingGroupId} not found — skipping`)
    return null
  }

  const deposit = toNumber(bg.depositAmount)
  const total = toNumber(bg.totalAmount)
  const balance = Math.max(0, total - deposit)
  const currency = 'USD' // currency lives on Payment rows, not BookingGroup
  const childName = bg.bookings[0]?.child?.firstName ?? 'your child'

  return {
    salutation: 'hi',
    firstName: bg.parent.user.firstName,
    childName,
    campName: bg.camp.name,
    programName: bg.session.name,
    startDate: formatDate(bg.session.startDate),
    bookingRef: bg.bookingGroupNumber,
    depositPaid: formatCurrency(deposit, currency),
    balanceAmount: formatCurrency(balance, currency),
    balanceDueDate: formatDate(bg.balanceDueAt),
    bookingUrl: `${PARENT_APP_BASE_URL}/bookings/${bookingGroupId}`,
  }
}

/**
 * Render a session window as a human-readable range, mirroring the format
 * the legacy `BookingWebSocketHandler.formatSessionRange()` produced so
 * the copy stays consistent with what parents have already seen in prior emails.
 */
function formatSessionRange(start: Date | null | undefined, end: Date | null | undefined): string {
  if (!start || !end) return ''
  const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric' })
  const dayMonthFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
  const fullFmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()
  if (sameMonth) return `${dayFmt.format(start)}–${fullFmt.format(end)}`
  if (sameYear) return `${dayMonthFmt.format(start)} – ${fullFmt.format(end)}`
  return `${fullFmt.format(start)} – ${fullFmt.format(end)}`
}

const parentBookingDeclined: PropLoader<ParentBookingDeclinedProps | null> = async (
  prisma: PrismaService,
  { bookingGroupId, extra }: NotificationContext
) => {
  if (!bookingGroupId) return null

  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: {
      bookingGroupNumber: true,
      declineReason: true,
      parent: { select: { user: { select: { firstName: true } } } },
      camp: { select: { name: true } },
      session: { select: { name: true, startDate: true, endDate: true } },
      bookings: { select: { child: { select: { firstName: true } } }, take: 1 },
    },
  })
  if (!bg) {
    logger.warn(`parentBookingDeclined: BookingGroup ${bookingGroupId} not found — skipping`)
    return null
  }

  // Prefer the persisted declineReason on the booking; fall back to a value
  // the dispatcher passed via `context.extra` (e.g. when the booking auto-
  // expires and no provider decline reason exists).
  const reasonCode =
    bg.declineReason ?? (extra?.['declineReason'] as BookingDeclineReason | undefined)
  const declineReason = reasonCode ? BOOKING_DECLINE_REASON_LABELS[reasonCode] : undefined

  return {
    salutation: 'hi',
    firstName: bg.parent.user.firstName,
    // Name the child so multi-child households know which request was
    // declined.
    childName: bg.bookings[0]?.child?.firstName ?? 'your child',
    campName: bg.camp.name,
    programName: bg.session.name,
    sessionRange: formatSessionRange(bg.session.startDate, bg.session.endDate),
    bookingRef: bg.bookingGroupNumber,
    declineReason,
    browseUrl: `${PARENT_APP_BASE_URL}/camps?similar-to=${encodeURIComponent(bg.camp.name)}`,
  }
}

/**
 * Shared in-app prop shape for the provider-audience booking notifications.
 * All three (Accepted / Declined / RequestReceived) need the same fields —
 * the catalog entries differentiate by title + body string only.
 */
export interface ProviderBookingInAppProps {
  bookingGroupId: string
  bookingGroupNumber: string
  campName: string
  /** ISO timestamp when the request expires — only set for RequestReceived. */
  requestExpiresAt?: string
  /** Deep link to the booking in the provider portal (used by the email CTA). */
  bookingUrl: string
}

const providerBookingInApp: PropLoader<ProviderBookingInAppProps | null> = async (
  prisma: PrismaService,
  { bookingGroupId, extra }: NotificationContext
) => {
  if (!bookingGroupId) return null
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: {
      bookingGroupNumber: true,
      camp: { select: { name: true } },
    },
  })
  if (!bg) {
    logger.warn(`providerBookingInApp: BookingGroup ${bookingGroupId} not found — skipping`)
    return null
  }
  return {
    bookingGroupId,
    bookingGroupNumber: bg.bookingGroupNumber,
    campName: bg.camp.name,
    requestExpiresAt: extra?.['requestExpiresAt'] as string | undefined,
    bookingUrl: `${PROVIDER_APP_BASE_URL}/bookings/${bookingGroupId}`,
  }
}

const parentBookingRequestSubmitted: PropLoader<ParentBookingRequestSubmittedProps | null> = async (
  prisma: PrismaService,
  { bookingGroupId }: NotificationContext
) => {
  if (!bookingGroupId) return null
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: {
      bookingGroupNumber: true,
      parent: { select: { user: { select: { firstName: true } } } },
      camp: { select: { name: true } },
      session: { select: { name: true, startDate: true } },
      bookings: { select: { child: { select: { firstName: true } } }, take: 1 },
    },
  })
  if (!bg) {
    logger.warn(
      `parentBookingRequestSubmitted: BookingGroup ${bookingGroupId} not found — skipping`
    )
    return null
  }
  return {
    salutation: 'hi',
    firstName: bg.parent.user.firstName,
    childName: bg.bookings[0]?.child?.firstName ?? 'your child',
    campName: bg.camp.name,
    programName: bg.session.name,
    startDate: formatDate(bg.session.startDate),
    bookingRef: bg.bookingGroupNumber,
    bookingUrl: `${PARENT_APP_BASE_URL}/bookings/${bookingGroupId}`,
  }
}

const parentBookingCancelled: PropLoader<ParentBookingCancelledProps | null> = async (
  prisma: PrismaService,
  { bookingGroupId, extra }: NotificationContext
) => {
  if (!bookingGroupId) return null
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: {
      bookingGroupNumber: true,
      refundedAmount: true,
      parent: { select: { user: { select: { firstName: true } } } },
      camp: { select: { name: true } },
      bookings: { select: { child: { select: { firstName: true } } }, take: 1 },
    },
  })
  if (!bg) {
    logger.warn(`parentBookingCancelled: BookingGroup ${bookingGroupId} not found — skipping`)
    return null
  }
  // Prefer an explicit refund amount from the cancel handler (via `extra`)
  // since `refundedAmount` is a denormalised aggregate that may not have
  // caught up yet at notification fire time.
  const refundAmount =
    (extra?.['refundAmount'] as string | undefined) ??
    (toNumber(bg.refundedAmount) > 0 ? formatCurrency(toNumber(bg.refundedAmount), 'USD') : '')
  return {
    salutation: 'hi',
    firstName: bg.parent.user.firstName,
    childName: bg.bookings[0]?.child?.firstName ?? 'your child',
    campName: bg.camp.name,
    bookingRef: bg.bookingGroupNumber,
    refundAmount,
    refundEta: '5–10 business days',
  }
}

const parentBookingModified: PropLoader<ParentBookingModifiedProps | null> = async (
  prisma: PrismaService,
  { bookingGroupId, extra }: NotificationContext
) => {
  if (!bookingGroupId) return null
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: {
      bookingGroupNumber: true,
      parent: { select: { user: { select: { firstName: true } } } },
      camp: { select: { name: true } },
      bookings: { select: { child: { select: { firstName: true } } }, take: 1 },
    },
  })
  if (!bg) {
    logger.warn(`parentBookingModified: BookingGroup ${bookingGroupId} not found — skipping`)
    return null
  }
  // The caller passes a human summary of what changed (e.g. "Add-on selections
  // updated"). Without one we fall back to a generic — better than crashing.
  const changesSummary =
    (extra?.['changesSummary'] as string | undefined) ?? 'Booking details updated'
  return {
    salutation: 'hi',
    firstName: bg.parent.user.firstName,
    childName: bg.bookings[0]?.child?.firstName ?? 'your child',
    campName: bg.camp.name,
    bookingRef: bg.bookingGroupNumber,
    changesSummary,
    bookingUrl: `${PARENT_APP_BASE_URL}/bookings/${bookingGroupId}`,
  }
}

const parentBookingRequestWithdrawn: PropLoader<ParentBookingRequestWithdrawnProps | null> = async (
  prisma: PrismaService,
  { bookingGroupId }: NotificationContext
) => {
  if (!bookingGroupId) return null
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: {
      parent: { select: { user: { select: { firstName: true } } } },
      camp: { select: { name: true } },
      session: { select: { name: true } },
    },
  })
  if (!bg) {
    logger.warn(
      `parentBookingRequestWithdrawn: BookingGroup ${bookingGroupId} not found — skipping`
    )
    return null
  }
  return {
    salutation: 'hi',
    firstName: bg.parent.user.firstName,
    campName: bg.camp.name,
    programName: bg.session.name,
    browseUrl: `${PARENT_APP_BASE_URL}/camps`,
  }
}

// ============================================================================
// Payment loaders
// ============================================================================

/**
 * Shared payment context. Most parent payment templates need the same
 * "BookingGroup + parent + camp + child + amounts" join — we factor it once
 * here and let per-trigger loaders cherry-pick the fields they emit.
 */
async function loadPaymentContext(
  prisma: PrismaService,
  paymentId: string | undefined,
  fallbackBookingGroupId: string | undefined
) {
  if (paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        amount: true,
        currency: true,
        attemptCount: true,
        failureCode: true,
        failureMessage: true,
        bookingGroup: {
          select: {
            id: true,
            bookingGroupNumber: true,
            depositAmount: true,
            totalAmount: true,
            balanceDueAt: true,
            parent: { select: { user: { select: { firstName: true } } } },
            camp: { select: { name: true } },
            session: { select: { name: true, startDate: true } },
            bookings: { select: { child: { select: { firstName: true } } }, take: 1 },
          },
        },
      },
    })
    return payment
  }
  if (!fallbackBookingGroupId) return null
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: fallbackBookingGroupId },
    select: {
      id: true,
      bookingGroupNumber: true,
      depositAmount: true,
      totalAmount: true,
      balanceDueAt: true,
      parent: { select: { user: { select: { firstName: true } } } },
      camp: { select: { name: true } },
      session: { select: { name: true, startDate: true } },
      bookings: { select: { child: { select: { firstName: true } } }, take: 1 },
    },
  })
  if (!bg) return null
  return {
    id: '',
    amount: bg.totalAmount,
    currency: 'USD',
    attemptCount: 0,
    failureCode: null,
    failureMessage: null,
    bookingGroup: bg,
  }
}

const parentPaymentDepositConfirmed: PropLoader<ParentPaymentDepositConfirmedProps | null> = async (
  prisma,
  { paymentId, bookingGroupId }
) => {
  const ctx = await loadPaymentContext(prisma, paymentId, bookingGroupId)
  if (!ctx) {
    logger.warn(`parentPaymentDepositConfirmed: missing payment/bookingGroup — skipping`)
    return null
  }
  const bg = ctx.bookingGroup
  const deposit = toNumber(bg.depositAmount)
  const total = toNumber(bg.totalAmount)
  const balance = Math.max(0, total - deposit)
  const currency = (ctx.currency ?? 'USD').toUpperCase()
  return {
    salutation: 'hi',
    firstName: bg.parent.user.firstName,
    childName: bg.bookings[0]?.child?.firstName ?? 'your child',
    campName: bg.camp.name,
    bookingRef: bg.bookingGroupNumber,
    depositAmount: formatCurrency(deposit, currency),
    balanceAmount: formatCurrency(balance, currency),
    balanceDueDate: formatDate(bg.balanceDueAt),
    bookingUrl: `${PARENT_APP_BASE_URL}/bookings/${bg.id}`,
  }
}

/**
 * A card expires at the END of its `expMonth/expYear`. Returns true when it is
 * already expired by `byDate` — i.e. `byDate` falls on/after the first instant
 * of the month AFTER the expiry month. `expMonth` is 1-12; `Date.UTC` is
 * 0-indexed, so `Date.UTC(expYear, expMonth, 1)` is the 1st of the following
 * month (and normalises Dec → next January).
 */
export function cardExpiresBeforeDate(expMonth: number, expYear: number, byDate: Date): boolean {
  const firstOfMonthAfterExpiry = Date.UTC(expYear, expMonth, 1)
  return byDate.getTime() >= firstOfMonthAfterExpiry
}

function buildBalanceReminder(
  daysUntilDue: 14 | 7 | 3
): PropLoader<ParentPaymentBalanceReminderProps | null> {
  return async (prisma, { paymentId, bookingGroupId, extra }) => {
    const ctx = await loadPaymentContext(prisma, paymentId, bookingGroupId)
    if (!ctx) return null
    const bg = ctx.bookingGroup
    // Payments revamp (Spec v2.3): the reminder cron carries the specific
    // scheduled capture's amount + date via `extra`. Prefer those (the upcoming
    // charge) over the whole remaining balance; fall back to total−deposit for
    // any legacy caller that only passes the booking.
    const captureAmount = extra?.['captureAmount'] as string | undefined
    const captureCurrency = extra?.['captureCurrency'] as string | undefined
    const captureDate = extra?.['captureDate'] as string | undefined
    const deposit = toNumber(bg.depositAmount)
    const total = toNumber(bg.totalAmount)
    const fallbackBalance = Math.max(0, total - deposit)
    const amount = captureAmount != null ? Number(captureAmount) : fallbackBalance
    const currency = (captureCurrency ?? ctx.currency ?? 'USD').toUpperCase()
    const dueDateObj = captureDate ? new Date(captureDate) : bg.balanceDueAt

    // Card-expiry warning (Spec v2.3 §7): if the card we'll charge expires before
    // this capture date, tell the parent to update it now — re-hydrated fresh at
    // send time (reschedule-safe). Best-effort: a lookup miss just omits the
    // warning. Mirrors `chargeOffSession`'s default-card resolution.
    let cardExpiringBeforeCapture = false
    let cardLast4: string | undefined
    if (dueDateObj) {
      const pcc = await prisma.payment.findFirst({
        where: { bookingGroupId: bg.id, providerConnectCustomerId: { not: null } },
        select: { providerConnectCustomerId: true },
        orderBy: { createdAt: 'asc' },
      })
      if (pcc?.providerConnectCustomerId) {
        const card = await prisma.savedPaymentMethod.findFirst({
          where: {
            providerConnectCustomerId: pcc.providerConnectCustomerId,
            isDefault: true,
            archivedAt: null,
          },
          select: { expMonth: true, expYear: true, last4: true },
        })
        if (card && cardExpiresBeforeDate(card.expMonth, card.expYear, dueDateObj)) {
          cardExpiringBeforeCapture = true
          cardLast4 = card.last4
        }
      }
    }

    return {
      salutation: 'hi',
      firstName: bg.parent.user.firstName,
      childName: bg.bookings[0]?.child?.firstName ?? 'your child',
      campName: bg.camp.name,
      bookingRef: bg.bookingGroupNumber,
      balanceAmount: formatCurrency(amount, currency),
      balanceDueDate: formatDate(dueDateObj),
      daysUntilDue,
      bookingUrl: `${PARENT_APP_BASE_URL}/bookings/${bg.id}`,
      cardExpiringBeforeCapture,
      cardLast4,
    }
  }
}

const parentPaymentBalanceCharged: PropLoader<ParentPaymentBalanceChargedProps | null> = async (
  prisma,
  { paymentId, bookingGroupId }
) => {
  const ctx = await loadPaymentContext(prisma, paymentId, bookingGroupId)
  if (!ctx) return null
  const bg = ctx.bookingGroup
  const currency = (ctx.currency ?? 'USD').toUpperCase()
  return {
    salutation: 'hi',
    firstName: bg.parent.user.firstName,
    childName: bg.bookings[0]?.child?.firstName ?? 'your child',
    campName: bg.camp.name,
    bookingRef: bg.bookingGroupNumber,
    balanceAmount: formatCurrency(toNumber(ctx.amount), currency),
    startDate: formatDate(bg.session.startDate),
    bookingUrl: `${PARENT_APP_BASE_URL}/bookings/${bg.id}`,
  }
}

function buildBalanceFailed(
  stage: 'first' | 'second' | 'final'
): PropLoader<ParentPaymentBalanceFailedProps | null> {
  return async (prisma, { paymentId, bookingGroupId, extra }) => {
    const ctx = await loadPaymentContext(prisma, paymentId, bookingGroupId)
    if (!ctx) return null
    const bg = ctx.bookingGroup
    const currency = (ctx.currency ?? 'USD').toUpperCase()
    return {
      // Spec `Notes & Conventions`: financial-distress copy uses 'dear'.
      salutation: 'dear',
      firstName: bg.parent.user.firstName,
      childName: bg.bookings[0]?.child?.firstName ?? 'your child',
      campName: bg.camp.name,
      bookingRef: bg.bookingGroupNumber,
      balanceAmount: formatCurrency(toNumber(ctx.amount), currency),
      stage,
      declineReason: ctx.failureMessage ?? ctx.failureCode ?? null,
      retryDeadline: extra?.['retryDeadline'] as string | undefined,
      paymentUpdateUrl: `${PARENT_APP_BASE_URL}/bookings/${bg.id}/payment/update`,
    }
  }
}

const parentPaymentCancelledNonPayment: PropLoader<
  ParentPaymentCancelledNonPaymentProps | null
> = async (prisma, { bookingGroupId }) => {
  if (!bookingGroupId) return null
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: {
      bookingGroupNumber: true,
      parent: { select: { user: { select: { firstName: true } } } },
      camp: { select: { name: true } },
      bookings: { select: { child: { select: { firstName: true } } }, take: 1 },
    },
  })
  if (!bg) return null
  return {
    salutation: 'dear',
    firstName: bg.parent.user.firstName,
    childName: bg.bookings[0]?.child?.firstName ?? 'your child',
    campName: bg.camp.name,
    bookingRef: bg.bookingGroupNumber,
    browseUrl: `${PARENT_APP_BASE_URL}/camps`,
  }
}

// ============================================================================
// Refund / dispute loaders
// ============================================================================

const parentRefundIssued: PropLoader<ParentRefundIssuedProps | null> = async (
  prisma,
  { refundId, extra }
) => {
  if (!refundId) return null
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    select: {
      amount: true,
      reason: true,
      bookingGroup: {
        select: {
          bookingGroupNumber: true,
          parent: { select: { user: { select: { firstName: true } } } },
          camp: { select: { name: true } },
        },
      },
      payment: { select: { currency: true } },
    },
  })
  if (!refund) return null
  const currency = (refund.payment.currency ?? 'USD').toUpperCase()
  return {
    salutation: 'hi',
    firstName: refund.bookingGroup.parent.user.firstName,
    campName: refund.bookingGroup.camp.name,
    bookingRef: refund.bookingGroup.bookingGroupNumber,
    refundAmount: formatCurrency(toNumber(refund.amount), currency),
    refundEta: (extra?.['refundEta'] as string | undefined) ?? '5–10 business days',
    reasonLabel: humanizeRefundReason(refund.reason),
  }
}

function humanizeRefundReason(reason: string): string {
  switch (reason) {
    case 'grace_period':
      return 'Cancellation within grace period'
    case 'policy_balance':
      return 'Cancellation policy refund'
    case 'special_circumstance':
      return 'Special-circumstance refund'
    case 'provider_declined':
      return 'Provider declined the booking'
    case 'provider_expired':
      return 'Booking request expired'
    case 'camp_cancel':
      return 'Camp cancelled the session'
    case 'force_majeure':
      return 'Force majeure'
    case 'dispute':
      return 'Chargeback resolved'
    case 'manual_admin':
      return 'Adjusted by our team'
    case 'fraud':
      return 'Suspected fraud — refunded'
    default:
      return 'Refund'
  }
}

const parentRefundFailed: PropLoader<ParentRefundFailedProps | null> = async (
  prisma,
  { refundId }
) => {
  if (!refundId) return null
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    select: {
      amount: true,
      stripeFailureReason: true,
      bookingGroup: {
        select: {
          bookingGroupNumber: true,
          parent: { select: { user: { select: { firstName: true } } } },
          camp: { select: { name: true } },
        },
      },
      payment: { select: { currency: true } },
    },
  })
  if (!refund) return null
  const currency = (refund.payment.currency ?? 'USD').toUpperCase()
  return {
    salutation: 'dear',
    firstName: refund.bookingGroup.parent.user.firstName,
    campName: refund.bookingGroup.camp.name,
    bookingRef: refund.bookingGroup.bookingGroupNumber,
    refundAmount: formatCurrency(toNumber(refund.amount), currency),
    failureReason: refund.stripeFailureReason,
  }
}

const parentDisputeOpened: PropLoader<ParentDisputeOpenedProps | null> = async (
  prisma,
  { disputeId }
) => {
  if (!disputeId) return null
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    select: {
      amount: true,
      currency: true,
      bookingGroup: {
        select: {
          bookingGroupNumber: true,
          parent: { select: { user: { select: { firstName: true } } } },
          camp: { select: { name: true } },
        },
      },
    },
  })
  if (!dispute?.bookingGroup) return null
  return {
    salutation: 'dear',
    firstName: dispute.bookingGroup.parent.user.firstName,
    campName: dispute.bookingGroup.camp.name,
    bookingRef: dispute.bookingGroup.bookingGroupNumber,
    disputeAmount: formatCurrency(toNumber(dispute.amount), dispute.currency.toUpperCase()),
  }
}

function buildDisputeResolved(
  outcome: 'won' | 'lost'
): PropLoader<ParentDisputeResolvedProps | null> {
  return async (prisma, { disputeId }) => {
    if (!disputeId) return null
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      select: {
        amount: true,
        currency: true,
        bookingGroup: {
          select: {
            bookingGroupNumber: true,
            parent: { select: { user: { select: { firstName: true } } } },
            camp: { select: { name: true } },
          },
        },
      },
    })
    if (!dispute?.bookingGroup) return null
    return {
      salutation: 'dear',
      firstName: dispute.bookingGroup.parent.user.firstName,
      campName: dispute.bookingGroup.camp.name,
      bookingRef: dispute.bookingGroup.bookingGroupNumber,
      disputeAmount: formatCurrency(toNumber(dispute.amount), dispute.currency.toUpperCase()),
      outcome,
    }
  }
}

// ============================================================================
// Messaging / support loaders
// ============================================================================

const parentMessagingNewFromCamp: PropLoader<ParentMessagingNewFromCampProps | null> = async (
  prisma,
  { messageId, conversationId, extra }
) => {
  if (!messageId && !conversationId) return null
  let preview = ''
  let senderName = 'A camp team member'
  let convId = conversationId
  if (messageId) {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        content: true,
        conversationId: true,
        sender: { select: { firstName: true, lastName: true } },
      },
    })
    if (msg) {
      preview = truncate(msg.content ?? '', 140)
      senderName =
        [msg.sender?.firstName, msg.sender?.lastName].filter(Boolean).join(' ') || senderName
      convId = msg.conversationId
    }
  }
  const camp = await loadConversationCampName(prisma, convId)
  return {
    salutation: 'hi',
    firstName: (extra?.['parentFirstName'] as string | undefined) ?? null,
    campName: camp ?? 'your camp',
    senderName,
    preview,
    conversationUrl: `${PARENT_APP_BASE_URL}/messages/${convId ?? ''}`,
  }
}

async function loadConversationCampName(
  prisma: PrismaService,
  conversationId: string | undefined
): Promise<string | null> {
  if (!conversationId) return null
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { contextType: true, contextId: true },
  })
  if (!conv) return null
  // Camp DMs typically have contextType=CAMP and contextId=campId
  if (conv.contextType === 'CAMP' && conv.contextId) {
    const camp = await prisma.camp.findUnique({
      where: { id: conv.contextId },
      select: { name: true },
    })
    return camp?.name ?? null
  }
  return null
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, Math.max(0, n - 1)).trimEnd() + '…'
}

const parentSupportTicketReply: PropLoader<ParentSupportTicketReplyProps | null> = async (
  prisma,
  { supportTicketId, messageId }
) => {
  if (!supportTicketId) return null
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: supportTicketId },
    select: {
      subject: true,
      ticketNumber: true,
      requesterUser: { select: { firstName: true } },
    },
  })
  if (!ticket) return null
  let preview = ''
  if (messageId) {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { content: true },
    })
    if (msg?.content) preview = truncate(msg.content, 160)
  }
  return {
    salutation: 'hi',
    firstName: ticket.requesterUser?.firstName ?? null,
    ticketSubject: ticket.subject,
    ticketRef: ticket.ticketNumber,
    preview,
    ticketUrl: `${PARENT_APP_BASE_URL}/support/${ticket.ticketNumber}`,
  }
}

const parentSupportTicketStatusChanged: PropLoader<
  ParentSupportTicketStatusChangedProps | null
> = async (prisma, { supportTicketId, extra }) => {
  if (!supportTicketId) return null
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: supportTicketId },
    select: {
      subject: true,
      ticketNumber: true,
      status: true,
      requesterUser: { select: { firstName: true } },
    },
  })
  if (!ticket) return null
  const explicit = extra?.['newStatusLabel'] as string | undefined
  const newStatusLabel = explicit ?? humanizeTicketStatus(ticket.status)
  return {
    salutation: 'hi',
    firstName: ticket.requesterUser?.firstName ?? null,
    ticketSubject: ticket.subject,
    ticketRef: ticket.ticketNumber,
    newStatusLabel,
    ticketUrl: `${PARENT_APP_BASE_URL}/support/${ticket.ticketNumber}`,
  }
}

function humanizeTicketStatus(s: string): string {
  switch (s) {
    case 'OPEN':
      return 'Open'
    case 'IN_PROGRESS':
      return 'In progress'
    case 'WAITING_ON_REQUESTER':
      return 'Waiting on you'
    case 'RESOLVED':
      return 'Resolved'
    case 'CLOSED':
      return 'Closed'
    default:
      return s
  }
}

// ============================================================================
// Wishlist / conversion loaders
// ============================================================================

const parentWishlistEmpty: PropLoader<ParentWishlistEmptyProps | null> = async (
  prisma,
  { parentUserId }
) => {
  if (!parentUserId) return null
  const user = await prisma.user.findUnique({
    where: { id: parentUserId },
    select: { firstName: true },
  })
  return {
    salutation: 'hi',
    firstName: user?.firstName ?? null,
    browseUrl: `${PARENT_APP_BASE_URL}/camps`,
  }
}

function buildWishlistItemsNoBooking(
  daysSinceSaved: 7 | 21
): PropLoader<ParentWishlistItemsNoBookingProps | null> {
  return async (prisma, { parentUserId }) => {
    if (!parentUserId) return null
    const parent = await prisma.parent.findUnique({
      where: { userId: parentUserId },
      select: {
        user: { select: { firstName: true } },
        wishlists: {
          select: {
            items: {
              select: { camp: { select: { name: true } } },
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
            _count: { select: { items: true } },
          },
          take: 1,
        },
      },
    })
    if (!parent) return null
    const wishlist = parent.wishlists[0]
    const itemCount = wishlist?._count.items ?? 0
    const leadCampName = wishlist?.items[0]?.camp.name ?? ''
    if (!itemCount || !leadCampName) return null
    return {
      salutation: 'hi',
      firstName: parent.user.firstName,
      itemCount,
      leadCampName,
      daysSinceSaved,
      wishlistUrl: `${PARENT_APP_BASE_URL}/wishlist`,
    }
  }
}

function buildWishlistEvent(
  kind: 'priceDrop' | 'fillingUp' | 'deadlineApproaching' | 'earlyBirdIncrease'
): PropLoader<ParentWishlistEventProps | null> {
  return async (prisma, { parentUserId, campId, sessionId, extra }) => {
    if (!parentUserId || !campId) return null
    const [user, camp, session] = await Promise.all([
      prisma.user.findUnique({ where: { id: parentUserId }, select: { firstName: true } }),
      prisma.camp.findUnique({ where: { id: campId }, select: { name: true, slug: true } }),
      sessionId
        ? prisma.session.findUnique({ where: { id: sessionId }, select: { name: true } })
        : Promise.resolve(null),
    ])
    if (!camp) return null
    const detail = (extra?.['detail'] as string | undefined) ?? ''
    return {
      salutation: 'hi',
      firstName: user?.firstName ?? null,
      campName: camp.name,
      sessionName: session?.name ?? null,
      detail,
      campUrl: `${PARENT_APP_BASE_URL}/camps/${camp.slug ?? camp.name}`,
      kind,
    }
  }
}

const parentPostDeclineAlternatives: PropLoader<ParentPostDeclineAlternativesProps | null> = async (
  prisma,
  { parentUserId, bookingGroupId }
) => {
  if (!parentUserId || !bookingGroupId) return null
  const [user, bg] = await Promise.all([
    prisma.user.findUnique({ where: { id: parentUserId }, select: { firstName: true } }),
    prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: { camp: { select: { name: true, slug: true } } },
    }),
  ])
  if (!bg) return null
  return {
    salutation: 'hi',
    firstName: user?.firstName ?? null,
    originalCampName: bg.camp.name,
    alternativesUrl: `${PARENT_APP_BASE_URL}/camps?similar-to=${encodeURIComponent(
      bg.camp.slug ?? bg.camp.name
    )}`,
  }
}

function buildAbandonedCheckout(
  stage: '3h' | '2d' | '4d' | '6d'
): PropLoader<ParentCheckoutAbandonedProps | null> {
  return async (prisma, { bookingGroupId }) => {
    if (!bookingGroupId) return null
    const bg = await prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: {
        parent: { select: { user: { select: { firstName: true } } } },
        camp: { select: { name: true } },
      },
    })
    if (!bg) return null
    return {
      salutation: 'hi',
      firstName: bg.parent.user.firstName,
      campName: bg.camp.name,
      resumeUrl: `${PARENT_APP_BASE_URL}/bookings/${bookingGroupId}`,
      stage,
    }
  }
}

// ============================================================================
// Pre/post-camp + review + profile loaders
// ============================================================================

function buildPreCamp(
  stage: 'checklist14d' | 'packing7d' | 'dayBefore'
): PropLoader<ParentPreCampProps | null> {
  return async (prisma, { bookingGroupId }) => {
    if (!bookingGroupId) return null
    const bg = await prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: {
        id: true,
        bookingGroupNumber: true,
        parent: { select: { user: { select: { firstName: true } } } },
        camp: { select: { name: true } },
        session: { select: { startDate: true } },
        bookings: { select: { child: { select: { firstName: true } } }, take: 1 },
      },
    })
    if (!bg) return null
    return {
      salutation: 'hi',
      firstName: bg.parent.user.firstName,
      childName: bg.bookings[0]?.child?.firstName ?? 'your child',
      campName: bg.camp.name,
      bookingRef: bg.bookingGroupNumber,
      startDate: formatDate(bg.session.startDate),
      bookingUrl: `${PARENT_APP_BASE_URL}/bookings/${bg.id}`,
      stage,
    }
  }
}

function buildPostCampReview(
  stage: 'request' | 'reminder' | 'survey'
): PropLoader<ParentPostCampReviewProps | null> {
  return async (prisma, { bookingGroupId }) => {
    if (!bookingGroupId) return null
    const bg = await prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: {
        id: true,
        parent: { select: { user: { select: { firstName: true } } } },
        camp: { select: { name: true } },
        bookings: { select: { child: { select: { firstName: true } } }, take: 1 },
      },
    })
    if (!bg) return null
    return {
      salutation: 'hi',
      firstName: bg.parent.user.firstName,
      childName: bg.bookings[0]?.child?.firstName ?? 'your child',
      campName: bg.camp.name,
      reviewUrl: `${PARENT_APP_BASE_URL}/bookings/${bg.id}/review`,
      stage,
    }
  }
}

const parentReviewResponsePublished: PropLoader<ParentReviewResponsePublishedProps | null> = async (
  prisma,
  { reviewId }
) => {
  if (!reviewId) return null
  const review = await prisma.campReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      camp: { select: { name: true } },
      parent: { select: { user: { select: { firstName: true } } } },
      response: { select: { responseText: true } },
    },
  })
  if (!review?.response) return null
  return {
    salutation: 'hi',
    firstName: review.parent.user.firstName,
    campName: review.camp.name,
    preview: truncate(review.response.responseText, 180),
    reviewUrl: `${PARENT_APP_BASE_URL}/reviews/${review.id}`,
  }
}

const parentReviewRemoved: PropLoader<ParentReviewRemovedProps | null> = async (
  prisma,
  { reviewId, extra }
) => {
  if (!reviewId) return null
  const review = await prisma.campReview.findUnique({
    where: { id: reviewId },
    select: {
      camp: { select: { name: true } },
      parent: { select: { user: { select: { firstName: true } } } },
    },
  })
  if (!review) return null
  return {
    salutation: 'hi',
    firstName: review.parent.user.firstName,
    campName: review.camp.name,
    reasonLabel:
      (extra?.['reasonLabel'] as string | undefined) ?? 'Content violated our review guidelines.',
  }
}

const parentProfileIncomplete: PropLoader<ParentProfileIncompleteProps | null> = async (
  prisma,
  { parentUserId }
) => {
  if (!parentUserId) return null
  const parent = await prisma.parent.findUnique({
    where: { userId: parentUserId },
    select: {
      profileCompletion: true,
      user: { select: { firstName: true } },
    },
  })
  if (!parent) return null
  return {
    salutation: 'hi',
    firstName: parent.user.firstName,
    completionScore: parent.profileCompletion ?? 0,
    profileUrl: `${PARENT_APP_BASE_URL}/account/profile`,
  }
}

/**
 * Loader for the scheduled "still pending" + auto-expiry triggers. Both
 * reuse the BookingGroup join from `parentBookingRequestSubmitted` —
 * skipped when the request has already transitioned out of `request` so
 * a parent who accepted/withdrew before the scheduled job fires doesn't
 * get an obsolete reminder.
 */
const parentBookingRequestPendingState: PropLoader<
  ParentBookingRequestSubmittedProps | null
> = async (prisma: PrismaService, ctx: NotificationContext) => {
  if (!ctx.bookingGroupId) return null
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: ctx.bookingGroupId },
    select: { status: true },
  })
  if (bg?.status !== 'request') return null
  return parentBookingRequestSubmitted(prisma, ctx)
}

/**
 * Loader for the scheduled auto-expiry trigger (`ParentBookingExpired`).
 *
 * The expiry notification is scheduled for submit+72h, but the
 * `BookingResponseExpiryCron` flips `request → expired` at that same mark.
 * Reusing `parentBookingRequestPendingState` (which requires `status ===
 * 'request'`) made this notification render nothing — by the time it fired the
 * status was already `expired`, so the loader returned null and the delivery
 * was silently skipped. This loader instead fires when the request genuinely
 * lapsed: status is already `expired`, OR still `request` but its `expiresAt`
 * deadline has passed (the cron simply hasn't ticked yet). A request that was
 * accepted/declined/withdrawn — or extended into the future — is correctly
 * skipped so no obsolete "expired" notice goes out.
 */
const parentBookingExpiredState: PropLoader<ParentBookingRequestSubmittedProps | null> = async (
  prisma: PrismaService,
  ctx: NotificationContext
) => {
  if (!ctx.bookingGroupId) return null
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: ctx.bookingGroupId },
    select: { status: true, expiresAt: true },
  })
  if (!bg) return null
  const lapsed =
    bg.status === 'expired' ||
    (bg.status === 'request' && bg.expiresAt != null && bg.expiresAt.getTime() <= Date.now())
  if (!lapsed) return null
  return parentBookingRequestSubmitted(prisma, ctx)
}

// ============================================================================
// Provider loaders
// ============================================================================

/** Common provider context: company name + dashboard root. */
async function loadProviderHeader(
  prisma: PrismaService,
  providerId: string | undefined
): Promise<{ companyName: string } | null> {
  if (!providerId) return null
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { legalCompanyName: true },
  })
  if (!provider) return null
  return { companyName: provider.legalCompanyName ?? 'Your camp' }
}

function buildProviderApplicationStatus(
  stage:
    | 'received'
    | 'approved'
    | 'declined'
    | 'documentReuploadRequested'
    | 'additionalInfoRequired'
): PropLoader<ProviderApplicationStatusProps | null> {
  return async (prisma, { providerId, extra }) => {
    const header = await loadProviderHeader(prisma, providerId)
    if (!header) return null
    return {
      companyName: header.companyName,
      stage,
      detail: (extra?.['detail'] as string | undefined) ?? null,
      dashboardUrl: `${PROVIDER_APP_BASE_URL}/onboarding/status`,
    }
  }
}

function buildProviderStripeConnect(
  stage: 'nudge' | 'reminder' | 'disconnected'
): PropLoader<ProviderStripeConnectProps | null> {
  return async (prisma, { providerId }) => {
    if (!providerId) return null
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        legalCompanyName: true,
        stripeAccountDisconnectedReason: true,
      },
    })
    if (!provider) return null
    return {
      companyName: provider.legalCompanyName ?? 'Your camp',
      stage,
      reason: stage === 'disconnected' ? (provider.stripeAccountDisconnectedReason ?? null) : null,
      connectUrl: `${PROVIDER_APP_BASE_URL}/onboarding/stripe-connect`,
    }
  }
}

function buildProviderProfileMilestone(
  stage: 'profileIncomplete' | 'profilePublished' | 'firstBooking'
): PropLoader<ProviderProfileMilestoneProps | null> {
  return async (prisma, { providerId, bookingGroupId }) => {
    if (!providerId && !bookingGroupId) return null
    // For firstBooking we may receive bookingGroupId and derive providerId from it.
    let resolvedProviderId = providerId
    if (!resolvedProviderId && bookingGroupId) {
      const bg = await prisma.bookingGroup.findUnique({
        where: { id: bookingGroupId },
        select: { providerId: true },
      })
      resolvedProviderId = bg?.providerId
    }
    if (!resolvedProviderId) return null
    const provider = await prisma.provider.findUnique({
      where: { id: resolvedProviderId },
      select: { legalCompanyName: true, profileCompletion: true },
    })
    if (!provider) return null
    const ctaUrl =
      stage === 'firstBooking' && bookingGroupId
        ? `${PROVIDER_APP_BASE_URL}/bookings/${bookingGroupId}`
        : `${PROVIDER_APP_BASE_URL}/dashboard`
    return {
      companyName: provider.legalCompanyName ?? 'Your camp',
      stage,
      completionScore: provider.profileCompletion ?? 0,
      ctaUrl,
    }
  }
}

/**
 * Provider-facing context for booking-lifecycle triggers. Loads the
 * BookingGroup + bookingGroupNumber + program / parent display.
 */
async function loadProviderBookingHeader(
  prisma: PrismaService,
  bookingGroupId: string | undefined
) {
  if (!bookingGroupId) return null
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: {
      id: true,
      bookingGroupNumber: true,
      provider: { select: { legalCompanyName: true } },
      session: { select: { name: true } },
      parent: { select: { user: { select: { firstName: true, lastName: true } } } },
    },
  })
  if (!bg) return null
  const parentDisplay =
    [bg.parent.user.firstName, bg.parent.user.lastName].filter(Boolean).join(' ') || 'A family'
  return {
    companyName: bg.provider.legalCompanyName ?? 'Your camp',
    bookingRef: bg.bookingGroupNumber,
    programName: bg.session.name,
    parentDisplay,
    bookingUrl: `${PROVIDER_APP_BASE_URL}/bookings/${bg.id}`,
  }
}

function buildProviderBookingEvent(
  kind:
    | 'cancelledByFamily'
    | 'cancelledNonPayment'
    | 'requestWithdrawn'
    | 'modified'
    | 'request48hReminder'
    | 'requestFinalReminder'
    | 'requestExpired'
): PropLoader<ProviderBookingEventProps | null> {
  return async (prisma, { bookingGroupId, extra }) => {
    if (!bookingGroupId) return null
    // For scheduled reminders, short-circuit if the booking has
    // transitioned out of `request` (parent withdrew, provider already
    // responded). Cancellation reminders only fire when the booking is
    // actually cancelled, etc.
    if (
      kind === 'request48hReminder' ||
      kind === 'requestFinalReminder' ||
      kind === 'requestExpired'
    ) {
      const bg = await prisma.bookingGroup.findUnique({
        where: { id: bookingGroupId },
        select: { status: true },
      })
      if (kind === 'requestExpired') {
        // Only fire if the booking is in `request` (auto-expired) or
        // already flipped to `expired`. A provider who responded before
        // the 72h mark doesn't need an "expired" notification.
        if (bg?.status !== 'request' && bg?.status !== 'expired') return null
      } else if (bg?.status !== 'request') {
        return null
      }
    }
    const header = await loadProviderBookingHeader(prisma, bookingGroupId)
    if (!header) return null
    return {
      companyName: header.companyName,
      bookingRef: header.bookingRef,
      programName: header.programName,
      parentName: header.parentDisplay,
      detail: (extra?.['detail'] as string | undefined) ?? null,
      kind,
      bookingUrl: header.bookingUrl,
    }
  }
}

function buildProviderPayoutEvent(
  kind: 'scheduleConfirmed' | 'balanceCollected' | 'reminder' | 'released' | 'failed' | 'delayed'
): PropLoader<ProviderPayoutEventProps | null> {
  return async (prisma, { bookingGroupId, paymentId, extra }) => {
    // Provider header — derive from booking or payment in priority order.
    let providerId: string | undefined
    let companyName = 'Your camp'
    let bookingRef: string | null = null
    let amountMajor = 0
    let currency = 'USD'
    const whenLabel: string | undefined = (extra?.['whenLabel'] as string | undefined) ?? undefined
    const reason: string | undefined = (extra?.['reason'] as string | undefined) ?? undefined

    if (bookingGroupId) {
      const bg = await prisma.bookingGroup.findUnique({
        where: { id: bookingGroupId },
        select: {
          bookingGroupNumber: true,
          providerId: true,
          provider: { select: { legalCompanyName: true } },
          totalAmount: true,
        },
      })
      if (bg) {
        providerId = bg.providerId
        bookingRef = bg.bookingGroupNumber
        companyName = bg.provider.legalCompanyName ?? companyName
        amountMajor = toNumber(bg.totalAmount)
      }
    }
    if (paymentId) {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: {
          amount: true,
          currency: true,
          bookingGroup: {
            select: {
              bookingGroupNumber: true,
              providerId: true,
              provider: { select: { legalCompanyName: true } },
            },
          },
        },
      })
      if (payment) {
        amountMajor = toNumber(payment.amount)
        currency = payment.currency.toUpperCase()
        bookingRef = payment.bookingGroup.bookingGroupNumber
        providerId = payment.bookingGroup.providerId
        companyName = payment.bookingGroup.provider.legalCompanyName ?? companyName
      }
    }
    if (!providerId) return null
    return {
      companyName,
      bookingRef,
      amount: formatCurrency(amountMajor, currency),
      whenLabel,
      kind,
      reason: reason ?? null,
      payoutsUrl: `${PROVIDER_APP_BASE_URL}/payouts`,
    }
  }
}

function buildProviderRefundEvent(
  kind: 'issued' | 'failed' | 'reimbursementOwed'
): PropLoader<ProviderRefundEventProps | null> {
  return async (prisma, { refundId }) => {
    if (!refundId) return null
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      select: {
        amount: true,
        reason: true,
        stripeFailureReason: true,
        bookingGroup: {
          select: {
            bookingGroupNumber: true,
            provider: { select: { legalCompanyName: true } },
          },
        },
        payment: { select: { currency: true } },
      },
    })
    if (!refund) return null
    const currency = (refund.payment.currency ?? 'USD').toUpperCase()
    return {
      companyName: refund.bookingGroup.provider.legalCompanyName ?? 'Your camp',
      bookingRef: refund.bookingGroup.bookingGroupNumber,
      amount: formatCurrency(toNumber(refund.amount), currency),
      reason:
        kind === 'failed'
          ? (refund.stripeFailureReason ?? null)
          : humanizeRefundReason(refund.reason),
      kind,
      refundsUrl: `${PROVIDER_APP_BASE_URL}/refunds`,
    }
  }
}

function buildProviderDisputeEvent(
  kind: 'opened' | 'evidenceDue' | 'resolvedWon' | 'resolvedLost'
): PropLoader<ProviderDisputeEventProps | null> {
  return async (prisma, { disputeId }) => {
    if (!disputeId) return null
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      select: {
        amount: true,
        currency: true,
        evidenceDueBy: true,
        bookingGroup: {
          select: {
            bookingGroupNumber: true,
            provider: { select: { legalCompanyName: true } },
          },
        },
      },
    })
    if (!dispute) return null
    return {
      companyName: dispute.bookingGroup.provider.legalCompanyName ?? 'Your camp',
      bookingRef: dispute.bookingGroup.bookingGroupNumber,
      amount: formatCurrency(toNumber(dispute.amount), dispute.currency.toUpperCase()),
      evidenceDueLabel: dispute.evidenceDueBy ? formatDate(dispute.evidenceDueBy) : null,
      kind,
      disputesUrl: `${PROVIDER_APP_BASE_URL}/disputes`,
    }
  }
}

function buildProviderMessagingEvent(
  kind: 'newFromFamily' | 'unanswered24h' | 'unanswered48h'
): PropLoader<ProviderMessagingEventProps | null> {
  return async (prisma, { conversationId, messageId, providerId }) => {
    if (!conversationId) return null
    let preview = ''
    let parentDisplay = 'A family'
    if (messageId) {
      const msg = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          content: true,
          sender: { select: { firstName: true, lastName: true, email: true } },
        },
      })
      if (msg) {
        preview = truncate(msg.content ?? '', 160)
        parentDisplay =
          [msg.sender?.firstName, msg.sender?.lastName].filter(Boolean).join(' ') ||
          msg.sender?.email ||
          parentDisplay
      }
    }
    let companyName = 'Your camp'
    if (providerId) {
      const provider = await prisma.provider.findUnique({
        where: { id: providerId },
        select: { legalCompanyName: true },
      })
      if (provider?.legalCompanyName) companyName = provider.legalCompanyName
    }
    return {
      companyName,
      parentDisplay,
      preview,
      kind,
      conversationUrl: `${PROVIDER_APP_BASE_URL}/messages/${conversationId}`,
    }
  }
}

function buildProviderReviewEvent(
  kind: 'newReview' | 'responsePublished' | 'notRespondedReminder' | 'reviewRemoved'
): PropLoader<ProviderReviewEventProps | null> {
  return async (prisma, { reviewId, extra }) => {
    if (!reviewId) return null
    const review = await prisma.campReview.findUnique({
      where: { id: reviewId },
      select: {
        happinessRating: true,
        reviewText: true,
        camp: {
          select: {
            name: true,
            provider: { select: { legalCompanyName: true } },
          },
        },
      },
    })
    if (!review) return null
    return {
      companyName: review.camp.provider.legalCompanyName ?? 'Your camp',
      campName: review.camp.name,
      rating: review.happinessRating ?? null,
      preview: review.reviewText ? truncate(review.reviewText, 180) : undefined,
      kind,
      reasonLabel: (extra?.['reasonLabel'] as string | undefined) ?? null,
      reviewsUrl: `${PROVIDER_APP_BASE_URL}/reviews`,
    }
  }
}

function buildProviderPreCamp(
  stage: 'rosterReady' | 'checklist' | 'dayBefore' | 'postCampWrap'
): PropLoader<ProviderPreCampProps | null> {
  return async (prisma, { campId, sessionId }) => {
    if (!campId || !sessionId) return null
    const [camp, session] = await Promise.all([
      prisma.camp.findUnique({
        where: { id: campId },
        select: {
          name: true,
          provider: { select: { legalCompanyName: true } },
        },
      }),
      prisma.session.findUnique({
        where: { id: sessionId },
        select: { startDate: true, endDate: true },
      }),
    ])
    if (!camp || !session) return null
    // Count CONFIRMED participants on this session (bookings inside non-
    // cancelled / non-declined booking groups for this session).
    const participantCount = await prisma.booking.count({
      where: {
        sessionId,
        bookingGroup: {
          status: { in: ['accepted', 'deposit_paid', 'fully_paid', 'at_camp', 'completed'] },
        },
      },
    })
    const when = stage === 'postCampWrap' ? session.endDate : session.startDate
    return {
      companyName: camp.provider.legalCompanyName ?? 'Your camp',
      campName: camp.name,
      whenLabel: formatDate(when),
      participantCount,
      stage,
      dashboardUrl: `${PROVIDER_APP_BASE_URL}/camps`,
    }
  }
}

function buildProviderOperationsNudge(
  kind: 'seasonEnded' | 'programsNotUpdated30d' | 'programsNotUpdated60d'
): PropLoader<ProviderOperationsNudgeProps | null> {
  return async (prisma, { providerId, extra }) => {
    const header = await loadProviderHeader(prisma, providerId)
    if (!header) return null
    return {
      companyName: header.companyName,
      detail: (extra?.['lastUpdate'] as string | undefined) ?? null,
      kind,
      campsUrl: `${PROVIDER_APP_BASE_URL}/camps`,
    }
  }
}

function buildProviderSupportEvent(
  kind: 'ticketReply' | 'ticketStatusChanged'
): PropLoader<ProviderSupportEventProps | null> {
  return async (prisma, { supportTicketId, messageId, extra }) => {
    if (!supportTicketId) return null
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: supportTicketId },
      select: {
        subject: true,
        ticketNumber: true,
        status: true,
        requesterProvider: { select: { legalCompanyName: true } },
      },
    })
    if (!ticket) return null
    let detail = ''
    if (kind === 'ticketReply') {
      if (messageId) {
        const msg = await prisma.message.findUnique({
          where: { id: messageId },
          select: { content: true },
        })
        if (msg?.content) detail = truncate(msg.content, 160)
      }
    } else {
      detail =
        (extra?.['newStatusLabel'] as string | undefined) ?? humanizeTicketStatus(ticket.status)
    }
    return {
      companyName: ticket.requesterProvider?.legalCompanyName ?? 'Your camp',
      ticketSubject: ticket.subject,
      ticketRef: ticket.ticketNumber,
      detail,
      kind,
      ticketUrl: `${PROVIDER_APP_BASE_URL}/support/${ticket.ticketNumber}`,
    }
  }
}

// ============================================================================
// Superadmin loaders
// ============================================================================

const SUPERADMIN_APP_BASE_URL = process.env.SUPERADMIN_PORTAL_URL ?? 'http://localhost:4301'

/** Common camp/provider lookup used by every superadmin loader. */
async function loadSuperadminCampHeader(
  prisma: PrismaService,
  providerId: string | undefined
): Promise<{ companyName: string; country: string | null } | null> {
  if (!providerId) return null
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { legalCompanyName: true, legalCountry: true },
  })
  if (!provider) return null
  return {
    companyName: provider.legalCompanyName ?? 'A camp',
    country: provider.legalCountry ?? null,
  }
}

async function loadSuperadminCampForBooking(
  prisma: PrismaService,
  bookingGroupId: string | undefined
): Promise<{ providerId: string; companyName: string; bookingRef: string } | null> {
  if (!bookingGroupId) return null
  const bg = await prisma.bookingGroup.findUnique({
    where: { id: bookingGroupId },
    select: {
      bookingGroupNumber: true,
      providerId: true,
      provider: { select: { legalCompanyName: true } },
    },
  })
  if (!bg) return null
  return {
    providerId: bg.providerId,
    companyName: bg.provider.legalCompanyName ?? 'A camp',
    bookingRef: bg.bookingGroupNumber,
  }
}

function buildSuperadminCampOnboarding(
  kind:
    | 'applicationNew'
    | 'docsUploaded'
    | 'docsNotUploaded'
    | 'profileIncomplete14d'
    | 'firstListingLive'
): PropLoader<SuperadminCampOnboardingProps | null> {
  return async (prisma, { providerId, extra }) => {
    const header = await loadSuperadminCampHeader(prisma, providerId)
    if (!header) return null
    const daysSinceApproval =
      typeof extra?.['daysSinceApproval'] === 'number'
        ? (extra['daysSinceApproval'] as number)
        : null
    return {
      companyName: header.companyName,
      country: header.country,
      daysSinceApproval,
      kind,
      reviewUrl: `${SUPERADMIN_APP_BASE_URL}/providers/${providerId}`,
    }
  }
}

function buildSuperadminCampHealth(
  kind:
    | 'stripeDisconnected'
    | 'deletionRequested'
    | 'profileNeedsAttention60d'
    | 'profileDeactivated'
    | 'unresponsiveExpiredRequests'
): PropLoader<SuperadminCampHealthProps | null> {
  return async (prisma, { providerId, extra }) => {
    const header = await loadSuperadminCampHeader(prisma, providerId)
    if (!header) return null
    const expiredRequestCount =
      typeof extra?.['expiredRequestCount'] === 'number'
        ? (extra['expiredRequestCount'] as number)
        : null
    const daysSinceLastSession =
      typeof extra?.['daysSinceLastSession'] === 'number'
        ? (extra['daysSinceLastSession'] as number)
        : null
    const reason = (extra?.['reason'] as string | undefined) ?? null
    return {
      companyName: header.companyName,
      expiredRequestCount,
      daysSinceLastSession,
      reason,
      kind,
      reviewUrl: `${SUPERADMIN_APP_BASE_URL}/providers/${providerId}`,
    }
  }
}

function buildSuperadminFinanceEvent(
  kind:
    | 'disputeFiled'
    | 'disputeResolved'
    | 'payoutRecoveryNeeded'
    | 'fundsPendingTransfer'
    | 'paymentReviewNeeded'
    | 'bookingCancelledNonPayment'
): PropLoader<SuperadminFinanceEventProps | null> {
  return async (prisma, { bookingGroupId, paymentId, refundId, disputeId, providerId, extra }) => {
    let resolvedProviderId = providerId
    let companyName = 'A camp'
    let bookingRef: string | null = null
    let amountMajor: number | null = null
    let currency = 'USD'
    let reason = (extra?.['reason'] as string | undefined) ?? null
    let outcome: 'won' | 'lost' | null = (extra?.['outcome'] as 'won' | 'lost' | undefined) ?? null

    if (bookingGroupId) {
      const bg = await prisma.bookingGroup.findUnique({
        where: { id: bookingGroupId },
        select: {
          bookingGroupNumber: true,
          providerId: true,
          provider: { select: { legalCompanyName: true } },
          totalAmount: true,
        },
      })
      if (bg) {
        resolvedProviderId = resolvedProviderId ?? bg.providerId
        bookingRef = bg.bookingGroupNumber
        companyName = bg.provider.legalCompanyName ?? companyName
        amountMajor = amountMajor ?? toNumber(bg.totalAmount)
      }
    }
    if (paymentId) {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: {
          amount: true,
          currency: true,
          bookingGroup: {
            select: {
              bookingGroupNumber: true,
              providerId: true,
              provider: { select: { legalCompanyName: true } },
            },
          },
        },
      })
      if (payment) {
        amountMajor = toNumber(payment.amount)
        currency = payment.currency.toUpperCase()
        bookingRef = payment.bookingGroup.bookingGroupNumber
        resolvedProviderId = resolvedProviderId ?? payment.bookingGroup.providerId
        companyName = payment.bookingGroup.provider.legalCompanyName ?? companyName
      }
    }
    if (refundId) {
      const refund = await prisma.refund.findUnique({
        where: { id: refundId },
        select: {
          amount: true,
          stripeFailureReason: true,
          bookingGroup: {
            select: {
              bookingGroupNumber: true,
              providerId: true,
              provider: { select: { legalCompanyName: true } },
            },
          },
          payment: { select: { currency: true } },
        },
      })
      if (refund) {
        amountMajor = toNumber(refund.amount)
        currency = (refund.payment.currency ?? currency).toUpperCase()
        bookingRef = refund.bookingGroup.bookingGroupNumber
        resolvedProviderId = resolvedProviderId ?? refund.bookingGroup.providerId
        companyName = refund.bookingGroup.provider.legalCompanyName ?? companyName
        reason = reason ?? refund.stripeFailureReason ?? null
      }
    }
    if (disputeId) {
      const dispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
        select: {
          amount: true,
          currency: true,
          outcome: true,
          bookingGroup: {
            select: {
              bookingGroupNumber: true,
              providerId: true,
              provider: { select: { legalCompanyName: true } },
            },
          },
        },
      })
      if (dispute) {
        amountMajor = toNumber(dispute.amount)
        currency = dispute.currency.toUpperCase()
        bookingRef = dispute.bookingGroup.bookingGroupNumber
        resolvedProviderId = resolvedProviderId ?? dispute.bookingGroup.providerId
        companyName = dispute.bookingGroup.provider.legalCompanyName ?? companyName
        if (!outcome && (dispute.outcome === 'won' || dispute.outcome === 'lost')) {
          outcome = dispute.outcome
        }
      }
    }
    if (!resolvedProviderId) return null
    return {
      companyName,
      bookingRef,
      amount: amountMajor != null ? formatCurrency(amountMajor, currency) : null,
      reason,
      outcome,
      kind,
      reviewUrl: bookingRef
        ? `${SUPERADMIN_APP_BASE_URL}/financial-dashboard`
        : `${SUPERADMIN_APP_BASE_URL}/providers/${resolvedProviderId}`,
    }
  }
}

function buildSuperadminSupportEvent(
  kind: 'ticketNew' | 'ticketReply'
): PropLoader<SuperadminSupportEventProps | null> {
  return async (prisma, { supportTicketId }) => {
    if (!supportTicketId) return null
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: supportTicketId },
      select: {
        ticketNumber: true,
        subject: true,
        requesterType: true,
        requesterUser: { select: { firstName: true, lastName: true, email: true } },
      },
    })
    if (!ticket) return null
    const u = ticket.requesterUser
    const submitterName = u
      ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || 'Submitter'
      : 'Submitter'
    const submitterType: 'parent' | 'provider' | 'guest' =
      ticket.requesterType === 'PARENT'
        ? 'parent'
        : ticket.requesterType === 'PROVIDER'
          ? 'provider'
          : 'guest'
    return {
      submitterName,
      submitterType,
      ticketRef: ticket.ticketNumber,
      subject: ticket.subject ?? '(no subject)',
      kind,
      reviewUrl: `${SUPERADMIN_APP_BASE_URL}/support/${supportTicketId}`,
    }
  }
}

async function superadminReviewFlagged(
  prisma: PrismaService,
  { reviewId }: NotificationContext
): Promise<SuperadminReviewFlaggedProps | null> {
  if (!reviewId) return null
  const review = await prisma.campReview.findUnique({
    where: { id: reviewId },
    select: {
      reviewText: true,
      happinessRating: true,
      parent: { select: { user: { select: { firstName: true, lastName: true } } } },
      camp: { select: { id: true, provider: { select: { legalCompanyName: true } } } },
    },
  })
  if (!review) return null
  const u = review.parent.user
  const parentName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'A parent'
  const excerpt =
    review.reviewText && review.reviewText.length > 0
      ? review.reviewText.length > 160
        ? `${review.reviewText.slice(0, 160)}…`
        : review.reviewText
      : null
  return {
    parentName,
    companyName: review.camp.provider.legalCompanyName ?? 'A camp',
    rating: review.happinessRating ?? null,
    excerpt,
    reviewUrl: `${SUPERADMIN_APP_BASE_URL}/camps/${review.camp.id}`,
  }
}

/**
 * Catalog-keyed registry. Add a new entry alongside its catalog entry —
 * the catalog validation spec asserts that every NotificationType with
 * an `email` or `inApp` block has a corresponding loader here.
 *
 * Loaders may return `null` to signal "no longer relevant" (entity
 * deleted, state changed). The worker treats null as a skip — marks
 * the NotificationDelivery row `skipped`, completes the job, does not
 * retry.
 */
export const propLoaders = {
  [NotificationType.ParentBookingAccepted]: parentBookingAccepted,
  [NotificationType.ParentBookingDeclined]: parentBookingDeclined,
  [NotificationType.ParentBookingRequestSubmitted]: parentBookingRequestSubmitted,
  [NotificationType.ParentBookingRequestStillPending]: parentBookingRequestPendingState,
  [NotificationType.ParentBookingExpired]: parentBookingExpiredState,
  [NotificationType.ParentBookingCancelled]: parentBookingCancelled,
  [NotificationType.ParentBookingModified]: parentBookingModified,
  [NotificationType.ParentBookingRequestWithdrawn]: parentBookingRequestWithdrawn,
  [NotificationType.ProviderBookingAccepted]: providerBookingInApp,
  [NotificationType.ProviderBookingDeclined]: providerBookingInApp,
  [NotificationType.ProviderBookingRequestReceived]: providerBookingInApp,
  // Payment
  [NotificationType.ParentPaymentDepositConfirmed]: parentPaymentDepositConfirmed,
  [NotificationType.ParentPaymentBalanceReminder14d]: buildBalanceReminder(14),
  [NotificationType.ParentPaymentBalanceReminder7d]: buildBalanceReminder(7),
  [NotificationType.ParentPaymentBalanceReminder3d]: buildBalanceReminder(3),
  [NotificationType.ParentPaymentBalanceCharged]: parentPaymentBalanceCharged,
  [NotificationType.ParentPaymentBalanceFailedFirst]: buildBalanceFailed('first'),
  [NotificationType.ParentPaymentBalanceFailedSecond]: buildBalanceFailed('second'),
  [NotificationType.ParentPaymentBalanceFailedFinal]: buildBalanceFailed('final'),
  [NotificationType.ParentPaymentCancelledNonPayment]: parentPaymentCancelledNonPayment,
  // Refund / dispute
  [NotificationType.ParentRefundIssued]: parentRefundIssued,
  [NotificationType.ParentRefundFailed]: parentRefundFailed,
  [NotificationType.ParentDisputeOpened]: parentDisputeOpened,
  [NotificationType.ParentDisputeResolvedWon]: buildDisputeResolved('won'),
  [NotificationType.ParentDisputeResolvedLost]: buildDisputeResolved('lost'),
  // Messaging / support
  [NotificationType.ParentMessagingNewFromCamp]: parentMessagingNewFromCamp,
  [NotificationType.ParentSupportTicketReply]: parentSupportTicketReply,
  [NotificationType.ParentSupportTicketStatusChanged]: parentSupportTicketStatusChanged,
  // Wishlist / conversion
  [NotificationType.ParentWishlistEmpty]: parentWishlistEmpty,
  [NotificationType.ParentWishlistItemsNoBooking7d]: buildWishlistItemsNoBooking(7),
  [NotificationType.ParentWishlistItemsNoBooking21d]: buildWishlistItemsNoBooking(21),
  [NotificationType.ParentWishlistPriceDrop]: buildWishlistEvent('priceDrop'),
  [NotificationType.ParentWishlistFillingUp]: buildWishlistEvent('fillingUp'),
  [NotificationType.ParentWishlistDeadlineApproaching]: buildWishlistEvent('deadlineApproaching'),
  [NotificationType.ParentWishlistEarlyBirdIncrease]: buildWishlistEvent('earlyBirdIncrease'),
  [NotificationType.ParentConversionPostDeclineAlternatives]: parentPostDeclineAlternatives,
  [NotificationType.ParentCheckoutAbandoned3h]: buildAbandonedCheckout('3h'),
  [NotificationType.ParentCheckoutAbandoned2d]: buildAbandonedCheckout('2d'),
  [NotificationType.ParentCheckoutAbandoned4d]: buildAbandonedCheckout('4d'),
  [NotificationType.ParentCheckoutAbandoned6d]: buildAbandonedCheckout('6d'),
  // Pre/post-camp + reviews + profile
  [NotificationType.ParentPreCampChecklist14d]: buildPreCamp('checklist14d'),
  [NotificationType.ParentPreCampPackingReminder7d]: buildPreCamp('packing7d'),
  [NotificationType.ParentPreCampDayBefore]: buildPreCamp('dayBefore'),
  [NotificationType.ParentPostCampReviewRequest]: buildPostCampReview('request'),
  [NotificationType.ParentPostCampReviewReminder]: buildPostCampReview('reminder'),
  [NotificationType.ParentPostCampSurvey]: buildPostCampReview('survey'),
  [NotificationType.ParentReviewResponsePublished]: parentReviewResponsePublished,
  [NotificationType.ParentReviewRemoved]: parentReviewRemoved,
  [NotificationType.ParentProfileIncomplete]: parentProfileIncomplete,
  // Provider — onboarding
  [NotificationType.ProviderApplicationReceived]: buildProviderApplicationStatus('received'),
  [NotificationType.ProviderApplicationApproved]: buildProviderApplicationStatus('approved'),
  [NotificationType.ProviderApplicationDeclined]: buildProviderApplicationStatus('declined'),
  [NotificationType.ProviderDocumentReuploadRequested]: buildProviderApplicationStatus(
    'documentReuploadRequested'
  ),
  [NotificationType.ProviderAdditionalInfoRequired]:
    buildProviderApplicationStatus('additionalInfoRequired'),
  [NotificationType.ProviderConnectStripeNudge]: buildProviderStripeConnect('nudge'),
  [NotificationType.ProviderConnectStripeReminder]: buildProviderStripeConnect('reminder'),
  [NotificationType.ProviderProfileIncomplete]: buildProviderProfileMilestone('profileIncomplete'),
  [NotificationType.ProviderProfilePublished]: buildProviderProfileMilestone('profilePublished'),
  [NotificationType.ProviderFirstBooking]: buildProviderProfileMilestone('firstBooking'),
  [NotificationType.ProviderStripeDisconnected]: buildProviderStripeConnect('disconnected'),
  // Provider — booking lifecycle
  [NotificationType.ProviderBookingRequest48hReminder]:
    buildProviderBookingEvent('request48hReminder'),
  [NotificationType.ProviderBookingRequestFinalReminder]:
    buildProviderBookingEvent('requestFinalReminder'),
  [NotificationType.ProviderBookingRequestExpired]: buildProviderBookingEvent('requestExpired'),
  [NotificationType.ProviderBookingCancelledByFamily]:
    buildProviderBookingEvent('cancelledByFamily'),
  [NotificationType.ProviderBookingCancelledNonPayment]:
    buildProviderBookingEvent('cancelledNonPayment'),
  [NotificationType.ProviderBookingRequestWithdrawn]: buildProviderBookingEvent('requestWithdrawn'),
  [NotificationType.ProviderBookingModified]: buildProviderBookingEvent('modified'),
  // Provider — payments (capture-when-non-refundable; payout engine removed)
  [NotificationType.ProviderBalanceCollected]: buildProviderPayoutEvent('balanceCollected'),
  // Provider — refunds / disputes
  [NotificationType.ProviderRefundIssued]: buildProviderRefundEvent('issued'),
  [NotificationType.ProviderRefundFailed]: buildProviderRefundEvent('failed'),
  [NotificationType.ProviderReimbursementOwed]: buildProviderRefundEvent('reimbursementOwed'),
  [NotificationType.ProviderDisputeOpened]: buildProviderDisputeEvent('opened'),
  [NotificationType.ProviderDisputeEvidenceDue]: buildProviderDisputeEvent('evidenceDue'),
  [NotificationType.ProviderDisputeResolvedWon]: buildProviderDisputeEvent('resolvedWon'),
  [NotificationType.ProviderDisputeResolvedLost]: buildProviderDisputeEvent('resolvedLost'),
  // Provider — messaging / reviews / support
  [NotificationType.ProviderMessagingNewFromFamily]: buildProviderMessagingEvent('newFromFamily'),
  [NotificationType.ProviderMessagingUnanswered24h]: buildProviderMessagingEvent('unanswered24h'),
  [NotificationType.ProviderMessagingUnanswered48h]: buildProviderMessagingEvent('unanswered48h'),
  [NotificationType.ProviderReviewNew]: buildProviderReviewEvent('newReview'),
  [NotificationType.ProviderReviewResponsePublished]: buildProviderReviewEvent('responsePublished'),
  [NotificationType.ProviderReviewNotRespondedReminder]:
    buildProviderReviewEvent('notRespondedReminder'),
  [NotificationType.ProviderReviewRemoved]: buildProviderReviewEvent('reviewRemoved'),
  [NotificationType.ProviderSupportTicketReply]: buildProviderSupportEvent('ticketReply'),
  [NotificationType.ProviderSupportTicketStatusChanged]:
    buildProviderSupportEvent('ticketStatusChanged'),
  // Provider — pre-camp + operations + seasonal
  [NotificationType.ProviderPreCampRosterReady]: buildProviderPreCamp('rosterReady'),
  [NotificationType.ProviderPreCampChecklist]: buildProviderPreCamp('checklist'),
  [NotificationType.ProviderPreCampDayBefore]: buildProviderPreCamp('dayBefore'),
  [NotificationType.ProviderPostCampWrap]: buildProviderPreCamp('postCampWrap'),
  [NotificationType.ProviderSeasonEnded]: buildProviderOperationsNudge('seasonEnded'),
  [NotificationType.ProviderProgramsNotUpdated30d]:
    buildProviderOperationsNudge('programsNotUpdated30d'),
  [NotificationType.ProviderProgramsNotUpdated60d]:
    buildProviderOperationsNudge('programsNotUpdated60d'),
  // Superadmin — support tickets
  [NotificationType.SuperadminSupportTicketNew]: buildSuperadminSupportEvent('ticketNew'),
  [NotificationType.SuperadminSupportTicketReply]: buildSuperadminSupportEvent('ticketReply'),
  // Superadmin — onboarding
  [NotificationType.SuperadminCampApplicationNew]: buildSuperadminCampOnboarding('applicationNew'),
  [NotificationType.SuperadminVerificationDocsUploaded]:
    buildSuperadminCampOnboarding('docsUploaded'),
  [NotificationType.SuperadminVerificationDocsNotUploaded]:
    buildSuperadminCampOnboarding('docsNotUploaded'),
  [NotificationType.SuperadminCampProfileIncomplete14d]:
    buildSuperadminCampOnboarding('profileIncomplete14d'),
  [NotificationType.SuperadminCampFirstListingLive]:
    buildSuperadminCampOnboarding('firstListingLive'),
  // Superadmin — booking lifecycle
  [NotificationType.SuperadminBookingCancelledNonPayment]: buildSuperadminFinanceEvent(
    'bookingCancelledNonPayment'
  ),
  [NotificationType.SuperadminCampUnresponsiveExpiredRequests]: buildSuperadminCampHealth(
    'unresponsiveExpiredRequests'
  ),
  // Superadmin — payments / disputes
  [NotificationType.SuperadminDisputeFiled]: buildSuperadminFinanceEvent('disputeFiled'),
  [NotificationType.SuperadminDisputeResolved]: buildSuperadminFinanceEvent('disputeResolved'),
  [NotificationType.SuperadminPayoutRecoveryNeeded]:
    buildSuperadminFinanceEvent('payoutRecoveryNeeded'),
  [NotificationType.SuperadminFundsPendingTransfer]:
    buildSuperadminFinanceEvent('fundsPendingTransfer'),
  [NotificationType.SuperadminPaymentReviewNeeded]:
    buildSuperadminFinanceEvent('paymentReviewNeeded'),
  // Superadmin — platform health
  [NotificationType.SuperadminCampStripeDisconnected]:
    buildSuperadminCampHealth('stripeDisconnected'),
  [NotificationType.SuperadminCampDeletionRequested]:
    buildSuperadminCampHealth('deletionRequested'),
  // Superadmin — reviews
  [NotificationType.SuperadminReviewFlagged]: superadminReviewFlagged,
  // Superadmin — seasonal / profile
  [NotificationType.SuperadminCampProfileNeedsAttention60d]: buildSuperadminCampHealth(
    'profileNeedsAttention60d'
  ),
  [NotificationType.SuperadminCampProfileDeactivated]:
    buildSuperadminCampHealth('profileDeactivated'),
} as const

export type PropLoaderKey = keyof typeof propLoaders

export function getPropLoader(type: NotificationType): PropLoader<unknown> | undefined {
  return (propLoaders as Record<string, PropLoader<unknown>>)[type]
}
