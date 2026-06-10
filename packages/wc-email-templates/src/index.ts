export * from './lib/renderer'

// ---- Shared ----
export { Layout } from '../emails/_shared/layout'
export type { LayoutProps } from '../emails/_shared/layout'
export { BrandedButton } from '../emails/_shared/branded-button'
export type { BrandedButtonProps } from '../emails/_shared/branded-button'
export { InfoPanel } from '../emails/_shared/info-panel'
export type { InfoPanelProps } from '../emails/_shared/info-panel'
export { Salutation } from '../emails/_shared/salutation'
export type { SalutationStyle, SalutationProps } from '../emails/_shared/salutation'
export { theme } from '../emails/_shared/theme'
export type { Theme } from '../emails/_shared/theme'

// ---- Booking ----
export { default as ParentBookingAccepted } from '../emails/booking/parent-booking-accepted'
export type { ParentBookingAcceptedProps } from '../emails/booking/parent-booking-accepted'
export { default as ParentBookingDeclined } from '../emails/booking/parent-booking-declined'
export type { ParentBookingDeclinedProps } from '../emails/booking/parent-booking-declined'
export { default as ParentBookingRequestSubmitted } from '../emails/booking/parent-booking-request-submitted'
export type { ParentBookingRequestSubmittedProps } from '../emails/booking/parent-booking-request-submitted'
export { default as ParentBookingCancelled } from '../emails/booking/parent-booking-cancelled'
export type { ParentBookingCancelledProps } from '../emails/booking/parent-booking-cancelled'
export { default as ParentBookingModified } from '../emails/booking/parent-booking-modified'
export type { ParentBookingModifiedProps } from '../emails/booking/parent-booking-modified'
export { default as ParentBookingRequestWithdrawn } from '../emails/booking/parent-booking-request-withdrawn'
export type { ParentBookingRequestWithdrawnProps } from '../emails/booking/parent-booking-request-withdrawn'

// ---- Payment ----
export { default as ParentPaymentDepositConfirmed } from '../emails/payment/parent-payment-deposit-confirmed'
export type { ParentPaymentDepositConfirmedProps } from '../emails/payment/parent-payment-deposit-confirmed'
export { default as ParentPaymentBalanceReminder } from '../emails/payment/parent-payment-balance-reminder'
export type { ParentPaymentBalanceReminderProps } from '../emails/payment/parent-payment-balance-reminder'
export { default as ParentPaymentBalanceCharged } from '../emails/payment/parent-payment-balance-charged'
export type { ParentPaymentBalanceChargedProps } from '../emails/payment/parent-payment-balance-charged'
export { default as ParentPaymentBalanceFailed } from '../emails/payment/parent-payment-balance-failed'
export type {
  ParentPaymentBalanceFailedProps,
  BalanceFailureStage,
} from '../emails/payment/parent-payment-balance-failed'
export { default as ParentPaymentCancelledNonPayment } from '../emails/payment/parent-payment-cancelled-non-payment'
export type { ParentPaymentCancelledNonPaymentProps } from '../emails/payment/parent-payment-cancelled-non-payment'

// ---- Refund / Dispute ----
export { default as ParentRefundIssued } from '../emails/refund/parent-refund-issued'
export type { ParentRefundIssuedProps } from '../emails/refund/parent-refund-issued'
export { default as ParentRefundFailed } from '../emails/refund/parent-refund-failed'
export type { ParentRefundFailedProps } from '../emails/refund/parent-refund-failed'
export { default as ParentDisputeOpened } from '../emails/dispute/parent-dispute-opened'
export type { ParentDisputeOpenedProps } from '../emails/dispute/parent-dispute-opened'
export { default as ParentDisputeResolved } from '../emails/dispute/parent-dispute-resolved'
export type {
  ParentDisputeResolvedProps,
  DisputeOutcome,
} from '../emails/dispute/parent-dispute-resolved'

// ---- Messaging / Support ----
export { default as ParentMessagingNewFromCamp } from '../emails/messaging/parent-messaging-new-from-camp'
export type { ParentMessagingNewFromCampProps } from '../emails/messaging/parent-messaging-new-from-camp'
export { default as ParentSupportTicketReply } from '../emails/support/parent-support-ticket-reply'
export type { ParentSupportTicketReplyProps } from '../emails/support/parent-support-ticket-reply'
export { default as ParentSupportTicketStatusChanged } from '../emails/support/parent-support-ticket-status-changed'
export type { ParentSupportTicketStatusChangedProps } from '../emails/support/parent-support-ticket-status-changed'

// ---- Wishlist / Conversion ----
export { default as ParentWishlistEmpty } from '../emails/wishlist/parent-wishlist-empty'
export type { ParentWishlistEmptyProps } from '../emails/wishlist/parent-wishlist-empty'
export { default as ParentWishlistItemsNoBooking } from '../emails/wishlist/parent-wishlist-items-no-booking'
export type { ParentWishlistItemsNoBookingProps } from '../emails/wishlist/parent-wishlist-items-no-booking'
export { default as ParentWishlistEvent } from '../emails/wishlist/parent-wishlist-event'
export type {
  ParentWishlistEventProps,
  WishlistEventKind,
} from '../emails/wishlist/parent-wishlist-event'
export { default as ParentCheckoutAbandoned } from '../emails/conversion/parent-checkout-abandoned'
export type {
  ParentCheckoutAbandonedProps,
  AbandonStage,
} from '../emails/conversion/parent-checkout-abandoned'
export { default as ParentPostDeclineAlternatives } from '../emails/conversion/parent-post-decline-alternatives'
export type { ParentPostDeclineAlternativesProps } from '../emails/conversion/parent-post-decline-alternatives'

// ---- Reminder / Review / Profile ----
export { default as ParentPreCamp } from '../emails/reminder/parent-pre-camp'
export type { ParentPreCampProps, PreCampStage } from '../emails/reminder/parent-pre-camp'
export { default as ParentPostCampReview } from '../emails/review/parent-post-camp-review'
export type {
  ParentPostCampReviewProps,
  PostCampStage,
} from '../emails/review/parent-post-camp-review'
export { default as ParentReviewResponsePublished } from '../emails/review/parent-review-response-published'
export type { ParentReviewResponsePublishedProps } from '../emails/review/parent-review-response-published'
export { default as ParentReviewRemoved } from '../emails/review/parent-review-removed'
export type { ParentReviewRemovedProps } from '../emails/review/parent-review-removed'
export { default as ParentProfileIncomplete } from '../emails/profile/parent-profile-incomplete'
export type { ParentProfileIncompleteProps } from '../emails/profile/parent-profile-incomplete'

// ---- Provider — Onboarding ----
export { default as ProviderApplicationStatus } from '../emails/provider/onboarding/provider-application-status'
export type {
  ProviderApplicationStatusProps,
  ApplicationStatusStage,
} from '../emails/provider/onboarding/provider-application-status'
export { default as ProviderStripeConnect } from '../emails/provider/onboarding/provider-stripe-connect'
export type {
  ProviderStripeConnectProps,
  StripeConnectStage,
} from '../emails/provider/onboarding/provider-stripe-connect'
export { default as ProviderProfileMilestone } from '../emails/provider/onboarding/provider-profile-milestone'
export type {
  ProviderProfileMilestoneProps,
  ProfileMilestoneStage,
} from '../emails/provider/onboarding/provider-profile-milestone'

// ---- Provider — Booking ----
export { default as ProviderBookingEvent } from '../emails/provider/booking/provider-booking-event'
export type {
  ProviderBookingEventProps,
  BookingEventKind,
} from '../emails/provider/booking/provider-booking-event'
export { default as ProviderBookingRequestReceived } from '../emails/provider/booking/provider-booking-request-received'
export type { ProviderBookingRequestReceivedProps } from '../emails/provider/booking/provider-booking-request-received'

// ---- Provider — Payouts / Refunds / Disputes ----
export { default as ProviderPayoutEvent } from '../emails/provider/payouts/provider-payout-event'
export type {
  ProviderPayoutEventProps,
  PayoutEventKind,
} from '../emails/provider/payouts/provider-payout-event'
export { default as ProviderRefundEvent } from '../emails/provider/refund/provider-refund-event'
export type {
  ProviderRefundEventProps,
  RefundEventKind,
} from '../emails/provider/refund/provider-refund-event'
export { default as ProviderDisputeEvent } from '../emails/provider/dispute/provider-dispute-event'
export type {
  ProviderDisputeEventProps,
  DisputeEventKind,
} from '../emails/provider/dispute/provider-dispute-event'

// ---- Provider — Messaging / Reviews / Reminder / Operations / Support ----
export { default as ProviderMessagingEvent } from '../emails/provider/messaging/provider-messaging-event'
export type {
  ProviderMessagingEventProps,
  MessagingEventKind,
} from '../emails/provider/messaging/provider-messaging-event'
export { default as ProviderReviewEvent } from '../emails/provider/review/provider-review-event'
export type {
  ProviderReviewEventProps,
  ReviewEventKind,
} from '../emails/provider/review/provider-review-event'
export { default as ProviderPreCamp } from '../emails/provider/reminder/provider-pre-camp'
export type {
  ProviderPreCampProps,
  ProviderPreCampStage,
} from '../emails/provider/reminder/provider-pre-camp'
export { default as ProviderOperationsNudge } from '../emails/provider/operations/provider-operations-nudge'
export type {
  ProviderOperationsNudgeProps,
  OperationsNudgeKind,
} from '../emails/provider/operations/provider-operations-nudge'
export { default as ProviderSupportEvent } from '../emails/provider/support/provider-support-event'
export type {
  ProviderSupportEventProps,
  ProviderSupportEventKind,
} from '../emails/provider/support/provider-support-event'

// ---- Superadmin — Onboarding / Health / Finance / Support / Review ----
export { default as SuperadminCampOnboarding } from '../emails/superadmin/onboarding/superadmin-camp-onboarding'
export type {
  SuperadminCampOnboardingProps,
  SuperadminCampOnboardingKind,
} from '../emails/superadmin/onboarding/superadmin-camp-onboarding'
export { default as SuperadminCampHealth } from '../emails/superadmin/health/superadmin-camp-health'
export type {
  SuperadminCampHealthProps,
  SuperadminCampHealthKind,
} from '../emails/superadmin/health/superadmin-camp-health'
export { default as SuperadminFinanceEvent } from '../emails/superadmin/finance/superadmin-finance-event'
export type {
  SuperadminFinanceEventProps,
  SuperadminFinanceEventKind,
} from '../emails/superadmin/finance/superadmin-finance-event'
export { default as SuperadminSupportEvent } from '../emails/superadmin/support/superadmin-support-event'
export type {
  SuperadminSupportEventProps,
  SuperadminSupportEventKind,
} from '../emails/superadmin/support/superadmin-support-event'
export { default as SuperadminReviewFlagged } from '../emails/superadmin/review/superadmin-review-flagged'
export type { SuperadminReviewFlaggedProps } from '../emails/superadmin/review/superadmin-review-flagged'
