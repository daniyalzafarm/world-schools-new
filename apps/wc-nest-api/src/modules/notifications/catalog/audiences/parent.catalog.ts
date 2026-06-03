import {
  NotificationCategory,
  NotificationEntityType,
  NotificationType,
} from '@world-schools/wc-types'
import {
  ParentBookingAccepted,
  type ParentBookingAcceptedProps,
  ParentBookingCancelled,
  type ParentBookingCancelledProps,
  ParentBookingDeclined,
  type ParentBookingDeclinedProps,
  ParentBookingModified,
  type ParentBookingModifiedProps,
  ParentBookingRequestSubmitted,
  type ParentBookingRequestSubmittedProps,
  ParentBookingRequestWithdrawn,
  type ParentBookingRequestWithdrawnProps,
  ParentCheckoutAbandoned,
  type ParentCheckoutAbandonedProps,
  ParentDisputeOpened,
  type ParentDisputeOpenedProps,
  ParentDisputeResolved,
  type ParentDisputeResolvedProps,
  ParentMessagingNewFromCamp,
  type ParentMessagingNewFromCampProps,
  ParentPaymentBalanceCharged,
  type ParentPaymentBalanceChargedProps,
  ParentPaymentBalanceFailed,
  type ParentPaymentBalanceFailedProps,
  ParentPaymentBalanceReminder,
  type ParentPaymentBalanceReminderProps,
  ParentPaymentCancelledNonPayment,
  type ParentPaymentCancelledNonPaymentProps,
  ParentPaymentDepositConfirmed,
  type ParentPaymentDepositConfirmedProps,
  ParentPostCampReview,
  type ParentPostCampReviewProps,
  ParentPostDeclineAlternatives,
  type ParentPostDeclineAlternativesProps,
  ParentPreCamp,
  type ParentPreCampProps,
  ParentProfileIncomplete,
  type ParentProfileIncompleteProps,
  ParentRefundFailed,
  type ParentRefundFailedProps,
  ParentRefundIssued,
  type ParentRefundIssuedProps,
  ParentReviewRemoved,
  type ParentReviewRemovedProps,
  ParentReviewResponsePublished,
  type ParentReviewResponsePublishedProps,
  ParentSupportTicketReply,
  type ParentSupportTicketReplyProps,
  ParentSupportTicketStatusChanged,
  type ParentSupportTicketStatusChangedProps,
  ParentWishlistEmpty,
  type ParentWishlistEmptyProps,
  ParentWishlistEvent,
  type ParentWishlistEventProps,
  ParentWishlistItemsNoBooking,
  type ParentWishlistItemsNoBookingProps,
} from '@world-schools/wc-email-templates'
import { propLoaders } from '../../resolvers/prop-loaders'
import type { CatalogEntry } from '../types'

/**
 * Parent-audience catalog entries (52 total per v28 spec).
 *
 * Phase 4 lands the proof-of-concept entry (Parent_Booking_Accepted) so
 * the full dispatcher → worker → render → send loop can be exercised
 * end-to-end. Subsequent phases append entries in domain batches:
 * booking → payment → refund/dispute → wishlist → reminder.
 *
 * **Reserved-for-future-feature entries** (Phase 7.5 audit): the catalog
 * entries below are registered + tested + loader-backed, but won't fire
 * today because the domain commit point they listen for doesn't exist yet.
 * Listed here so Phase 8 / future feature work knows the wiring is ready:
 *  - `ParentBookingModified` — needs a modify-confirmed-booking flow.
 *  - `ParentWishlistPriceDrop` — needs session-price-change detection.
 *  - `ParentWishlistFillingUp` — needs capacity-threshold scanner.
 *  - `ParentWishlistDeadlineApproaching` — needs booking-deadline scanner.
 *  - `ParentWishlistEarlyBirdIncrease` — needs early-bird price scanner.
 *  - `ParentReviewRemoved` — needs an admin "remove published review"
 *    flow (today the schema only supports pre-publish moderation via
 *    `ReviewStatus.rejected`, which never fires for published reviews).
 */

const parentBookingAccepted: CatalogEntry<ParentBookingAcceptedProps | null> = {
  type: NotificationType.ParentBookingAccepted,
  templateKey: 'parent.booking.accepted',
  audience: 'parent',
  category: NotificationCategory.Booking,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentBookingAccepted],

  email: {
    component: ParentBookingAccepted as never,
    subject: props =>
      props ? `Your booking at ${props.campName} is confirmed` : 'Booking confirmed',
    includePlainText: true,
  },

  inApp: {
    title: props => (props ? `Booking confirmed — ${props.campName}` : 'Booking confirmed'),
    body: props =>
      props
        ? `Your booking for ${props.childName} at ${props.campName} is confirmed. Deposit of ${props.depositPaid} received; balance of ${props.balanceAmount} due on ${props.balanceDueDate}.`
        : 'Your booking is confirmed.',
    entityType: NotificationEntityType.BookingGroup,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: (_props, ctx) =>
      ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
    // Extra fields the parent app's notification list reads for display
    // (campName for the title, bookingGroupNumber for the reference badge).
    // Matches what the legacy BookingWebSocketHandler used to populate so
    // frontends don't regress at Phase 5 cutover.
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
  },
}

const parentBookingDeclined: CatalogEntry<ParentBookingDeclinedProps | null> = {
  type: NotificationType.ParentBookingDeclined,
  templateKey: 'parent.booking.declined',
  audience: 'parent',
  category: NotificationCategory.Booking,
  channels: ['in_app', 'email'],
  // Per spec `Notes & Conventions`: parent financial-distress + dispute
  // notifications use the formal 'Dear' salutation. Decline is logistical,
  // not financial — the spec lists it under standard 'Hi'.
  salutation: 'hi',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentBookingDeclined],

  email: {
    component: ParentBookingDeclined as never,
    subject: props =>
      props
        ? `Your booking request for ${props.campName} wasn't confirmed`
        : 'Booking request not confirmed',
    includePlainText: true,
  },

  inApp: {
    title: props => (props ? `Booking declined — ${props.campName}` : 'Booking declined'),
    body: props => {
      if (!props) return 'Your booking request was declined.'
      const range = props.sessionRange ? ` on ${props.sessionRange}` : ''
      const reason = props.declineReason ? ` Reason: ${props.declineReason}.` : ''
      return `Your booking request for ${props.campName}${range} was declined. No charge has been made.${reason}`
    },
    entityType: NotificationEntityType.BookingGroup,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: (_props, ctx) =>
      ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
  },
}

const parentBookingRequestStillPending: CatalogEntry<ParentBookingRequestSubmittedProps | null> = {
  type: NotificationType.ParentBookingRequestStillPending,
  templateKey: 'parent.booking.requestStillPending',
  audience: 'parent',
  category: NotificationCategory.Booking,
  channels: ['in_app'],
  salutation: 'hi',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'scheduled',
  loadProps: propLoaders[NotificationType.ParentBookingRequestStillPending],
  inApp: {
    title: props => (props ? `Still waiting — ${props.campName}` : 'Booking request still pending'),
    body: props =>
      props
        ? `Your booking request for ${props.campName} is still awaiting a response. The camp has 24 more hours to confirm.`
        : 'The camp has 24 more hours to confirm your request.',
    entityType: NotificationEntityType.BookingGroup,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: (_props, ctx) =>
      ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
  },
}

const parentBookingExpired: CatalogEntry<ParentBookingRequestSubmittedProps | null> = {
  type: NotificationType.ParentBookingExpired,
  templateKey: 'parent.booking.expired',
  audience: 'parent',
  category: NotificationCategory.Booking,
  channels: ['in_app'],
  salutation: 'hi',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'scheduled',
  loadProps: propLoaders[NotificationType.ParentBookingExpired],
  inApp: {
    title: props => (props ? `Request expired — ${props.campName}` : 'Booking request expired'),
    body: props =>
      props
        ? `Your booking request for ${props.campName} expired without a response. You have not been charged.`
        : 'Your booking request expired.',
    entityType: NotificationEntityType.BookingGroup,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: () => '/',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
  },
}

const parentBookingRequestSubmitted: CatalogEntry<ParentBookingRequestSubmittedProps | null> = {
  type: NotificationType.ParentBookingRequestSubmitted,
  templateKey: 'parent.booking.requestSubmitted',
  audience: 'parent',
  category: NotificationCategory.Booking,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentBookingRequestSubmitted],
  email: {
    component: ParentBookingRequestSubmitted as never,
    subject: props =>
      props ? `Your booking request for ${props.campName} has been sent` : 'Booking request sent',
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Request sent — ${props.campName}` : 'Booking request sent'),
    body: props =>
      props
        ? `Your booking request for ${props.childName} at ${props.campName} is awaiting confirmation. The camp has 72 hours to respond.`
        : 'Your booking request has been sent.',
    entityType: NotificationEntityType.BookingGroup,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: (_props, ctx) =>
      ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
  },
}

const parentBookingCancelled: CatalogEntry<ParentBookingCancelledProps | null> = {
  type: NotificationType.ParentBookingCancelled,
  templateKey: 'parent.booking.cancelled',
  audience: 'parent',
  category: NotificationCategory.Booking,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentBookingCancelled],
  email: {
    component: ParentBookingCancelled as never,
    subject: props =>
      props ? `Cancellation confirmed — ${props.campName}` : 'Cancellation confirmed',
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Booking cancelled — ${props.campName}` : 'Booking cancelled'),
    body: props => {
      if (!props) return 'Your booking has been cancelled.'
      const refund = props.refundAmount
        ? ` A refund of ${props.refundAmount} arrives within ${props.refundEta}.`
        : ' No refund is due under the cancellation policy.'
      return `Your booking for ${props.childName} at ${props.campName} has been cancelled.${refund}`
    },
    entityType: NotificationEntityType.BookingGroup,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: (_props, ctx) =>
      ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
  },
}

const parentBookingModified: CatalogEntry<ParentBookingModifiedProps | null> = {
  type: NotificationType.ParentBookingModified,
  templateKey: 'parent.booking.modified',
  audience: 'parent',
  category: NotificationCategory.Booking,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentBookingModified],
  email: {
    component: ParentBookingModified as never,
    subject: props =>
      props ? `Your booking at ${props.campName} has been updated` : 'Booking updated',
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Booking updated — ${props.campName}` : 'Booking updated'),
    body: props =>
      props
        ? `Your booking for ${props.childName} at ${props.campName} was updated: ${props.changesSummary}`
        : 'Your booking has been updated.',
    entityType: NotificationEntityType.BookingGroup,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: (_props, ctx) =>
      ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
    metadata: props =>
      props
        ? {
            bookingGroupNumber: props.bookingRef,
            campName: props.campName,
            changesSummary: props.changesSummary,
          }
        : {},
  },
}

const parentBookingRequestWithdrawn: CatalogEntry<ParentBookingRequestWithdrawnProps | null> = {
  type: NotificationType.ParentBookingRequestWithdrawn,
  templateKey: 'parent.booking.requestWithdrawn',
  audience: 'parent',
  category: NotificationCategory.Booking,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentBookingRequestWithdrawn],
  email: {
    component: ParentBookingRequestWithdrawn as never,
    subject: props =>
      props
        ? `Your booking request for ${props.campName} has been withdrawn`
        : 'Booking request withdrawn',
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Request withdrawn — ${props.campName}` : 'Booking request withdrawn'),
    body: props =>
      props
        ? `Your booking request for ${props.programName} at ${props.campName} has been withdrawn. You have not been charged.`
        : 'Your booking request has been withdrawn.',
    entityType: NotificationEntityType.BookingGroup,
    // entityId is the bookingGroupId from context; props has no bookingRef
    // since the parent-facing copy doesn't surface it for a withdrawn request.
    entityId: () => '',
    redirectUrl: () => '/bookings',
    metadata: props => (props ? { campName: props.campName } : {}),
  },
}

// ============================================================================
// Phase 7b — payment lifecycle (~9 entries)
// ============================================================================

const parentPaymentDepositConfirmed: CatalogEntry<ParentPaymentDepositConfirmedProps | null> = {
  type: NotificationType.ParentPaymentDepositConfirmed,
  templateKey: 'parent.payment.depositConfirmed',
  audience: 'parent',
  category: NotificationCategory.Payment,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentPaymentDepositConfirmed],
  email: {
    component: ParentPaymentDepositConfirmed as never,
    subject: props => (props ? `Deposit received for ${props.campName}` : 'Deposit received'),
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Deposit received — ${props.campName}` : 'Deposit received'),
    body: props =>
      props
        ? `Deposit of ${props.depositAmount} received. Balance of ${props.balanceAmount} due on ${props.balanceDueDate}.`
        : 'Deposit received.',
    entityType: NotificationEntityType.Payment,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: (_props, ctx) =>
      ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
  },
}

function makeBalanceReminderEntry(
  type: NotificationType,
  templateKey: string,
  daysLabel: string
): CatalogEntry<ParentPaymentBalanceReminderProps | null> {
  return {
    type,
    templateKey,
    audience: 'parent',
    category: NotificationCategory.Payment,
    channels: ['in_app', 'email'],
    salutation: 'hi',
    resolver: 'parentForBooking',
    transactional: true,
    trigger: 'scheduled',
    loadProps: propLoaders[type] as never,
    email: {
      component: ParentPaymentBalanceReminder as never,
      subject: props =>
        props ? `Balance due in ${daysLabel} — ${props.campName}` : `Balance due in ${daysLabel}`,
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props ? `Balance due in ${daysLabel} — ${props.campName}` : 'Balance due reminder',
      body: props =>
        props
          ? `${props.balanceAmount} will be charged on ${props.balanceDueDate}. Booking ${props.bookingRef}.`
          : 'Your balance is due soon.',
      entityType: NotificationEntityType.Payment,
      entityId: props => (props ? props.bookingRef : ''),
      redirectUrl: (_props, ctx) =>
        ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
      metadata: props =>
        props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
    },
  }
}

const parentPaymentBalanceReminder14d = makeBalanceReminderEntry(
  NotificationType.ParentPaymentBalanceReminder14d,
  'parent.payment.balanceReminder14d',
  '14 days'
)
const parentPaymentBalanceReminder7d = makeBalanceReminderEntry(
  NotificationType.ParentPaymentBalanceReminder7d,
  'parent.payment.balanceReminder7d',
  '7 days'
)
const parentPaymentBalanceReminder3d = makeBalanceReminderEntry(
  NotificationType.ParentPaymentBalanceReminder3d,
  'parent.payment.balanceReminder3d',
  '3 days'
)

const parentPaymentBalanceCharged: CatalogEntry<ParentPaymentBalanceChargedProps | null> = {
  type: NotificationType.ParentPaymentBalanceCharged,
  templateKey: 'parent.payment.balanceCharged',
  audience: 'parent',
  category: NotificationCategory.Payment,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentPaymentBalanceCharged],
  email: {
    component: ParentPaymentBalanceCharged as never,
    subject: props => (props ? `Balance paid for ${props.campName}` : 'Balance paid'),
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Balance paid — ${props.campName}` : 'Balance paid'),
    body: props =>
      props
        ? `Your balance of ${props.balanceAmount} was collected successfully. Booking ${props.bookingRef}.`
        : 'Your balance was paid.',
    entityType: NotificationEntityType.Payment,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: (_props, ctx) =>
      ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
  },
}

function makeBalanceFailedEntry(
  type: NotificationType,
  templateKey: string,
  stageLabel: 'first' | 'second' | 'final'
): CatalogEntry<ParentPaymentBalanceFailedProps | null> {
  return {
    type,
    templateKey,
    audience: 'parent',
    category: NotificationCategory.Payment,
    channels: ['in_app', 'email'],
    salutation: 'dear',
    resolver: 'parentForBooking',
    transactional: true,
    trigger: 'live',
    loadProps: propLoaders[type] as never,
    email: {
      component: ParentPaymentBalanceFailed as never,
      subject: props =>
        props
          ? stageLabel === 'final'
            ? `Final attempt failed — ${props.campName}`
            : `Payment issue — ${props.campName}`
          : 'Payment issue',
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props
          ? stageLabel === 'final'
            ? `Final payment attempt failed — ${props.campName}`
            : `Payment failed — ${props.campName}`
          : 'Payment failed',
      body: props =>
        props
          ? `${props.balanceAmount} payment failed. Please update your payment method to avoid cancellation.`
          : 'Your payment did not go through.',
      entityType: NotificationEntityType.Payment,
      entityId: props => (props ? props.bookingRef : ''),
      redirectUrl: (_props, ctx) =>
        ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
      metadata: props =>
        props
          ? {
              bookingGroupNumber: props.bookingRef,
              campName: props.campName,
              declineReason: props.declineReason ?? null,
            }
          : {},
    },
  }
}

const parentPaymentBalanceFailedFirst = makeBalanceFailedEntry(
  NotificationType.ParentPaymentBalanceFailedFirst,
  'parent.payment.balanceFailedFirst',
  'first'
)
const parentPaymentBalanceFailedSecond = makeBalanceFailedEntry(
  NotificationType.ParentPaymentBalanceFailedSecond,
  'parent.payment.balanceFailedSecond',
  'second'
)
const parentPaymentBalanceFailedFinal = makeBalanceFailedEntry(
  NotificationType.ParentPaymentBalanceFailedFinal,
  'parent.payment.balanceFailedFinal',
  'final'
)

const parentPaymentCancelledNonPayment: CatalogEntry<ParentPaymentCancelledNonPaymentProps | null> =
  {
    type: NotificationType.ParentPaymentCancelledNonPayment,
    templateKey: 'parent.payment.cancelledNonPayment',
    audience: 'parent',
    category: NotificationCategory.Payment,
    channels: ['in_app', 'email'],
    salutation: 'dear',
    resolver: 'parentForBooking',
    transactional: true,
    trigger: 'live',
    loadProps: propLoaders[NotificationType.ParentPaymentCancelledNonPayment],
    email: {
      component: ParentPaymentCancelledNonPayment as never,
      subject: props => (props ? `Booking cancelled — ${props.campName}` : 'Booking cancelled'),
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props
          ? `Booking cancelled (non-payment) — ${props.campName}`
          : 'Booking cancelled (non-payment)',
      body: props =>
        props
          ? `We weren't able to collect the balance for ${props.campName}. Booking ${props.bookingRef} has been cancelled.`
          : 'Booking cancelled due to non-payment.',
      entityType: NotificationEntityType.BookingGroup,
      entityId: props => (props ? props.bookingRef : ''),
      redirectUrl: () => '/',
      metadata: props =>
        props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
    },
  }

// ============================================================================
// Phase 7c — refund / dispute (~5 entries)
// ============================================================================

const parentRefundIssued: CatalogEntry<ParentRefundIssuedProps | null> = {
  type: NotificationType.ParentRefundIssued,
  templateKey: 'parent.refund.issued',
  audience: 'parent',
  category: NotificationCategory.Refund,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentRefundIssued],
  email: {
    component: ParentRefundIssued as never,
    subject: props => (props ? `Refund processed — ${props.refundAmount}` : 'Refund processed'),
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Refund processed — ${props.refundAmount}` : 'Refund processed'),
    body: props =>
      props
        ? `Refund of ${props.refundAmount} for ${props.campName} will appear within ${props.refundEta}.`
        : 'Your refund has been processed.',
    entityType: NotificationEntityType.Refund,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: (_props, ctx) =>
      ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
  },
}

const parentRefundFailed: CatalogEntry<ParentRefundFailedProps | null> = {
  type: NotificationType.ParentRefundFailed,
  templateKey: 'parent.refund.failed',
  audience: 'parent',
  category: NotificationCategory.Refund,
  channels: ['in_app', 'email'],
  salutation: 'dear',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentRefundFailed],
  email: {
    component: ParentRefundFailed as never,
    subject: props => (props ? `Refund issue — ${props.campName}` : 'Refund issue'),
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Refund failed — ${props.campName}` : 'Refund failed'),
    body: props =>
      props
        ? `Refund of ${props.refundAmount} for ${props.campName} could not be processed. We'll be in touch.`
        : 'Refund failed — we will be in touch.',
    entityType: NotificationEntityType.Refund,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: (_props, ctx) =>
      ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
  },
}

const parentDisputeOpened: CatalogEntry<ParentDisputeOpenedProps | null> = {
  type: NotificationType.ParentDisputeOpened,
  templateKey: 'parent.dispute.opened',
  audience: 'parent',
  category: NotificationCategory.Dispute,
  channels: ['in_app', 'email'],
  salutation: 'dear',
  resolver: 'parentForBooking',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentDisputeOpened],
  email: {
    component: ParentDisputeOpened as never,
    subject: props => (props ? `Chargeback opened — ${props.campName}` : 'Chargeback opened'),
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Chargeback opened — ${props.campName}` : 'Chargeback opened'),
    body: props =>
      props
        ? `Your bank has opened a chargeback for ${props.disputeAmount}. Contact your bank for more.`
        : 'Your bank has opened a chargeback.',
    entityType: NotificationEntityType.Dispute,
    entityId: props => (props ? props.bookingRef : ''),
    redirectUrl: (_props, ctx) =>
      ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
    metadata: props =>
      props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
  },
}

function makeDisputeResolvedEntry(
  type: NotificationType,
  templateKey: string,
  outcome: 'won' | 'lost'
): CatalogEntry<ParentDisputeResolvedProps | null> {
  return {
    type,
    templateKey,
    audience: 'parent',
    category: NotificationCategory.Dispute,
    channels: ['in_app', 'email'],
    salutation: 'dear',
    resolver: 'parentForBooking',
    transactional: true,
    trigger: 'live',
    loadProps: propLoaders[type] as never,
    email: {
      component: ParentDisputeResolved as never,
      subject: props => (props ? `Chargeback resolved — ${props.campName}` : 'Chargeback resolved'),
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props
          ? `Chargeback ${outcome === 'won' ? 'closed (charge stands)' : 'resolved (refunded)'} — ${props.campName}`
          : 'Chargeback resolved',
      body: props =>
        props
          ? `Chargeback for ${props.disputeAmount} on ${props.campName} closed (${outcome}).`
          : 'Chargeback resolved.',
      entityType: NotificationEntityType.Dispute,
      entityId: props => (props ? props.bookingRef : ''),
      redirectUrl: (_props, ctx) =>
        ctx.bookingGroupId ? `/bookings/${ctx.bookingGroupId}` : '/bookings',
      metadata: props =>
        props ? { bookingGroupNumber: props.bookingRef, campName: props.campName } : {},
    },
  }
}

const parentDisputeResolvedWon = makeDisputeResolvedEntry(
  NotificationType.ParentDisputeResolvedWon,
  'parent.dispute.resolvedWon',
  'won'
)
const parentDisputeResolvedLost = makeDisputeResolvedEntry(
  NotificationType.ParentDisputeResolvedLost,
  'parent.dispute.resolvedLost',
  'lost'
)

// ============================================================================
// Phase 7e — messaging / support (~3 entries)
// ============================================================================

const parentMessagingNewFromCamp: CatalogEntry<ParentMessagingNewFromCampProps | null> = {
  type: NotificationType.ParentMessagingNewFromCamp,
  templateKey: 'parent.messaging.newFromCamp',
  audience: 'parent',
  category: NotificationCategory.Message,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForConversation',
  transactional: false,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentMessagingNewFromCamp],
  email: {
    component: ParentMessagingNewFromCamp as never,
    subject: props => (props ? `New message from ${props.campName}` : 'You have a new message'),
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `New message from ${props.senderName}` : 'New message'),
    body: props => props?.preview ?? 'You have a new message.',
    entityType: NotificationEntityType.Message,
    entityId: props => props?.conversationUrl?.split('/').pop() ?? '',
    redirectUrl: props => (props ? `/messages` : '/messages'),
    metadata: props => (props ? { campName: props.campName, senderName: props.senderName } : {}),
  },
}

const parentSupportTicketReply: CatalogEntry<ParentSupportTicketReplyProps | null> = {
  type: NotificationType.ParentSupportTicketReply,
  templateKey: 'parent.support.ticketReply',
  audience: 'parent',
  category: NotificationCategory.Support,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForSupportTicket',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentSupportTicketReply],
  email: {
    component: ParentSupportTicketReply as never,
    subject: props => (props ? `Support reply — ${props.ticketSubject}` : 'Support reply'),
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Support reply — ${props.ticketSubject}` : 'Support reply'),
    body: props => props?.preview ?? 'New reply on your support ticket.',
    entityType: NotificationEntityType.SupportTicket,
    entityId: props => props?.ticketRef ?? '',
    redirectUrl: (_props, ctx) =>
      ctx.supportTicketId ? `/support/tickets/${ctx.supportTicketId}` : '/support/tickets',
    metadata: props => (props ? { ticketSubject: props.ticketSubject } : {}),
  },
}

const parentSupportTicketStatusChanged: CatalogEntry<ParentSupportTicketStatusChangedProps | null> =
  {
    type: NotificationType.ParentSupportTicketStatusChanged,
    templateKey: 'parent.support.ticketStatusChanged',
    audience: 'parent',
    category: NotificationCategory.Support,
    channels: ['in_app', 'email'],
    salutation: 'hi',
    resolver: 'parentForSupportTicket',
    transactional: true,
    trigger: 'live',
    loadProps: propLoaders[NotificationType.ParentSupportTicketStatusChanged],
    email: {
      component: ParentSupportTicketStatusChanged as never,
      subject: props =>
        props
          ? `Ticket ${props.newStatusLabel.toLowerCase()} — ${props.ticketSubject}`
          : 'Ticket status updated',
      includePlainText: true,
    },
    inApp: {
      title: props =>
        props
          ? `Ticket ${props.newStatusLabel.toLowerCase()} — ${props.ticketSubject}`
          : 'Ticket updated',
      body: props =>
        props
          ? `Your support ticket is now ${props.newStatusLabel.toLowerCase()}. Reference ${props.ticketRef}.`
          : 'Your ticket status changed.',
      entityType: NotificationEntityType.SupportTicket,
      entityId: props => props?.ticketRef ?? '',
      redirectUrl: (_props, ctx) =>
        ctx.supportTicketId ? `/support/tickets/${ctx.supportTicketId}` : '/support/tickets',
      metadata: props =>
        props ? { ticketSubject: props.ticketSubject, newStatus: props.newStatusLabel } : {},
    },
  }

// ============================================================================
// Phase 7f — wishlist / conversion (~12 entries)
// ============================================================================

const parentWishlistEmpty: CatalogEntry<ParentWishlistEmptyProps | null> = {
  type: NotificationType.ParentWishlistEmpty,
  templateKey: 'parent.wishlist.empty',
  audience: 'parent',
  category: NotificationCategory.Wishlist,
  channels: ['email'],
  salutation: 'hi',
  resolver: 'parentByUserId',
  transactional: false,
  trigger: 'scheduled',
  loadProps: propLoaders[NotificationType.ParentWishlistEmpty],
  email: {
    component: ParentWishlistEmpty as never,
    subject: () => 'Discover camps your family will love',
    includePlainText: true,
  },
}

function makeWishlistItemsNoBookingEntry(
  type: NotificationType,
  templateKey: string,
  days: 7 | 21
): CatalogEntry<ParentWishlistItemsNoBookingProps | null> {
  return {
    type,
    templateKey,
    audience: 'parent',
    category: NotificationCategory.Wishlist,
    channels: ['email'],
    salutation: 'hi',
    resolver: 'parentByUserId',
    transactional: false,
    trigger: 'scheduled',
    loadProps: propLoaders[type] as never,
    email: {
      component: ParentWishlistItemsNoBooking as never,
      subject: props => (props ? `Still thinking about ${props.leadCampName}?` : 'Still browsing?'),
      includePlainText: true,
    },
  }
}

const parentWishlistItemsNoBooking7d = makeWishlistItemsNoBookingEntry(
  NotificationType.ParentWishlistItemsNoBooking7d,
  'parent.wishlist.itemsNoBooking7d',
  7
)
const parentWishlistItemsNoBooking21d = makeWishlistItemsNoBookingEntry(
  NotificationType.ParentWishlistItemsNoBooking21d,
  'parent.wishlist.itemsNoBooking21d',
  21
)

function makeWishlistEventEntry(
  type: NotificationType,
  templateKey: string,
  subjectBuilder: (camp: string) => string,
  inAppTitle: (camp: string) => string
): CatalogEntry<ParentWishlistEventProps | null> {
  return {
    type,
    templateKey,
    audience: 'parent',
    category: NotificationCategory.Wishlist,
    channels: ['in_app', 'email'],
    salutation: 'hi',
    resolver: 'parentByUserId',
    transactional: false,
    trigger: 'live',
    loadProps: propLoaders[type] as never,
    email: {
      component: ParentWishlistEvent as never,
      subject: props => (props ? subjectBuilder(props.campName) : 'Wishlist update'),
      includePlainText: true,
    },
    inApp: {
      title: props => (props ? inAppTitle(props.campName) : 'Wishlist update'),
      body: props => (props ? props.detail : 'Update on a camp you saved.'),
      entityType: NotificationEntityType.WishlistItem,
      entityId: props => props?.campName ?? '',
      redirectUrl: () => '/wishlists',
      metadata: props => (props ? { campName: props.campName } : {}),
    },
  }
}

const parentWishlistPriceDrop = makeWishlistEventEntry(
  NotificationType.ParentWishlistPriceDrop,
  'parent.wishlist.priceDrop',
  camp => `Price drop on ${camp}`,
  camp => `Price drop — ${camp}`
)
const parentWishlistFillingUp = makeWishlistEventEntry(
  NotificationType.ParentWishlistFillingUp,
  'parent.wishlist.fillingUp',
  camp => `${camp} is filling up`,
  camp => `Filling up — ${camp}`
)
const parentWishlistDeadlineApproaching = makeWishlistEventEntry(
  NotificationType.ParentWishlistDeadlineApproaching,
  'parent.wishlist.deadlineApproaching',
  camp => `Deadline approaching — ${camp}`,
  camp => `Deadline approaching — ${camp}`
)
const parentWishlistEarlyBirdIncrease = makeWishlistEventEntry(
  NotificationType.ParentWishlistEarlyBirdIncrease,
  'parent.wishlist.earlyBirdIncrease',
  camp => `Early-bird ending — ${camp}`,
  camp => `Early-bird ending — ${camp}`
)

const parentConversionPostDeclineAlternatives: CatalogEntry<ParentPostDeclineAlternativesProps | null> =
  {
    type: NotificationType.ParentConversionPostDeclineAlternatives,
    templateKey: 'parent.conversion.postDeclineAlternatives',
    audience: 'parent',
    category: NotificationCategory.Marketing,
    channels: ['email'],
    salutation: 'hi',
    resolver: 'parentByUserId',
    transactional: false,
    trigger: 'scheduled',
    loadProps: propLoaders[NotificationType.ParentConversionPostDeclineAlternatives],
    email: {
      component: ParentPostDeclineAlternatives as never,
      subject: props =>
        props ? `Alternatives to ${props.originalCampName}` : 'Programs you might love',
      includePlainText: true,
    },
  }

function makeAbandonedCheckoutEntry(
  type: NotificationType,
  templateKey: string,
  stageLabel: '3h' | '2d' | '4d' | '6d'
): CatalogEntry<ParentCheckoutAbandonedProps | null> {
  return {
    type,
    templateKey,
    audience: 'parent',
    category: NotificationCategory.Booking,
    channels: ['email'],
    salutation: 'hi',
    resolver: 'parentForBooking',
    transactional: false,
    trigger: stageLabel === '3h' ? 'live' : 'scheduled',
    loadProps: propLoaders[type] as never,
    email: {
      component: ParentCheckoutAbandoned as never,
      subject: props =>
        props
          ? stageLabel === '6d'
            ? `Last chance — ${props.campName}`
            : `Pick up where you left off — ${props.campName}`
          : 'Continue your booking',
      includePlainText: true,
    },
  }
}

const parentCheckoutAbandoned3h = makeAbandonedCheckoutEntry(
  NotificationType.ParentCheckoutAbandoned3h,
  'parent.checkout.abandoned3h',
  '3h'
)
const parentCheckoutAbandoned2d = makeAbandonedCheckoutEntry(
  NotificationType.ParentCheckoutAbandoned2d,
  'parent.checkout.abandoned2d',
  '2d'
)
const parentCheckoutAbandoned4d = makeAbandonedCheckoutEntry(
  NotificationType.ParentCheckoutAbandoned4d,
  'parent.checkout.abandoned4d',
  '4d'
)
const parentCheckoutAbandoned6d = makeAbandonedCheckoutEntry(
  NotificationType.ParentCheckoutAbandoned6d,
  'parent.checkout.abandoned6d',
  '6d'
)

// ============================================================================
// Phase 7g — pre/post-camp + reviews + profile (~9 entries)
// ============================================================================

function makePreCampEntry(
  type: NotificationType,
  templateKey: string,
  subjectBuilder: (camp: string) => string
): CatalogEntry<ParentPreCampProps | null> {
  return {
    type,
    templateKey,
    audience: 'parent',
    category: NotificationCategory.Booking,
    channels: ['email'],
    salutation: 'hi',
    resolver: 'parentForBooking',
    transactional: false,
    trigger: 'scheduled',
    loadProps: propLoaders[type] as never,
    email: {
      component: ParentPreCamp as never,
      subject: props => (props ? subjectBuilder(props.campName) : 'Camp is coming up'),
      includePlainText: true,
    },
  }
}

const parentPreCampChecklist14d = makePreCampEntry(
  NotificationType.ParentPreCampChecklist14d,
  'parent.preCamp.checklist14d',
  camp => `Two weeks to go — ${camp}`
)
const parentPreCampPackingReminder7d = makePreCampEntry(
  NotificationType.ParentPreCampPackingReminder7d,
  'parent.preCamp.packingReminder7d',
  camp => `Packing time — ${camp}`
)
const parentPreCampDayBefore = makePreCampEntry(
  NotificationType.ParentPreCampDayBefore,
  'parent.preCamp.dayBefore',
  camp => `Tomorrow's the day! — ${camp}`
)

function makePostCampReviewEntry(
  type: NotificationType,
  templateKey: string,
  subjectBuilder: (camp: string) => string
): CatalogEntry<ParentPostCampReviewProps | null> {
  return {
    type,
    templateKey,
    audience: 'parent',
    category: NotificationCategory.Review,
    channels: ['email'],
    salutation: 'hi',
    resolver: 'parentForBooking',
    transactional: false,
    trigger: 'scheduled',
    loadProps: propLoaders[type] as never,
    email: {
      component: ParentPostCampReview as never,
      subject: props => (props ? subjectBuilder(props.campName) : 'Share your experience'),
      includePlainText: true,
    },
  }
}

const parentPostCampReviewRequest = makePostCampReviewEntry(
  NotificationType.ParentPostCampReviewRequest,
  'parent.postCamp.reviewRequest',
  camp => `How was your ${camp} experience?`
)
const parentPostCampReviewReminder = makePostCampReviewEntry(
  NotificationType.ParentPostCampReviewReminder,
  'parent.postCamp.reviewReminder',
  camp => `Reminder — share your ${camp} review`
)
const parentPostCampSurvey = makePostCampReviewEntry(
  NotificationType.ParentPostCampSurvey,
  'parent.postCamp.survey',
  camp => `A quick survey about ${camp}`
)

const parentReviewResponsePublished: CatalogEntry<ParentReviewResponsePublishedProps | null> = {
  type: NotificationType.ParentReviewResponsePublished,
  templateKey: 'parent.review.responsePublished',
  audience: 'parent',
  category: NotificationCategory.Review,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForReview',
  transactional: false,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentReviewResponsePublished],
  email: {
    component: ParentReviewResponsePublished as never,
    subject: props => (props ? `${props.campName} replied to your review` : 'Reply on your review'),
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `${props.campName} replied to your review` : 'Reply on your review'),
    body: props => props?.preview ?? 'The camp replied to your review.',
    entityType: NotificationEntityType.Review,
    entityId: props => props?.reviewUrl?.split('/').pop() ?? '',
    redirectUrl: props => (props ? `/reviews` : '/reviews'),
    metadata: props => (props ? { campName: props.campName } : {}),
  },
}

const parentReviewRemoved: CatalogEntry<ParentReviewRemovedProps | null> = {
  type: NotificationType.ParentReviewRemoved,
  templateKey: 'parent.review.removed',
  audience: 'parent',
  category: NotificationCategory.Review,
  channels: ['in_app', 'email'],
  salutation: 'hi',
  resolver: 'parentForReview',
  transactional: true,
  trigger: 'live',
  loadProps: propLoaders[NotificationType.ParentReviewRemoved],
  email: {
    component: ParentReviewRemoved as never,
    subject: props => (props ? `Your review of ${props.campName} was removed` : 'Review removed'),
    includePlainText: true,
  },
  inApp: {
    title: props => (props ? `Review removed — ${props.campName}` : 'Review removed'),
    body: props => props?.reasonLabel ?? 'Your review was removed by moderation.',
    entityType: NotificationEntityType.Review,
    entityId: () => '',
    redirectUrl: () => '/reviews',
    metadata: props => (props ? { campName: props.campName } : {}),
  },
}

const parentProfileIncomplete: CatalogEntry<ParentProfileIncompleteProps | null> = {
  type: NotificationType.ParentProfileIncomplete,
  templateKey: 'parent.profile.incomplete',
  audience: 'parent',
  category: NotificationCategory.Profile,
  channels: ['email'],
  salutation: 'hi',
  resolver: 'parentByUserId',
  transactional: false,
  trigger: 'scheduled',
  loadProps: propLoaders[NotificationType.ParentProfileIncomplete],
  email: {
    component: ParentProfileIncomplete as never,
    subject: () => 'Finish setting up your World Camps profile',
    includePlainText: true,
  },
}

export const parentCatalog: ReadonlyArray<CatalogEntry<unknown>> = [
  // Booking (Phase 7a + scheduled)
  parentBookingAccepted as unknown as CatalogEntry<unknown>,
  parentBookingDeclined as unknown as CatalogEntry<unknown>,
  parentBookingRequestSubmitted as unknown as CatalogEntry<unknown>,
  parentBookingRequestStillPending as unknown as CatalogEntry<unknown>,
  parentBookingExpired as unknown as CatalogEntry<unknown>,
  parentBookingCancelled as unknown as CatalogEntry<unknown>,
  parentBookingModified as unknown as CatalogEntry<unknown>,
  parentBookingRequestWithdrawn as unknown as CatalogEntry<unknown>,
  // Payment (Phase 7b)
  parentPaymentDepositConfirmed as unknown as CatalogEntry<unknown>,
  parentPaymentBalanceReminder14d as unknown as CatalogEntry<unknown>,
  parentPaymentBalanceReminder7d as unknown as CatalogEntry<unknown>,
  parentPaymentBalanceReminder3d as unknown as CatalogEntry<unknown>,
  parentPaymentBalanceCharged as unknown as CatalogEntry<unknown>,
  parentPaymentBalanceFailedFirst as unknown as CatalogEntry<unknown>,
  parentPaymentBalanceFailedSecond as unknown as CatalogEntry<unknown>,
  parentPaymentBalanceFailedFinal as unknown as CatalogEntry<unknown>,
  parentPaymentCancelledNonPayment as unknown as CatalogEntry<unknown>,
  // Refund / Dispute (Phase 7c)
  parentRefundIssued as unknown as CatalogEntry<unknown>,
  parentRefundFailed as unknown as CatalogEntry<unknown>,
  parentDisputeOpened as unknown as CatalogEntry<unknown>,
  parentDisputeResolvedWon as unknown as CatalogEntry<unknown>,
  parentDisputeResolvedLost as unknown as CatalogEntry<unknown>,
  // Messaging / Support (Phase 7e)
  parentMessagingNewFromCamp as unknown as CatalogEntry<unknown>,
  parentSupportTicketReply as unknown as CatalogEntry<unknown>,
  parentSupportTicketStatusChanged as unknown as CatalogEntry<unknown>,
  // Wishlist / Conversion (Phase 7f)
  parentWishlistEmpty as unknown as CatalogEntry<unknown>,
  parentWishlistItemsNoBooking7d as unknown as CatalogEntry<unknown>,
  parentWishlistItemsNoBooking21d as unknown as CatalogEntry<unknown>,
  parentWishlistPriceDrop as unknown as CatalogEntry<unknown>,
  parentWishlistFillingUp as unknown as CatalogEntry<unknown>,
  parentWishlistDeadlineApproaching as unknown as CatalogEntry<unknown>,
  parentWishlistEarlyBirdIncrease as unknown as CatalogEntry<unknown>,
  parentConversionPostDeclineAlternatives as unknown as CatalogEntry<unknown>,
  parentCheckoutAbandoned3h as unknown as CatalogEntry<unknown>,
  parentCheckoutAbandoned2d as unknown as CatalogEntry<unknown>,
  parentCheckoutAbandoned4d as unknown as CatalogEntry<unknown>,
  parentCheckoutAbandoned6d as unknown as CatalogEntry<unknown>,
  // Pre/Post-camp + Reviews + Profile (Phase 7g)
  parentPreCampChecklist14d as unknown as CatalogEntry<unknown>,
  parentPreCampPackingReminder7d as unknown as CatalogEntry<unknown>,
  parentPreCampDayBefore as unknown as CatalogEntry<unknown>,
  parentPostCampReviewRequest as unknown as CatalogEntry<unknown>,
  parentPostCampReviewReminder as unknown as CatalogEntry<unknown>,
  parentPostCampSurvey as unknown as CatalogEntry<unknown>,
  parentReviewResponsePublished as unknown as CatalogEntry<unknown>,
  parentReviewRemoved as unknown as CatalogEntry<unknown>,
  parentProfileIncomplete as unknown as CatalogEntry<unknown>,
]
