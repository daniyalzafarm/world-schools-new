import {
  NotificationCategory,
  NotificationEntityType,
  NotificationType,
} from '@world-schools/wc-types'
import {
  ProviderApplicationStatus,
  type ProviderApplicationStatusProps,
  ProviderBookingEvent,
  type ProviderBookingEventProps,
  ProviderDisputeEvent,
  type ProviderDisputeEventProps,
  ProviderMessagingEvent,
  type ProviderMessagingEventProps,
  ProviderOperationsNudge,
  type ProviderOperationsNudgeProps,
  ProviderPayoutEvent,
  type ProviderPayoutEventProps,
  ProviderPreCamp,
  type ProviderPreCampProps,
  ProviderProfileMilestone,
  type ProviderProfileMilestoneProps,
  ProviderRefundEvent,
  type ProviderRefundEventProps,
  ProviderReviewEvent,
  type ProviderReviewEventProps,
  ProviderStripeConnect,
  type ProviderStripeConnectProps,
  ProviderSupportEvent,
  type ProviderSupportEventProps,
} from '@world-schools/wc-email-templates'
import { propLoaders, type ProviderBookingInAppProps } from '../../resolvers/prop-loaders'
import type { CatalogEntry } from '../types'

/**
 * Provider-audience catalog entries (53 entries — within the spec's ~55
 * target; the small deficit is the parked-entries section below).
 *
 * Phase 5 cutover landed the three Booking-WebSocket-handler holdovers
 * (Accepted / Declined / RequestReceived). Phase 8 fills the rest in
 * domain batches: onboarding → booking lifecycle → payments/payouts →
 * refunds/disputes → messaging → reviews → pre-camp/operations → support.
 * Phase 8.5 wired the three audit-flagged orphans
 * (`ProviderReviewResponsePublished`, `ProviderConnectStripeNudge`,
 * `ProviderPayoutDelayed`).
 *
 * **Reserved-for-future-feature entries** (Phase 8 audit) — registered +
 * tested + loader-backed but no domain commit point today:
 *  - `ProviderBookingModified` — needs a modify-confirmed-booking flow.
 *  - `ProviderReviewRemoved` — needs an admin "remove published review"
 *    flow (today the schema only supports pre-publish moderation via
 *    `ReviewStatus.rejected`, which never fires for published reviews).
 *
 * Finance-flavoured triggers (payouts, refunds, disputes, reimbursements)
 * use the `providerOwnerForBooking` / `providerOwnerByProviderId`
 * resolvers (single recipient = camp owner) per the plan's "Open
 * decisions deferred to implementation" note. Everything booking-
 * lifecycle uses the full `allProviderUsers*` family.
 */

// ============================================================================
// Phase 5 cutover entries
// ============================================================================

const providerBookingAccepted: CatalogEntry<ProviderBookingInAppProps | null> = {
  type: NotificationType.ProviderBookingAccepted,
  templateKey: 'provider.booking.accepted',
  audience: 'provider',
  category: NotificationCategory.Booking,
  channels: ['in_app'],
  salutation: 'none',
  resolver: 'allProviderUsers',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ProviderBookingAccepted],
  inApp: {
    title: props =>
      props ? `You accepted booking ${props.bookingGroupNumber}` : 'Booking accepted',
    body: props => (props ? `Camp: ${props.campName}` : ''),
    entityType: NotificationEntityType.BookingGroup,
    entityId: props => (props ? props.bookingGroupId : ''),
    redirectUrl: () => '/bookings',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingGroupNumber, campName: props.campName } : {},
  },
}

const providerBookingDeclined: CatalogEntry<ProviderBookingInAppProps | null> = {
  type: NotificationType.ProviderBookingDeclined,
  templateKey: 'provider.booking.declined',
  audience: 'provider',
  category: NotificationCategory.Booking,
  channels: ['in_app'],
  salutation: 'none',
  resolver: 'allProviderUsers',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ProviderBookingDeclined],
  inApp: {
    title: props =>
      props ? `You declined booking ${props.bookingGroupNumber}` : 'Booking declined',
    body: props => (props ? `Camp: ${props.campName}` : ''),
    entityType: NotificationEntityType.BookingGroup,
    entityId: props => (props ? props.bookingGroupId : ''),
    redirectUrl: () => '/bookings',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingGroupNumber, campName: props.campName } : {},
  },
}

const providerBookingRequestReceived: CatalogEntry<ProviderBookingInAppProps | null> = {
  type: NotificationType.ProviderBookingRequestReceived,
  templateKey: 'provider.booking.requestReceived',
  audience: 'provider',
  category: NotificationCategory.Booking,
  channels: ['in_app'],
  salutation: 'none',
  resolver: 'allProviderUsers',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ProviderBookingRequestReceived],
  inApp: {
    title: props => (props ? `New booking request — ${props.campName}` : 'New booking request'),
    body: props =>
      props
        ? `Booking ${props.bookingGroupNumber} requires your response.`
        : 'A new booking request requires your response.',
    entityType: NotificationEntityType.BookingGroup,
    entityId: props => (props ? props.bookingGroupId : ''),
    redirectUrl: () => '/bookings',
    metadata: props =>
      props
        ? {
            bookingGroupNumber: props.bookingGroupNumber,
            campName: props.campName,
            requestExpiresAt: props.requestExpiresAt,
          }
        : {},
  },
}

// ============================================================================
// Phase 8a — Onboarding (11 entries)
// ============================================================================

function makeApplicationStatusEntry(
  type: NotificationType,
  templateKey: string,
  stage:
    | 'received'
    | 'approved'
    | 'declined'
    | 'documentReuploadRequested'
    | 'additionalInfoRequired',
  inAppTitle: (companyName: string) => string,
  inAppBody: (props: ProviderApplicationStatusProps) => string
): CatalogEntry<ProviderApplicationStatusProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category: NotificationCategory.Onboarding,
    channels: ['in_app', 'email'],
    salutation: 'none',
    resolver: 'providerOwnerByProviderId',
    transactional: true,
    trigger: 'live',
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderApplicationStatus as never,
      subject: props => (props ? inAppTitle(props.companyName) : 'Application update'),
      includePlainText: true,
    },
    inApp: {
      title: props => (props ? inAppTitle(props.companyName) : 'Application update'),
      body: props => (props ? inAppBody(props) : 'Your application has an update.'),
      entityType: undefined,
      entityId: () => '',
      redirectUrl: () => '/onboarding/status',
      metadata: props => (props ? { stage: props.stage } : {}),
    },
  }
}

const providerApplicationReceived = makeApplicationStatusEntry(
  NotificationType.ProviderApplicationReceived,
  'provider.application.received',
  'received',
  co => `Application received — ${co}`,
  () => 'We received your provider application. Expect a response within 3 business days.'
)
const providerApplicationApproved = makeApplicationStatusEntry(
  NotificationType.ProviderApplicationApproved,
  'provider.application.approved',
  'approved',
  co => `Application approved — ${co}`,
  () =>
    'Your application is approved. Continue onboarding (Stripe Connect, payment policies) to publish camps.'
)
const providerApplicationDeclined = makeApplicationStatusEntry(
  NotificationType.ProviderApplicationDeclined,
  'provider.application.declined',
  'declined',
  () => 'Application not approved',
  props => `Your application was not approved.${props.detail ? ` Reason: ${props.detail}` : ''}`
)
const providerDocumentReuploadRequested = makeApplicationStatusEntry(
  NotificationType.ProviderDocumentReuploadRequested,
  'provider.application.documentReuploadRequested',
  'documentReuploadRequested',
  () => 'Action needed: reupload a document',
  props => `Please reupload${props.detail ? `: ${props.detail}` : ' the requested document'}.`
)
const providerAdditionalInfoRequired = makeApplicationStatusEntry(
  NotificationType.ProviderAdditionalInfoRequired,
  'provider.application.additionalInfoRequired',
  'additionalInfoRequired',
  () => 'Action needed: additional information',
  props => `We need more information${props.detail ? `: ${props.detail}` : ' to finish review'}.`
)

function makeStripeConnectEntry(
  type: NotificationType,
  templateKey: string,
  stage: 'nudge' | 'reminder' | 'disconnected',
  inAppTitle: (companyName: string) => string,
  inAppBody: (props: ProviderStripeConnectProps) => string
): CatalogEntry<ProviderStripeConnectProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category: NotificationCategory.Onboarding,
    channels: ['in_app', 'email'],
    salutation: 'none',
    resolver: 'providerOwnerByProviderId',
    transactional: true,
    trigger: stage === 'reminder' ? 'scheduled' : 'live',
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderStripeConnect as never,
      subject: props => (props ? inAppTitle(props.companyName) : 'Stripe connection update'),
      includePlainText: true,
    },
    inApp: {
      title: props => (props ? inAppTitle(props.companyName) : 'Connect Stripe'),
      body: props => (props ? inAppBody(props) : 'Connect Stripe to accept bookings.'),
      entityType: undefined,
      entityId: () => '',
      redirectUrl: () => '/onboarding/stripe-connect',
      metadata: props => (props ? { stage: props.stage } : {}),
    },
  }
}

const providerConnectStripeNudge = makeStripeConnectEntry(
  NotificationType.ProviderConnectStripeNudge,
  'provider.onboarding.connectStripeNudge',
  'nudge',
  co => `Connect Stripe to publish — ${co}`,
  () => 'Your camp is approved but bookings stay blocked until Stripe is connected.'
)
const providerConnectStripeReminder = makeStripeConnectEntry(
  NotificationType.ProviderConnectStripeReminder,
  'provider.onboarding.connectStripeReminder',
  'reminder',
  co => `Reminder: connect Stripe — ${co}`,
  () => "Just a nudge — Stripe isn't connected yet. Connecting takes about 5 minutes."
)
const providerStripeDisconnected = makeStripeConnectEntry(
  NotificationType.ProviderStripeDisconnected,
  'provider.onboarding.stripeDisconnected',
  'disconnected',
  co => `Stripe disconnected — ${co}`,
  props =>
    `Your Stripe account has been disconnected${props.reason ? ` (${props.reason})` : ''}. New bookings will be blocked until you reconnect.`
)

function makeProfileMilestoneEntry(
  type: NotificationType,
  templateKey: string,
  stage: 'profileIncomplete' | 'profilePublished' | 'firstBooking',
  category: NotificationCategory,
  channels: ('in_app' | 'email')[],
  resolver: 'providerOwnerByProviderId' | 'providerOwnerForBooking',
  trigger: 'live' | 'scheduled',
  inAppTitle: (companyName: string) => string,
  inAppBody: (props: ProviderProfileMilestoneProps) => string
): CatalogEntry<ProviderProfileMilestoneProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category,
    channels,
    salutation: 'none',
    resolver,
    transactional: stage === 'firstBooking',
    trigger,
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderProfileMilestone as never,
      subject: props => (props ? inAppTitle(props.companyName) : 'Profile update'),
      includePlainText: true,
    },
    inApp: {
      title: props => (props ? inAppTitle(props.companyName) : 'Profile update'),
      body: props => (props ? inAppBody(props) : 'Profile update.'),
      entityType: undefined,
      entityId: () => '',
      redirectUrl: () => '/dashboard',
      metadata: props => (props ? { stage: props.stage } : {}),
    },
  }
}

const providerProfileIncomplete = makeProfileMilestoneEntry(
  NotificationType.ProviderProfileIncomplete,
  'provider.profile.incomplete',
  'profileIncomplete',
  NotificationCategory.Profile,
  ['email'],
  'providerOwnerByProviderId',
  'scheduled',
  co => `Finish your profile — ${co}`,
  props =>
    `Your profile is ${props.completionScore ?? 0}% complete. Filling the remaining sections helps families find and trust your camp.`
)
const providerProfilePublished = makeProfileMilestoneEntry(
  NotificationType.ProviderProfilePublished,
  'provider.profile.published',
  'profilePublished',
  NotificationCategory.Profile,
  ['in_app', 'email'],
  'providerOwnerByProviderId',
  'live',
  co => `Your profile is live — ${co}`,
  () => 'Families can now discover, wishlist, and request bookings.'
)
const providerFirstBooking = makeProfileMilestoneEntry(
  NotificationType.ProviderFirstBooking,
  'provider.booking.firstBooking',
  'firstBooking',
  NotificationCategory.Booking,
  ['in_app', 'email'],
  'providerOwnerForBooking',
  'live',
  co => `First booking request — ${co}`,
  () => 'Congratulations — your first booking request just arrived. Open the dashboard to respond.'
)

// ============================================================================
// Phase 8b — Booking lifecycle (10 new entries; 3 above from Phase 5)
// ============================================================================

function makeBookingEventEntry(
  type: NotificationType,
  templateKey: string,
  kind:
    | 'cancelledByFamily'
    | 'cancelledNonPayment'
    | 'requestWithdrawn'
    | 'modified'
    | 'request48hReminder'
    | 'requestFinalReminder'
    | 'requestExpired',
  channels: ('in_app' | 'email')[],
  trigger: 'live' | 'scheduled'
): CatalogEntry<ProviderBookingEventProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category: NotificationCategory.Booking,
    channels,
    salutation: 'none',
    resolver: 'allProviderUsersForBooking',
    transactional: true,
    trigger,
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderBookingEvent as never,
      subject: props => (props ? `Booking ${props.bookingRef}` : 'Booking update'),
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props ? `Booking ${props.bookingRef} — ${humanizeKind(kind)}` : 'Booking update',
      body: props => (props ? `Program: ${props.programName}` : ''),
      entityType: NotificationEntityType.BookingGroup,
      entityId: props => props?.bookingRef ?? '',
      redirectUrl: () => '/bookings',
      metadata: props =>
        props ? { bookingGroupNumber: props.bookingRef, programName: props.programName } : {},
    },
  }
}

function humanizeKind(
  kind:
    | 'cancelledByFamily'
    | 'cancelledNonPayment'
    | 'requestWithdrawn'
    | 'modified'
    | 'request48hReminder'
    | 'requestFinalReminder'
    | 'requestExpired'
): string {
  switch (kind) {
    case 'cancelledByFamily':
      return 'cancelled by family'
    case 'cancelledNonPayment':
      return 'cancelled — non-payment'
    case 'requestWithdrawn':
      return 'request withdrawn'
    case 'modified':
      return 'updated'
    case 'request48hReminder':
      return '48h response window'
    case 'requestFinalReminder':
      return 'final reminder'
    case 'requestExpired':
      return 'request expired'
  }
}

const providerBookingRequest48hReminder = makeBookingEventEntry(
  NotificationType.ProviderBookingRequest48hReminder,
  'provider.booking.request48hReminder',
  'request48hReminder',
  ['in_app', 'email'],
  'scheduled'
)
const providerBookingRequestFinalReminder = makeBookingEventEntry(
  NotificationType.ProviderBookingRequestFinalReminder,
  'provider.booking.requestFinalReminder',
  'requestFinalReminder',
  ['in_app', 'email'],
  'scheduled'
)
const providerBookingRequestExpired = makeBookingEventEntry(
  NotificationType.ProviderBookingRequestExpired,
  'provider.booking.requestExpired',
  'requestExpired',
  ['in_app', 'email'],
  'scheduled'
)
const providerBookingCancelledByFamily = makeBookingEventEntry(
  NotificationType.ProviderBookingCancelledByFamily,
  'provider.booking.cancelledByFamily',
  'cancelledByFamily',
  ['in_app', 'email'],
  'live'
)
const providerBookingCancelledNonPayment = makeBookingEventEntry(
  NotificationType.ProviderBookingCancelledNonPayment,
  'provider.booking.cancelledNonPayment',
  'cancelledNonPayment',
  ['in_app', 'email'],
  'live'
)
const providerBookingRequestWithdrawn = makeBookingEventEntry(
  NotificationType.ProviderBookingRequestWithdrawn,
  'provider.booking.requestWithdrawn',
  'requestWithdrawn',
  ['in_app'],
  'live'
)
const providerBookingModified = makeBookingEventEntry(
  NotificationType.ProviderBookingModified,
  'provider.booking.modified',
  'modified',
  ['in_app', 'email'],
  'live'
)

// ============================================================================
// Phase 8c — Payments + payouts (6 entries)
// ============================================================================

function makePayoutEventEntry(
  type: NotificationType,
  templateKey: string,
  kind: 'scheduleConfirmed' | 'balanceCollected' | 'reminder' | 'released' | 'failed' | 'delayed',
  channels: ('in_app' | 'email')[],
  trigger: 'live' | 'scheduled',
  category: NotificationCategory = NotificationCategory.Payout
): CatalogEntry<ProviderPayoutEventProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category,
    channels,
    salutation: 'none',
    resolver:
      kind === 'reminder' || kind === 'released' || kind === 'failed' || kind === 'delayed'
        ? 'providerOwnerByProviderId'
        : 'providerOwnerForBooking',
    transactional: true,
    trigger,
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderPayoutEvent as never,
      subject: props =>
        props
          ? kind === 'released'
            ? `Payout released — ${props.amount}`
            : kind === 'failed'
              ? 'Payout failed'
              : kind === 'delayed'
                ? 'Payout delayed'
                : kind === 'reminder'
                  ? `Upcoming payout — ${props.amount}`
                  : kind === 'balanceCollected'
                    ? `Balance collected — ${props.amount}`
                    : `Payout schedule confirmed`
          : 'Payout update',
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props
          ? kind === 'released'
            ? `Payout released: ${props.amount}`
            : kind === 'failed'
              ? `Payout failed: ${props.amount}`
              : kind === 'delayed'
                ? `Payout delayed: ${props.amount}`
                : kind === 'reminder'
                  ? `Upcoming payout: ${props.amount}`
                  : kind === 'balanceCollected'
                    ? `Balance collected: ${props.amount}`
                    : 'Payout schedule confirmed'
          : 'Payout update',
      body: props =>
        props ? (props.bookingRef ? `Booking ${props.bookingRef}.` : (props.whenLabel ?? '')) : '',
      entityType: NotificationEntityType.Payout,
      entityId: props => props?.bookingRef ?? '',
      redirectUrl: () => '/dashboard',
      metadata: props =>
        props
          ? {
              bookingGroupNumber: props.bookingRef ?? null,
              amount: props.amount,
              ...(props.reason ? { reason: props.reason } : {}),
            }
          : {},
    },
  }
}

const providerPayoutScheduleConfirmed = makePayoutEventEntry(
  NotificationType.ProviderPayoutScheduleConfirmed,
  'provider.payouts.scheduleConfirmed',
  'scheduleConfirmed',
  ['in_app', 'email'],
  'live'
)
const providerBalanceCollected = makePayoutEventEntry(
  NotificationType.ProviderBalanceCollected,
  'provider.payments.balanceCollected',
  'balanceCollected',
  ['in_app', 'email'],
  'live',
  NotificationCategory.Payment
)
const providerPayoutReminder = makePayoutEventEntry(
  NotificationType.ProviderPayoutReminder,
  'provider.payouts.reminder',
  'reminder',
  ['email'],
  'scheduled'
)
const providerPayoutReleased = makePayoutEventEntry(
  NotificationType.ProviderPayoutReleased,
  'provider.payouts.released',
  'released',
  ['in_app', 'email'],
  'live'
)
const providerPayoutFailed = makePayoutEventEntry(
  NotificationType.ProviderPayoutFailed,
  'provider.payouts.failed',
  'failed',
  ['in_app', 'email'],
  'live'
)
const providerPayoutDelayed = makePayoutEventEntry(
  NotificationType.ProviderPayoutDelayed,
  'provider.payouts.delayed',
  'delayed',
  ['in_app', 'email'],
  'live'
)

// ============================================================================
// Phase 8d — Refunds + disputes (7 entries)
// ============================================================================

function makeRefundEventEntry(
  type: NotificationType,
  templateKey: string,
  kind: 'issued' | 'failed' | 'reimbursementOwed',
  channels: ('in_app' | 'email')[]
): CatalogEntry<ProviderRefundEventProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category: NotificationCategory.Refund,
    channels,
    salutation: 'none',
    resolver: 'providerOwnerForBooking',
    transactional: true,
    trigger: 'live',
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderRefundEvent as never,
      subject: props =>
        props
          ? kind === 'issued'
            ? `Refund issued — ${props.amount}`
            : kind === 'failed'
              ? `Refund failed — booking ${props.bookingRef}`
              : `Reimbursement owed — ${props.amount}`
          : 'Refund update',
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props
          ? kind === 'issued'
            ? `Refund issued: ${props.amount}`
            : kind === 'failed'
              ? `Refund failed: ${props.bookingRef}`
              : `Reimbursement owed: ${props.amount}`
          : 'Refund update',
      body: props => (props ? `Booking ${props.bookingRef}.` : ''),
      entityType: NotificationEntityType.Refund,
      entityId: props => props?.bookingRef ?? '',
      redirectUrl: () => '/dashboard',
      metadata: props =>
        props ? { bookingGroupNumber: props.bookingRef, amount: props.amount } : {},
    },
  }
}

const providerRefundIssued = makeRefundEventEntry(
  NotificationType.ProviderRefundIssued,
  'provider.refund.issued',
  'issued',
  ['in_app', 'email']
)
const providerRefundFailed = makeRefundEventEntry(
  NotificationType.ProviderRefundFailed,
  'provider.refund.failed',
  'failed',
  ['in_app', 'email']
)
const providerReimbursementOwed = makeRefundEventEntry(
  NotificationType.ProviderReimbursementOwed,
  'provider.reimbursement.owed',
  'reimbursementOwed',
  ['in_app', 'email']
)

function makeDisputeEventEntry(
  type: NotificationType,
  templateKey: string,
  kind: 'opened' | 'evidenceDue' | 'resolvedWon' | 'resolvedLost',
  channels: ('in_app' | 'email')[],
  trigger: 'live' | 'scheduled'
): CatalogEntry<ProviderDisputeEventProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category: NotificationCategory.Dispute,
    channels,
    salutation: 'none',
    resolver: 'providerOwnerForBooking',
    transactional: true,
    trigger,
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderDisputeEvent as never,
      subject: props =>
        props
          ? kind === 'opened'
            ? `Chargeback opened — ${props.amount}`
            : kind === 'evidenceDue'
              ? `Chargeback evidence due ${props.evidenceDueLabel ?? 'soon'}`
              : kind === 'resolvedWon'
                ? `Chargeback won — booking ${props.bookingRef}`
                : `Chargeback lost — booking ${props.bookingRef}`
          : 'Dispute update',
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props
          ? kind === 'opened'
            ? `Chargeback opened: ${props.amount}`
            : kind === 'evidenceDue'
              ? `Evidence due: ${props.evidenceDueLabel ?? 'soon'}`
              : kind === 'resolvedWon'
                ? `Chargeback won: booking ${props.bookingRef}`
                : `Chargeback lost: booking ${props.bookingRef}`
          : 'Dispute update',
      body: props => (props ? `Booking ${props.bookingRef}.` : ''),
      entityType: NotificationEntityType.Dispute,
      entityId: props => props?.bookingRef ?? '',
      redirectUrl: () => '/dashboard',
      metadata: props =>
        props
          ? {
              bookingGroupNumber: props.bookingRef,
              amount: props.amount,
              evidenceDueLabel: props.evidenceDueLabel ?? null,
            }
          : {},
    },
  }
}

const providerDisputeOpened = makeDisputeEventEntry(
  NotificationType.ProviderDisputeOpened,
  'provider.dispute.opened',
  'opened',
  ['in_app', 'email'],
  'live'
)
const providerDisputeEvidenceDue = makeDisputeEventEntry(
  NotificationType.ProviderDisputeEvidenceDue,
  'provider.dispute.evidenceDue',
  'evidenceDue',
  ['email'],
  'scheduled'
)
const providerDisputeResolvedWon = makeDisputeEventEntry(
  NotificationType.ProviderDisputeResolvedWon,
  'provider.dispute.resolvedWon',
  'resolvedWon',
  ['in_app', 'email'],
  'live'
)
const providerDisputeResolvedLost = makeDisputeEventEntry(
  NotificationType.ProviderDisputeResolvedLost,
  'provider.dispute.resolvedLost',
  'resolvedLost',
  ['in_app', 'email'],
  'live'
)

// ============================================================================
// Phase 8e — Messaging (3 entries)
// ============================================================================

function makeMessagingEntry(
  type: NotificationType,
  templateKey: string,
  kind: 'newFromFamily' | 'unanswered24h' | 'unanswered48h',
  channels: ('in_app' | 'email')[],
  trigger: 'live' | 'scheduled'
): CatalogEntry<ProviderMessagingEventProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category: NotificationCategory.Message,
    channels,
    salutation: 'none',
    resolver: 'allProviderUsers',
    transactional: false,
    trigger,
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderMessagingEvent as never,
      subject: props =>
        props
          ? kind === 'newFromFamily'
            ? `New message from ${props.parentDisplay}`
            : kind === 'unanswered24h'
              ? `Message unanswered 24h — ${props.parentDisplay}`
              : `Message unanswered 48h — ${props.parentDisplay}`
          : 'Message update',
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props
          ? kind === 'newFromFamily'
            ? `New message from ${props.parentDisplay}`
            : kind === 'unanswered24h'
              ? `Reply pending: ${props.parentDisplay}`
              : `Reply overdue: ${props.parentDisplay}`
          : 'Message update',
      body: props => props?.preview ?? '',
      entityType: NotificationEntityType.Message,
      entityId: () => '',
      redirectUrl: () => '/messages',
      metadata: props => (props ? { parentDisplay: props.parentDisplay } : {}),
    },
  }
}

const providerMessagingNewFromFamily = makeMessagingEntry(
  NotificationType.ProviderMessagingNewFromFamily,
  'provider.messaging.newFromFamily',
  'newFromFamily',
  ['in_app', 'email'],
  'live'
)
const providerMessagingUnanswered24h = makeMessagingEntry(
  NotificationType.ProviderMessagingUnanswered24h,
  'provider.messaging.unanswered24h',
  'unanswered24h',
  ['email'],
  'scheduled'
)
const providerMessagingUnanswered48h = makeMessagingEntry(
  NotificationType.ProviderMessagingUnanswered48h,
  'provider.messaging.unanswered48h',
  'unanswered48h',
  ['email'],
  'scheduled'
)

// ============================================================================
// Phase 8f — Reviews (4 entries)
// ============================================================================

function makeReviewEntry(
  type: NotificationType,
  templateKey: string,
  kind: 'newReview' | 'responsePublished' | 'notRespondedReminder' | 'reviewRemoved',
  channels: ('in_app' | 'email')[],
  trigger: 'live' | 'scheduled'
): CatalogEntry<ProviderReviewEventProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category: NotificationCategory.Review,
    channels,
    salutation: 'none',
    resolver: 'allProviderUsersForReview',
    transactional: kind === 'reviewRemoved',
    trigger,
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderReviewEvent as never,
      subject: props =>
        props
          ? kind === 'newReview'
            ? `New review for ${props.campName}`
            : kind === 'responsePublished'
              ? `Your reply is live — ${props.campName}`
              : kind === 'notRespondedReminder'
                ? `Respond to a review — ${props.campName}`
                : `Review removed — ${props.campName}`
          : 'Review update',
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props
          ? kind === 'newReview'
            ? `New review: ${props.campName}`
            : kind === 'responsePublished'
              ? `Reply published: ${props.campName}`
              : kind === 'notRespondedReminder'
                ? `Respond to a review: ${props.campName}`
                : `Review removed: ${props.campName}`
          : 'Review update',
      body: props => props?.preview ?? '',
      entityType: NotificationEntityType.Review,
      entityId: () => '',
      redirectUrl: () => '/dashboard',
      metadata: props =>
        props
          ? { campName: props.campName, ...(props.rating ? { rating: props.rating } : {}) }
          : {},
    },
  }
}

const providerReviewNew = makeReviewEntry(
  NotificationType.ProviderReviewNew,
  'provider.review.new',
  'newReview',
  ['in_app', 'email'],
  'live'
)
const providerReviewResponsePublished = makeReviewEntry(
  NotificationType.ProviderReviewResponsePublished,
  'provider.review.responsePublished',
  'responsePublished',
  ['in_app'],
  'live'
)
const providerReviewNotRespondedReminder = makeReviewEntry(
  NotificationType.ProviderReviewNotRespondedReminder,
  'provider.review.notRespondedReminder',
  'notRespondedReminder',
  ['email'],
  'scheduled'
)
const providerReviewRemoved = makeReviewEntry(
  NotificationType.ProviderReviewRemoved,
  'provider.review.removed',
  'reviewRemoved',
  ['in_app', 'email'],
  'live'
)

// ============================================================================
// Phase 8g — Pre-camp + operations + seasonal (7 entries)
// ============================================================================

function makePreCampEntry(
  type: NotificationType,
  templateKey: string,
  stage: 'rosterReady' | 'checklist' | 'dayBefore' | 'postCampWrap'
): CatalogEntry<ProviderPreCampProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category: NotificationCategory.Booking,
    channels: ['email'],
    salutation: 'none',
    resolver: 'allProviderUsersForCamp',
    transactional: false,
    trigger: 'scheduled',
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderPreCamp as never,
      subject: props =>
        props
          ? stage === 'rosterReady'
            ? `Roster ready — ${props.campName}`
            : stage === 'checklist'
              ? `Two weeks to go — ${props.campName}`
              : stage === 'dayBefore'
                ? `Camp starts tomorrow — ${props.campName}`
                : `Camp wrap — ${props.campName}`
          : 'Pre-camp update',
      includePlainText: true,
    },
  }
}

const providerPreCampRosterReady = makePreCampEntry(
  NotificationType.ProviderPreCampRosterReady,
  'provider.preCamp.rosterReady',
  'rosterReady'
)
const providerPreCampChecklist = makePreCampEntry(
  NotificationType.ProviderPreCampChecklist,
  'provider.preCamp.checklist',
  'checklist'
)
const providerPreCampDayBefore = makePreCampEntry(
  NotificationType.ProviderPreCampDayBefore,
  'provider.preCamp.dayBefore',
  'dayBefore'
)
const providerPostCampWrap = makePreCampEntry(
  NotificationType.ProviderPostCampWrap,
  'provider.postCamp.wrap',
  'postCampWrap'
)

function makeOperationsNudgeEntry(
  type: NotificationType,
  templateKey: string,
  kind: 'seasonEnded' | 'programsNotUpdated30d' | 'programsNotUpdated60d'
): CatalogEntry<ProviderOperationsNudgeProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category: NotificationCategory.System,
    channels: ['email'],
    salutation: 'none',
    resolver: 'providerOwnerByProviderId',
    transactional: false,
    trigger: 'scheduled',
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderOperationsNudge as never,
      subject: props =>
        props
          ? kind === 'seasonEnded'
            ? `Season wrapped — ${props.companyName}`
            : kind === 'programsNotUpdated30d'
              ? `Programs not updated 30d — ${props.companyName}`
              : `Programs not updated 60d — ${props.companyName}`
          : 'Operations update',
      includePlainText: true,
    },
  }
}

const providerSeasonEnded = makeOperationsNudgeEntry(
  NotificationType.ProviderSeasonEnded,
  'provider.season.ended',
  'seasonEnded'
)
const providerProgramsNotUpdated30d = makeOperationsNudgeEntry(
  NotificationType.ProviderProgramsNotUpdated30d,
  'provider.programs.notUpdated30d',
  'programsNotUpdated30d'
)
const providerProgramsNotUpdated60d = makeOperationsNudgeEntry(
  NotificationType.ProviderProgramsNotUpdated60d,
  'provider.programs.notUpdated60d',
  'programsNotUpdated60d'
)

// ============================================================================
// Phase 8h — Support (2 entries)
// ============================================================================

function makeSupportEventEntry(
  type: NotificationType,
  templateKey: string,
  kind: 'ticketReply' | 'ticketStatusChanged'
): CatalogEntry<ProviderSupportEventProps | null> {
  return {
    type,
    templateKey,
    audience: 'provider',
    category: NotificationCategory.Support,
    channels: ['in_app', 'email'],
    salutation: 'none',
    resolver: 'providerUserForSupportTicket',
    transactional: true,
    trigger: 'live',
    loadProps: propLoaders[type] as never,
    email: {
      component: ProviderSupportEvent as never,
      subject: props =>
        props
          ? kind === 'ticketReply'
            ? `Support reply — ${props.ticketSubject}`
            : `Ticket ${props.detail.toLowerCase()} — ${props.ticketSubject}`
          : 'Support update',
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props
          ? kind === 'ticketReply'
            ? `Support reply: ${props.ticketSubject}`
            : `Ticket ${props.detail.toLowerCase()}: ${props.ticketSubject}`
          : 'Support update',
      body: props => props?.detail ?? '',
      entityType: NotificationEntityType.SupportTicket,
      entityId: props => props?.ticketRef ?? '',
      redirectUrl: (_props, ctx) =>
        ctx.supportTicketId ? `/support/tickets/${ctx.supportTicketId}` : '/support/tickets',
      metadata: props => (props ? { ticketSubject: props.ticketSubject } : {}),
    },
  }
}

const providerSupportTicketReply = makeSupportEventEntry(
  NotificationType.ProviderSupportTicketReply,
  'provider.support.ticketReply',
  'ticketReply'
)
const providerSupportTicketStatusChanged = makeSupportEventEntry(
  NotificationType.ProviderSupportTicketStatusChanged,
  'provider.support.ticketStatusChanged',
  'ticketStatusChanged'
)

// ============================================================================
// Export
// ============================================================================

export const providerCatalog: ReadonlyArray<CatalogEntry<unknown>> = [
  // Phase 5 cutover
  providerBookingAccepted as unknown as CatalogEntry<unknown>,
  providerBookingDeclined as unknown as CatalogEntry<unknown>,
  providerBookingRequestReceived as unknown as CatalogEntry<unknown>,
  // Phase 8a — onboarding
  providerApplicationReceived as unknown as CatalogEntry<unknown>,
  providerApplicationApproved as unknown as CatalogEntry<unknown>,
  providerApplicationDeclined as unknown as CatalogEntry<unknown>,
  providerDocumentReuploadRequested as unknown as CatalogEntry<unknown>,
  providerAdditionalInfoRequired as unknown as CatalogEntry<unknown>,
  providerConnectStripeNudge as unknown as CatalogEntry<unknown>,
  providerConnectStripeReminder as unknown as CatalogEntry<unknown>,
  providerStripeDisconnected as unknown as CatalogEntry<unknown>,
  providerProfileIncomplete as unknown as CatalogEntry<unknown>,
  providerProfilePublished as unknown as CatalogEntry<unknown>,
  providerFirstBooking as unknown as CatalogEntry<unknown>,
  // Phase 8b — booking lifecycle
  providerBookingRequest48hReminder as unknown as CatalogEntry<unknown>,
  providerBookingRequestFinalReminder as unknown as CatalogEntry<unknown>,
  providerBookingRequestExpired as unknown as CatalogEntry<unknown>,
  providerBookingCancelledByFamily as unknown as CatalogEntry<unknown>,
  providerBookingCancelledNonPayment as unknown as CatalogEntry<unknown>,
  providerBookingRequestWithdrawn as unknown as CatalogEntry<unknown>,
  providerBookingModified as unknown as CatalogEntry<unknown>,
  // Phase 8c — payments + payouts
  providerPayoutScheduleConfirmed as unknown as CatalogEntry<unknown>,
  providerBalanceCollected as unknown as CatalogEntry<unknown>,
  providerPayoutReminder as unknown as CatalogEntry<unknown>,
  providerPayoutReleased as unknown as CatalogEntry<unknown>,
  providerPayoutFailed as unknown as CatalogEntry<unknown>,
  providerPayoutDelayed as unknown as CatalogEntry<unknown>,
  // Phase 8d — refunds + disputes
  providerRefundIssued as unknown as CatalogEntry<unknown>,
  providerRefundFailed as unknown as CatalogEntry<unknown>,
  providerReimbursementOwed as unknown as CatalogEntry<unknown>,
  providerDisputeOpened as unknown as CatalogEntry<unknown>,
  providerDisputeEvidenceDue as unknown as CatalogEntry<unknown>,
  providerDisputeResolvedWon as unknown as CatalogEntry<unknown>,
  providerDisputeResolvedLost as unknown as CatalogEntry<unknown>,
  // Phase 8e — messaging
  providerMessagingNewFromFamily as unknown as CatalogEntry<unknown>,
  providerMessagingUnanswered24h as unknown as CatalogEntry<unknown>,
  providerMessagingUnanswered48h as unknown as CatalogEntry<unknown>,
  // Phase 8f — reviews
  providerReviewNew as unknown as CatalogEntry<unknown>,
  providerReviewResponsePublished as unknown as CatalogEntry<unknown>,
  providerReviewNotRespondedReminder as unknown as CatalogEntry<unknown>,
  providerReviewRemoved as unknown as CatalogEntry<unknown>,
  // Phase 8g — pre-camp + operations + seasonal
  providerPreCampRosterReady as unknown as CatalogEntry<unknown>,
  providerPreCampChecklist as unknown as CatalogEntry<unknown>,
  providerPreCampDayBefore as unknown as CatalogEntry<unknown>,
  providerPostCampWrap as unknown as CatalogEntry<unknown>,
  providerSeasonEnded as unknown as CatalogEntry<unknown>,
  providerProgramsNotUpdated30d as unknown as CatalogEntry<unknown>,
  providerProgramsNotUpdated60d as unknown as CatalogEntry<unknown>,
  // Phase 8h — support
  providerSupportTicketReply as unknown as CatalogEntry<unknown>,
  providerSupportTicketStatusChanged as unknown as CatalogEntry<unknown>,
]
