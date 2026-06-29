import { NotificationCategory, NotificationType } from './websocket.types'

/**
 * Single source of truth mapping every `NotificationType` to its
 * `NotificationCategory`. Consumed by:
 *  - filter logic on the notifications page (which types fall under
 *    the "Bookings" / "Messages" / etc. tabs)
 *  - icon assignment on the notifications page
 *  - the notification preferences UI (one section per category)
 *  - the QA matrix generator
 *
 * New entries populate this map alongside their NotificationType
 * additions — catalog validation tests will fail CI when a type lacks
 * a category mapping.
 */
export const NOTIFICATION_CATEGORY: Partial<Record<NotificationType, NotificationCategory>> = {
  // Parent booking lifecycle
  [NotificationType.ParentBookingRequestSubmitted]: NotificationCategory.Booking,
  [NotificationType.ParentBookingRequestStillPending]: NotificationCategory.Booking,
  [NotificationType.ParentBookingAccepted]: NotificationCategory.Booking,
  [NotificationType.ParentBookingDeclined]: NotificationCategory.Booking,
  [NotificationType.ParentBookingExpired]: NotificationCategory.Booking,
  [NotificationType.ParentBookingCancelled]: NotificationCategory.Booking,
  [NotificationType.ParentBookingModified]: NotificationCategory.Booking,
  [NotificationType.ParentBookingRequestWithdrawn]: NotificationCategory.Booking,
  // Provider booking lifecycle
  [NotificationType.ProviderBookingAccepted]: NotificationCategory.Booking,
  [NotificationType.ProviderBookingDeclined]: NotificationCategory.Booking,
  [NotificationType.ProviderBookingRequestReceived]: NotificationCategory.Booking,

  // Parent payment lifecycle
  [NotificationType.ParentPaymentDepositConfirmed]: NotificationCategory.Payment,
  [NotificationType.ParentPaymentBalanceReminder14d]: NotificationCategory.Payment,
  [NotificationType.ParentPaymentBalanceReminder7d]: NotificationCategory.Payment,
  [NotificationType.ParentPaymentBalanceReminder3d]: NotificationCategory.Payment,
  [NotificationType.ParentPaymentBalanceCharged]: NotificationCategory.Payment,
  [NotificationType.ParentPaymentBalanceFailedFirst]: NotificationCategory.Payment,
  [NotificationType.ParentPaymentBalanceFailedSecond]: NotificationCategory.Payment,
  [NotificationType.ParentPaymentBalanceFailedFinal]: NotificationCategory.Payment,
  [NotificationType.ParentPaymentCancelledNonPayment]: NotificationCategory.Payment,

  // Parent refund / dispute
  [NotificationType.ParentRefundIssued]: NotificationCategory.Refund,
  [NotificationType.ParentRefundFailed]: NotificationCategory.Refund,
  [NotificationType.ParentDisputeOpened]: NotificationCategory.Dispute,
  [NotificationType.ParentDisputeResolvedWon]: NotificationCategory.Dispute,
  [NotificationType.ParentDisputeResolvedLost]: NotificationCategory.Dispute,

  // Parent messaging / support
  [NotificationType.ParentMessagingNewFromCamp]: NotificationCategory.Message,
  [NotificationType.ParentSupportTicketReply]: NotificationCategory.Support,
  [NotificationType.ParentSupportTicketStatusChanged]: NotificationCategory.Support,

  // Parent wishlist / conversion (marketing for promotional drips, wishlist for engagement)
  [NotificationType.ParentWishlistEmpty]: NotificationCategory.Wishlist,
  [NotificationType.ParentWishlistItemsNoBooking7d]: NotificationCategory.Wishlist,
  [NotificationType.ParentWishlistItemsNoBooking21d]: NotificationCategory.Wishlist,
  [NotificationType.ParentWishlistPriceDrop]: NotificationCategory.Wishlist,
  [NotificationType.ParentWishlistFillingUp]: NotificationCategory.Wishlist,
  [NotificationType.ParentWishlistDeadlineApproaching]: NotificationCategory.Wishlist,
  [NotificationType.ParentWishlistEarlyBirdIncrease]: NotificationCategory.Wishlist,
  [NotificationType.ParentConversionPostDeclineAlternatives]: NotificationCategory.Marketing,
  [NotificationType.ParentCheckoutAbandoned3h]: NotificationCategory.Booking,
  [NotificationType.ParentCheckoutAbandoned2d]: NotificationCategory.Booking,
  [NotificationType.ParentCheckoutAbandoned4d]: NotificationCategory.Booking,
  [NotificationType.ParentCheckoutAbandoned6d]: NotificationCategory.Booking,

  // Parent pre/post-camp + reviews + profile
  [NotificationType.ParentPreCampChecklist14d]: NotificationCategory.Booking,
  [NotificationType.ParentPreCampPackingReminder7d]: NotificationCategory.Booking,
  [NotificationType.ParentPreCampDayBefore]: NotificationCategory.Booking,
  [NotificationType.ParentPostCampReviewRequest]: NotificationCategory.Review,
  [NotificationType.ParentPostCampReviewReminder]: NotificationCategory.Review,
  [NotificationType.ParentPostCampSurvey]: NotificationCategory.Review,
  [NotificationType.ParentReviewResponsePublished]: NotificationCategory.Review,
  [NotificationType.ParentReviewRemoved]: NotificationCategory.Review,
  [NotificationType.ParentProfileIncomplete]: NotificationCategory.Profile,

  // Provider onboarding
  [NotificationType.ProviderApplicationReceived]: NotificationCategory.Onboarding,
  [NotificationType.ProviderApplicationApproved]: NotificationCategory.Onboarding,
  [NotificationType.ProviderApplicationDeclined]: NotificationCategory.Onboarding,
  [NotificationType.ProviderDocumentReuploadRequested]: NotificationCategory.Onboarding,
  [NotificationType.ProviderAdditionalInfoRequired]: NotificationCategory.Onboarding,
  [NotificationType.ProviderConnectStripeNudge]: NotificationCategory.Onboarding,
  [NotificationType.ProviderConnectStripeReminder]: NotificationCategory.Onboarding,
  [NotificationType.ProviderProfileIncomplete]: NotificationCategory.Profile,
  [NotificationType.ProviderProfilePublished]: NotificationCategory.Profile,
  [NotificationType.ProviderFirstBooking]: NotificationCategory.Booking,
  [NotificationType.ProviderStripeDisconnected]: NotificationCategory.Onboarding,

  // Provider booking lifecycle
  [NotificationType.ProviderBookingRequest48hReminder]: NotificationCategory.Booking,
  [NotificationType.ProviderBookingRequestFinalReminder]: NotificationCategory.Booking,
  [NotificationType.ProviderBookingRequestExpired]: NotificationCategory.Booking,
  [NotificationType.ProviderBookingCancelledByFamily]: NotificationCategory.Booking,
  [NotificationType.ProviderBookingCancelledNonPayment]: NotificationCategory.Booking,
  [NotificationType.ProviderBookingRequestWithdrawn]: NotificationCategory.Booking,
  [NotificationType.ProviderBookingModified]: NotificationCategory.Booking,

  // Provider payments / payouts
  [NotificationType.ProviderPayoutScheduleConfirmed]: NotificationCategory.Payout,
  [NotificationType.ProviderBalanceCollected]: NotificationCategory.Payment,
  [NotificationType.ProviderPayoutReminder]: NotificationCategory.Payout,
  [NotificationType.ProviderPayoutReleased]: NotificationCategory.Payout,
  [NotificationType.ProviderPayoutFailed]: NotificationCategory.Payout,
  [NotificationType.ProviderPayoutDelayed]: NotificationCategory.Payout,

  // Provider refunds / disputes
  [NotificationType.ProviderRefundIssued]: NotificationCategory.Refund,
  [NotificationType.ProviderRefundFailed]: NotificationCategory.Refund,
  [NotificationType.ProviderReimbursementOwed]: NotificationCategory.Refund,
  [NotificationType.ProviderDisputeOpened]: NotificationCategory.Dispute,
  [NotificationType.ProviderDisputeEvidenceDue]: NotificationCategory.Dispute,
  [NotificationType.ProviderDisputeResolvedWon]: NotificationCategory.Dispute,
  [NotificationType.ProviderDisputeResolvedLost]: NotificationCategory.Dispute,

  // Provider messaging / reviews / support
  [NotificationType.ProviderMessagingNewFromFamily]: NotificationCategory.Message,
  [NotificationType.ProviderMessagingUnanswered24h]: NotificationCategory.Message,
  [NotificationType.ProviderMessagingUnanswered48h]: NotificationCategory.Message,
  [NotificationType.ProviderReviewNew]: NotificationCategory.Review,
  [NotificationType.ProviderReviewResponsePublished]: NotificationCategory.Review,
  [NotificationType.ProviderReviewNotRespondedReminder]: NotificationCategory.Review,
  [NotificationType.ProviderReviewRemoved]: NotificationCategory.Review,
  [NotificationType.ProviderSupportTicketReply]: NotificationCategory.Support,
  [NotificationType.ProviderSupportTicketStatusChanged]: NotificationCategory.Support,

  // Provider pre-camp + operations + seasonal
  [NotificationType.ProviderPreCampRosterReady]: NotificationCategory.Booking,
  [NotificationType.ProviderPreCampChecklist]: NotificationCategory.Booking,
  [NotificationType.ProviderPreCampDayBefore]: NotificationCategory.Booking,
  [NotificationType.ProviderPostCampWrap]: NotificationCategory.Booking,
  [NotificationType.ProviderSeasonEnded]: NotificationCategory.System,
  [NotificationType.ProviderProgramsNotUpdated30d]: NotificationCategory.System,
  [NotificationType.ProviderProgramsNotUpdated60d]: NotificationCategory.System,

  // Superadmin support tickets
  [NotificationType.SuperadminSupportTicketNew]: NotificationCategory.Support,
  [NotificationType.SuperadminSupportTicketReply]: NotificationCategory.Support,

  // Superadmin onboarding
  [NotificationType.SuperadminCampApplicationNew]: NotificationCategory.Onboarding,
  [NotificationType.SuperadminVerificationDocsUploaded]: NotificationCategory.Onboarding,
  [NotificationType.SuperadminVerificationDocsNotUploaded]: NotificationCategory.Onboarding,
  [NotificationType.SuperadminCampProfileIncomplete14d]: NotificationCategory.Onboarding,
  [NotificationType.SuperadminCampFirstListingLive]: NotificationCategory.Onboarding,

  // Superadmin booking lifecycle
  [NotificationType.SuperadminBookingCancelledNonPayment]: NotificationCategory.Booking,
  [NotificationType.SuperadminCampUnresponsiveExpiredRequests]: NotificationCategory.Booking,

  // Superadmin payments / disputes
  [NotificationType.SuperadminDisputeFiled]: NotificationCategory.Dispute,
  [NotificationType.SuperadminDisputeResolved]: NotificationCategory.Dispute,
  [NotificationType.SuperadminPayoutFailure]: NotificationCategory.Payout,
  [NotificationType.SuperadminPayoutRecoveryNeeded]: NotificationCategory.Payout,
  [NotificationType.SuperadminFundsPendingTransfer]: NotificationCategory.Payout,

  // Superadmin platform health
  [NotificationType.SuperadminCampStripeDisconnected]: NotificationCategory.System,
  [NotificationType.SuperadminCampDeletionRequested]: NotificationCategory.System,

  // Superadmin reviews
  [NotificationType.SuperadminReviewFlagged]: NotificationCategory.Review,

  // Superadmin seasonal / profile
  [NotificationType.SuperadminCampProfileNeedsAttention60d]: NotificationCategory.Profile,
  [NotificationType.SuperadminCampProfileDeactivated]: NotificationCategory.Profile,
}

/** Lookup helper with a `System` fallback so unmapped types still render. */
export function categoryFor(type: NotificationType | string): NotificationCategory {
  const mapped = NOTIFICATION_CATEGORY[type as NotificationType]
  return mapped ?? NotificationCategory.System
}

/**
 * Asserts every `NotificationType` enum value has an entry in
 * `NOTIFICATION_CATEGORY`. Called from a CI test in `wc-types` so a new type
 * shipped without a category mapping fails at PR time (rather than silently
 * falling through to the gray `System` bucket in the UI).
 *
 * Returns the list of missing types — empty array means OK. Throws on
 * `assert: true` so test callers can use `expect(() => ...).not.toThrow()`.
 */
export function findUnmappedNotificationTypes(): NotificationType[] {
  const allTypes = Object.values(NotificationType) as NotificationType[]
  const mapped = new Set(Object.keys(NOTIFICATION_CATEGORY))
  return allTypes.filter(t => !mapped.has(t))
}

export function assertNotificationCategoryExhaustiveness(): void {
  const missing = findUnmappedNotificationTypes()
  if (missing.length > 0) {
    throw new Error(
      `NOTIFICATION_CATEGORY is missing mappings for ${missing.length} NotificationType value(s): ${missing.join(', ')}`
    )
  }
}
