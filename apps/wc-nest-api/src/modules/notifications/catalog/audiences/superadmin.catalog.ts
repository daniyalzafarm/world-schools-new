import {
  NotificationCategory,
  NotificationEntityType,
  NotificationType,
} from '@world-schools/wc-types'
import {
  SuperadminCampHealth,
  type SuperadminCampHealthKind,
  type SuperadminCampHealthProps,
  SuperadminCampOnboarding,
  type SuperadminCampOnboardingKind,
  type SuperadminCampOnboardingProps,
  SuperadminFinanceEvent,
  type SuperadminFinanceEventKind,
  type SuperadminFinanceEventProps,
  SuperadminReviewFlagged,
  type SuperadminReviewFlaggedProps,
  SuperadminSupportEvent,
  type SuperadminSupportEventKind,
  type SuperadminSupportEventProps,
} from '@world-schools/wc-email-templates'
import { propLoaders } from '../../resolvers/prop-loaders'
import type { CatalogEntry } from '../types'

/**
 * Superadmin-audience catalog entries (19 total).
 *
 * Single resolver — `allSuperadmins` — fans out to every superadmin user.
 * Per spec convention: providers + superadmins get `salutation: 'none'`.
 *
 * Build sequence:
 *  - Live commit points (12): support, onboarding application+docs+first-listing,
 *    booking lifecycle (cancelled-non-payment), payments/disputes (dispute filed,
 *    dispute resolved, payout failure, funds pending), Stripe-disconnected mirror.
 *  - Cron-driven (6): see `SuperadminEngagementCron` — daily for docs-not-uploaded,
 *    profile-incomplete-14d, profile-needs-attention-60d, profile-deactivated,
 *    payout-recovery-needed; weekly for unresponsive-expired-requests.
 *  - Parked (1): `SuperadminCampDeletionRequested` — needs a "request account
 *    deletion" domain endpoint (none today). Catalog entry + template + loader
 *    are wired so it fires the moment that domain feature lands.
 *
 * `SuperadminReviewFlagged` fires on every verified-review create (a
 * pragmatic interpretation — the schema has no "flag" status, so the most
 * useful trigger is per-submission so superadmin can spot-check). When a
 * dedicated flagging feature lands, narrow the resolver.
 */

// ============================================================================
// Support tickets (2)
// ============================================================================

function makeSupportEntry(
  type: NotificationType,
  templateKey: string,
  kind: SuperadminSupportEventKind,
  channels: ('in_app' | 'email')[]
): CatalogEntry<SuperadminSupportEventProps | null> {
  return {
    type,
    templateKey,
    audience: 'superadmin',
    category: NotificationCategory.Support,
    channels,
    salutation: 'none',
    resolver: 'allSuperadmins',
    transactional: false,
    trigger: 'live',
    loadProps: propLoaders[type] as never,
    email: channels.includes('email')
      ? {
          component: SuperadminSupportEvent as never,
          subject: props =>
            props
              ? kind === 'ticketNew'
                ? `New support ticket — ${props.ticketRef}`
                : `Reply on ${props.ticketRef}`
              : 'Support ticket update',
          includePlainText: true,
        }
      : undefined,
    inApp: {
      title: props =>
        props
          ? kind === 'ticketNew'
            ? `New support ticket: ${props.ticketRef}`
            : `Reply on ${props.ticketRef}`
          : 'Support ticket update',
      body: props => (props ? `${props.submitterName}: ${props.subject}` : ''),
      entityType: NotificationEntityType.SupportTicket,
      entityId: props => props?.ticketRef ?? '',
      redirectUrl: (_props, ctx) =>
        ctx.supportTicketId ? `/support/${ctx.supportTicketId}` : '/support',
      metadata: props =>
        props
          ? {
              ticketRef: props.ticketRef,
              submitterName: props.submitterName,
              submitterType: props.submitterType,
            }
          : {},
    },
  }
}

const superadminSupportTicketNew = makeSupportEntry(
  NotificationType.SuperadminSupportTicketNew,
  'superadmin.support.ticketNew',
  'ticketNew',
  ['in_app', 'email']
)
const superadminSupportTicketReply = makeSupportEntry(
  NotificationType.SuperadminSupportTicketReply,
  'superadmin.support.ticketReply',
  'ticketReply',
  ['in_app']
)

// ============================================================================
// Onboarding (5)
// ============================================================================

function makeOnboardingEntry(
  type: NotificationType,
  templateKey: string,
  kind: SuperadminCampOnboardingKind,
  channels: ('in_app' | 'email')[],
  trigger: 'live' | 'scheduled' = 'live'
): CatalogEntry<SuperadminCampOnboardingProps | null> {
  return {
    type,
    templateKey,
    audience: 'superadmin',
    category: NotificationCategory.Onboarding,
    channels,
    salutation: 'none',
    resolver: 'allSuperadmins',
    transactional: false,
    trigger,
    loadProps: propLoaders[type] as never,
    email: channels.includes('email')
      ? {
          component: SuperadminCampOnboarding as never,
          subject: props =>
            props
              ? kind === 'applicationNew'
                ? `New camp application — ${props.companyName}`
                : kind === 'docsUploaded'
                  ? `Verification docs ready — ${props.companyName}`
                  : kind === 'docsNotUploaded'
                    ? `Docs not uploaded — ${props.companyName}`
                    : kind === 'profileIncomplete14d'
                      ? `Profile still incomplete (14d) — ${props.companyName}`
                      : `New listing live — ${props.companyName}`
              : 'Camp onboarding update',
          includePlainText: true,
        }
      : undefined,
    inApp: {
      title: props =>
        props
          ? kind === 'applicationNew'
            ? `New application: ${props.companyName}`
            : kind === 'docsUploaded'
              ? `Verification docs uploaded: ${props.companyName}`
              : kind === 'docsNotUploaded'
                ? `Docs not uploaded: ${props.companyName}`
                : kind === 'profileIncomplete14d'
                  ? `Profile incomplete (14d): ${props.companyName}`
                  : `New listing live: ${props.companyName}`
          : 'Camp update',
      body: props => (props ? (props.country ?? '') : ''),
      entityType: NotificationEntityType.Camp,
      entityId: props => props?.companyName ?? '',
      // hardening: a loader that ever returns props without a
      // `reviewUrl` would otherwise crash here on `undefined.replace`.
      redirectUrl: props =>
        props?.reviewUrl ? props.reviewUrl.replace(/^https?:\/\/[^/]+/, '') : '/',
      metadata: props =>
        props
          ? {
              companyName: props.companyName,
              ...(props.country ? { country: props.country } : {}),
              ...(props.daysSinceApproval != null
                ? { daysSinceApproval: props.daysSinceApproval }
                : {}),
            }
          : {},
    },
  }
}

const superadminCampApplicationNew = makeOnboardingEntry(
  NotificationType.SuperadminCampApplicationNew,
  'superadmin.camp.applicationNew',
  'applicationNew',
  ['in_app', 'email']
)
const superadminVerificationDocsUploaded = makeOnboardingEntry(
  NotificationType.SuperadminVerificationDocsUploaded,
  'superadmin.camp.verificationDocsUploaded',
  'docsUploaded',
  ['in_app', 'email']
)
const superadminVerificationDocsNotUploaded = makeOnboardingEntry(
  NotificationType.SuperadminVerificationDocsNotUploaded,
  'superadmin.camp.verificationDocsNotUploaded',
  'docsNotUploaded',
  ['in_app', 'email'],
  'scheduled'
)
const superadminCampProfileIncomplete14d = makeOnboardingEntry(
  NotificationType.SuperadminCampProfileIncomplete14d,
  'superadmin.camp.profileIncomplete14d',
  'profileIncomplete14d',
  ['in_app', 'email'],
  'scheduled'
)
const superadminCampFirstListingLive = makeOnboardingEntry(
  NotificationType.SuperadminCampFirstListingLive,
  'superadmin.camp.firstListingLive',
  'firstListingLive',
  ['in_app']
)

// ============================================================================
// Booking lifecycle (2)
// ============================================================================

function makeCampHealthEntry(
  type: NotificationType,
  templateKey: string,
  kind: SuperadminCampHealthKind,
  category: NotificationCategory,
  channels: ('in_app' | 'email')[],
  trigger: 'live' | 'scheduled' = 'live'
): CatalogEntry<SuperadminCampHealthProps | null> {
  return {
    type,
    templateKey,
    audience: 'superadmin',
    category,
    channels,
    salutation: 'none',
    resolver: 'allSuperadmins',
    transactional: false,
    trigger,
    loadProps: propLoaders[type] as never,
    email: channels.includes('email')
      ? {
          component: SuperadminCampHealth as never,
          subject: props =>
            props
              ? kind === 'stripeDisconnected'
                ? `Stripe disconnected — ${props.companyName}`
                : kind === 'deletionRequested'
                  ? `Deletion requested — ${props.companyName}`
                  : kind === 'profileNeedsAttention60d'
                    ? `Profile needs attention (60d) — ${props.companyName}`
                    : kind === 'profileDeactivated'
                      ? `Profile deactivated (90d) — ${props.companyName}`
                      : `Camp unresponsive — ${props.companyName}`
              : 'Camp health update',
          includePlainText: true,
        }
      : undefined,
    inApp: {
      title: props =>
        props
          ? kind === 'stripeDisconnected'
            ? `Stripe disconnected: ${props.companyName}`
            : kind === 'deletionRequested'
              ? `Deletion requested: ${props.companyName}`
              : kind === 'profileNeedsAttention60d'
                ? `Profile needs attention: ${props.companyName}`
                : kind === 'profileDeactivated'
                  ? `Profile deactivated: ${props.companyName}`
                  : `Camp unresponsive: ${props.companyName}`
          : 'Camp health update',
      body: props => (props?.reason ? props.reason : ''),
      entityType: NotificationEntityType.Camp,
      entityId: props => props?.companyName ?? '',
      // hardening: a loader that ever returns props without a
      // `reviewUrl` would otherwise crash here on `undefined.replace`.
      redirectUrl: props =>
        props?.reviewUrl ? props.reviewUrl.replace(/^https?:\/\/[^/]+/, '') : '/',
      metadata: props =>
        props
          ? {
              companyName: props.companyName,
              ...(props.expiredRequestCount != null
                ? { expiredRequestCount: props.expiredRequestCount }
                : {}),
              ...(props.daysSinceLastSession != null
                ? { daysSinceLastSession: props.daysSinceLastSession }
                : {}),
              ...(props.reason ? { reason: props.reason } : {}),
            }
          : {},
    },
  }
}

const superadminCampUnresponsiveExpiredRequests = makeCampHealthEntry(
  NotificationType.SuperadminCampUnresponsiveExpiredRequests,
  'superadmin.camp.unresponsiveExpiredRequests',
  'unresponsiveExpiredRequests',
  NotificationCategory.Booking,
  ['in_app', 'email'],
  'scheduled'
)

// ============================================================================
// Payments / disputes (5) + booking-cancelled-non-payment (1)
// ============================================================================

function makeFinanceEntry(
  type: NotificationType,
  templateKey: string,
  kind: SuperadminFinanceEventKind,
  category: NotificationCategory,
  channels: ('in_app' | 'email')[]
): CatalogEntry<SuperadminFinanceEventProps | null> {
  return {
    type,
    templateKey,
    audience: 'superadmin',
    category,
    channels,
    salutation: 'none',
    resolver: 'allSuperadmins',
    transactional: true,
    trigger: 'live',
    loadProps: propLoaders[type] as never,
    email: channels.includes('email')
      ? {
          component: SuperadminFinanceEvent as never,
          subject: props =>
            props
              ? kind === 'disputeFiled'
                ? `Chargeback received — ${props.bookingRef ?? ''}`
                : kind === 'disputeResolved'
                  ? `Dispute resolved — ${props.bookingRef ?? ''}`
                  : kind === 'payoutFailure'
                    ? `Payout failure — ${props.companyName}`
                    : kind === 'payoutRecoveryNeeded'
                      ? `Clawback needs recovery — ${props.companyName}`
                      : kind === 'fundsPendingTransfer'
                        ? `Funds pending transfer — ${props.bookingRef ?? ''}`
                        : kind === 'paymentReviewNeeded'
                          ? `Payment review needed — ${props.bookingRef ?? ''}`
                          : `Booking cancelled (non-payment) — ${props.bookingRef ?? ''}`
              : 'Finance update',
          includePlainText: true,
        }
      : undefined,
    inApp: {
      title: props =>
        props
          ? kind === 'disputeFiled'
            ? `Chargeback: ${props.bookingRef ?? ''}`
            : kind === 'disputeResolved'
              ? `Dispute resolved: ${props.bookingRef ?? ''}`
              : kind === 'payoutFailure'
                ? `Payout failure: ${props.companyName}`
                : kind === 'payoutRecoveryNeeded'
                  ? `Clawback recovery: ${props.companyName}`
                  : kind === 'fundsPendingTransfer'
                    ? `Funds pending: ${props.bookingRef ?? ''}`
                    : kind === 'paymentReviewNeeded'
                      ? `Payment review: ${props.bookingRef ?? ''}`
                      : `Cancelled (non-payment): ${props.bookingRef ?? ''}`
          : 'Finance update',
      body: props =>
        props ? `${props.companyName}${props.amount ? ` · ${props.amount}` : ''}` : '',
      entityType:
        kind === 'disputeFiled' || kind === 'disputeResolved'
          ? NotificationEntityType.Dispute
          : kind === 'payoutFailure' || kind === 'fundsPendingTransfer'
            ? NotificationEntityType.Payout
            : kind === 'payoutRecoveryNeeded'
              ? NotificationEntityType.Reimbursement
              : NotificationEntityType.BookingGroup,
      entityId: props => props?.bookingRef ?? '',
      // hardening: a loader that ever returns props without a
      // `reviewUrl` would otherwise crash here on `undefined.replace`.
      redirectUrl: props =>
        props?.reviewUrl ? props.reviewUrl.replace(/^https?:\/\/[^/]+/, '') : '/',
      metadata: props =>
        props
          ? {
              companyName: props.companyName,
              ...(props.bookingRef ? { bookingRef: props.bookingRef } : {}),
              ...(props.amount ? { amount: props.amount } : {}),
              ...(props.reason ? { reason: props.reason } : {}),
              ...(props.outcome ? { outcome: props.outcome } : {}),
            }
          : {},
    },
  }
}

const superadminBookingCancelledNonPayment = makeFinanceEntry(
  NotificationType.SuperadminBookingCancelledNonPayment,
  'superadmin.booking.cancelledNonPayment',
  'bookingCancelledNonPayment',
  NotificationCategory.Booking,
  ['in_app', 'email']
)
const superadminDisputeFiled = makeFinanceEntry(
  NotificationType.SuperadminDisputeFiled,
  'superadmin.dispute.filed',
  'disputeFiled',
  NotificationCategory.Dispute,
  ['in_app', 'email']
)
const superadminDisputeResolved = makeFinanceEntry(
  NotificationType.SuperadminDisputeResolved,
  'superadmin.dispute.resolved',
  'disputeResolved',
  NotificationCategory.Dispute,
  ['in_app']
)
const superadminPayoutRecoveryNeeded = makeFinanceEntry(
  NotificationType.SuperadminPayoutRecoveryNeeded,
  'superadmin.payout.recoveryNeeded',
  'payoutRecoveryNeeded',
  NotificationCategory.Payout,
  ['in_app', 'email']
)
const superadminFundsPendingTransfer = makeFinanceEntry(
  NotificationType.SuperadminFundsPendingTransfer,
  'superadmin.payout.fundsPendingTransfer',
  'fundsPendingTransfer',
  NotificationCategory.Payout,
  ['in_app']
)
const superadminPaymentReviewNeeded = makeFinanceEntry(
  NotificationType.SuperadminPaymentReviewNeeded,
  'superadmin.payment.reviewNeeded',
  'paymentReviewNeeded',
  NotificationCategory.Payment,
  ['in_app', 'email']
)

// ============================================================================
// Platform health (2) + seasonal/profile (2)
// ============================================================================

const superadminCampStripeDisconnected = makeCampHealthEntry(
  NotificationType.SuperadminCampStripeDisconnected,
  'superadmin.camp.stripeDisconnected',
  'stripeDisconnected',
  NotificationCategory.System,
  ['in_app']
)
const superadminCampDeletionRequested = makeCampHealthEntry(
  NotificationType.SuperadminCampDeletionRequested,
  'superadmin.camp.deletionRequested',
  'deletionRequested',
  NotificationCategory.System,
  ['in_app', 'email']
)
const superadminCampProfileNeedsAttention60d = makeCampHealthEntry(
  NotificationType.SuperadminCampProfileNeedsAttention60d,
  'superadmin.camp.profileNeedsAttention60d',
  'profileNeedsAttention60d',
  NotificationCategory.Profile,
  ['in_app', 'email'],
  'scheduled'
)
const superadminCampProfileDeactivated = makeCampHealthEntry(
  NotificationType.SuperadminCampProfileDeactivated,
  'superadmin.camp.profileDeactivated',
  'profileDeactivated',
  NotificationCategory.Profile,
  ['in_app', 'email'],
  'scheduled'
)

// ============================================================================
// Reviews (1)
// ============================================================================

const superadminReviewFlagged: CatalogEntry<SuperadminReviewFlaggedProps | null> = {
  type: NotificationType.SuperadminReviewFlagged,
  templateKey: 'superadmin.review.flagged',
  audience: 'superadmin',
  category: NotificationCategory.Review,
  channels: ['in_app', 'email'],
  salutation: 'none',
  resolver: 'allSuperadmins',
  transactional: false,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.SuperadminReviewFlagged] as never,
  email: {
    component: SuperadminReviewFlagged as never,
    subject: props =>
      props ? `Review flagged — ${props.companyName}` : 'Review flagged for moderation',
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Review flagged: ${props.companyName}` : 'Review flagged'),
    body: props =>
      props ? `From ${props.parentName}${props.rating != null ? ` · ${props.rating}/5` : ''}` : '',
    entityType: NotificationEntityType.Review,
    entityId: () => '',
    redirectUrl: props => (props ? props.reviewUrl.replace(/^https?:\/\/[^/]+/, '') : '/'),
    metadata: props =>
      props
        ? {
            companyName: props.companyName,
            parentName: props.parentName,
            ...(props.rating != null ? { rating: props.rating } : {}),
          }
        : {},
  },
}

export const superadminCatalog: ReadonlyArray<CatalogEntry<unknown>> = [
  // Support tickets
  superadminSupportTicketNew as CatalogEntry<unknown>,
  superadminSupportTicketReply as CatalogEntry<unknown>,
  // Onboarding
  superadminCampApplicationNew as CatalogEntry<unknown>,
  superadminVerificationDocsUploaded as CatalogEntry<unknown>,
  superadminVerificationDocsNotUploaded as CatalogEntry<unknown>,
  superadminCampProfileIncomplete14d as CatalogEntry<unknown>,
  superadminCampFirstListingLive as CatalogEntry<unknown>,
  // Booking lifecycle
  superadminBookingCancelledNonPayment as CatalogEntry<unknown>,
  superadminCampUnresponsiveExpiredRequests as CatalogEntry<unknown>,
  // Payments / disputes
  superadminDisputeFiled as CatalogEntry<unknown>,
  superadminDisputeResolved as CatalogEntry<unknown>,
  superadminPayoutRecoveryNeeded as CatalogEntry<unknown>,
  superadminFundsPendingTransfer as CatalogEntry<unknown>,
  superadminPaymentReviewNeeded as CatalogEntry<unknown>,
  // Platform health
  superadminCampStripeDisconnected as CatalogEntry<unknown>,
  superadminCampDeletionRequested as CatalogEntry<unknown>,
  // Reviews
  superadminReviewFlagged as CatalogEntry<unknown>,
  // Seasonal / profile
  superadminCampProfileNeedsAttention60d as CatalogEntry<unknown>,
  superadminCampProfileDeactivated as CatalogEntry<unknown>,
]
