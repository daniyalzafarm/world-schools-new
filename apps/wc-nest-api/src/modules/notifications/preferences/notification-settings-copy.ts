/**
 * Curated, human-readable copy for the notification-preferences settings UI.
 *
 * Single source of truth for the per-notification **label** and **one-line
 * description** shown on the settings page (in the per-category "what's
 * included" modal). Keyed by `templateKey` (which equals the `NotificationType`
 * string value by catalog convention).
 *
 * `deriveLabel` (notification-preferences.service.ts) looks copy up here first
 * and falls back to a humanised heuristic for any unmapped key, so a new
 * notification still renders safely. `notification-settings-copy.spec.ts`
 * asserts every registered catalog entry has an entry here, so copy can't
 * silently drift.
 *
 * Tone: describe what the notification is, plainly, from the recipient's point
 * of view. Keep descriptions to a single short sentence.
 */
export interface NotificationCopy {
  label: string
  description: string
}

export const NOTIFICATION_SETTINGS_COPY: Record<string, NotificationCopy> = {
  // ==========================================================================
  // Parent
  // ==========================================================================
  'parent.booking.accepted': {
    label: 'Booking confirmed',
    description: 'A camp accepted your request and your place is confirmed.',
  },
  'parent.booking.requestSubmitted': {
    label: 'Request sent',
    description: 'Confirmation that your booking request was sent to the camp.',
  },
  'parent.booking.requestStillPending': {
    label: 'Request still pending',
    description: "A reminder that your request is still awaiting the camp's response.",
  },
  'parent.booking.declined': {
    label: 'Request declined',
    description: "A camp couldn't accept your request — no charge was made.",
  },
  'parent.booking.expired': {
    label: 'Request expired',
    description: "Your request expired because the camp didn't respond in time.",
  },
  'parent.booking.cancelled': {
    label: 'Booking cancelled',
    description: 'Your booking was cancelled, with any refund details.',
  },
  'parent.booking.modified': {
    label: 'Booking updated',
    description: 'Details of your confirmed booking changed.',
  },
  'parent.booking.requestWithdrawn': {
    label: 'Request withdrawn',
    description: 'Confirmation that you withdrew a pending booking request.',
  },
  'parent.checkout.abandoned3h': {
    label: 'Checkout reminder (3 hours)',
    description: 'A nudge to finish a booking you started a few hours ago.',
  },
  'parent.checkout.abandoned2d': {
    label: 'Checkout reminder (2 days)',
    description: 'A reminder to complete a booking you left unfinished.',
  },
  'parent.checkout.abandoned4d': {
    label: 'Checkout reminder (4 days)',
    description: "A follow-up about a booking you haven't completed.",
  },
  'parent.checkout.abandoned6d': {
    label: 'Checkout reminder (6 days)',
    description: 'A final reminder about an unfinished booking.',
  },
  'parent.conversion.postDeclineAlternatives': {
    label: 'Similar camps after a decline',
    description: 'Suggested alternative camps after a request was declined.',
  },
  'parent.payment.depositConfirmed': {
    label: 'Deposit received',
    description: 'Confirmation that your deposit payment was received.',
  },
  'parent.payment.balanceReminder14d': {
    label: 'Balance due in 14 days',
    description: 'A reminder that your remaining balance is due in two weeks.',
  },
  'parent.payment.balanceReminder7d': {
    label: 'Balance due in 7 days',
    description: 'A reminder that your remaining balance is due in a week.',
  },
  'parent.payment.balanceReminder3d': {
    label: 'Balance due in 3 days',
    description: 'A reminder that your remaining balance is due in three days.',
  },
  'parent.payment.balanceCharged': {
    label: 'Balance charged',
    description: 'Your remaining balance was successfully charged.',
  },
  'parent.payment.balanceFailedFirst': {
    label: 'Balance payment failed',
    description: "An attempt to collect your balance failed — we'll retry.",
  },
  'parent.payment.balanceFailedSecond': {
    label: 'Balance payment failed again',
    description: 'A second attempt to collect your balance failed.',
  },
  'parent.payment.balanceFailedFinal': {
    label: 'Final balance attempt failed',
    description: 'The last attempt to collect your balance failed.',
  },
  'parent.payment.cancelledNonPayment': {
    label: 'Booking cancelled (non-payment)',
    description: "Your booking was cancelled because the balance couldn't be collected.",
  },
  'parent.refund.issued': {
    label: 'Refund issued',
    description: 'A refund was issued to your original payment method.',
  },
  'parent.refund.failed': {
    label: 'Refund failed',
    description: "A refund to your payment method couldn't be processed.",
  },
  'parent.dispute.opened': {
    label: 'Dispute opened',
    description: 'A payment dispute (chargeback) was opened on your booking.',
  },
  'parent.dispute.resolvedWon': {
    label: 'Dispute resolved (in your favour)',
    description: 'A payment dispute on your booking was upheld in your favour.',
  },
  'parent.dispute.resolvedLost': {
    label: 'Dispute resolved (not upheld)',
    description: 'A payment dispute on your booking was not upheld; the charge stands.',
  },
  'parent.messaging.newFromCamp': {
    label: 'New message from a camp',
    description: 'A camp sent you a message.',
  },
  'parent.support.ticketReply': {
    label: 'Support replied',
    description: 'Our support team replied to your ticket.',
  },
  'parent.support.ticketStatusChanged': {
    label: 'Support ticket updated',
    description: 'The status of your support ticket changed.',
  },
  'parent.wishlist.empty': {
    label: 'Your wishlist is empty',
    description: 'A nudge to start saving camps you like.',
  },
  'parent.wishlist.itemsNoBooking7d': {
    label: 'Wishlist reminder (7 days)',
    description: "Camps you saved a week ago that you haven't booked.",
  },
  'parent.wishlist.itemsNoBooking21d': {
    label: 'Wishlist reminder (21 days)',
    description: "Camps you saved three weeks ago that you haven't booked.",
  },
  'parent.wishlist.priceDrop': {
    label: 'Price drop',
    description: 'A camp on your wishlist dropped in price.',
  },
  'parent.wishlist.fillingUp': {
    label: 'Wishlisted camp filling up',
    description: 'A camp on your wishlist is running low on spots.',
  },
  'parent.wishlist.deadlineApproaching': {
    label: 'Booking deadline approaching',
    description: "A wishlisted camp's booking deadline is near.",
  },
  'parent.wishlist.earlyBirdIncrease': {
    label: 'Early-bird price ending',
    description: 'An early-bird price on a wishlisted camp is about to rise.',
  },
  'parent.preCamp.checklist14d': {
    label: 'Pre-camp checklist (14 days)',
    description: 'A preparation checklist two weeks before camp starts.',
  },
  'parent.preCamp.packingReminder7d': {
    label: 'Packing reminder (7 days)',
    description: 'A packing reminder a week before camp.',
  },
  'parent.preCamp.dayBefore': {
    label: 'Day-before reminder',
    description: 'Final reminders the day before camp starts.',
  },
  'parent.postCamp.reviewRequest': {
    label: 'Leave a review',
    description: 'An invitation to review a camp after it ends.',
  },
  'parent.postCamp.reviewReminder': {
    label: 'Review reminder',
    description: 'A reminder to review a camp your child attended.',
  },
  'parent.postCamp.survey': {
    label: 'Post-camp survey',
    description: 'A short survey about your camp experience.',
  },
  'parent.review.responsePublished': {
    label: 'Camp responded to your review',
    description: 'A camp publicly responded to a review you left.',
  },
  'parent.review.removed': {
    label: 'Review removed',
    description: 'One of your reviews was removed by moderation.',
  },
  'parent.profile.incomplete': {
    label: 'Complete your profile',
    description: 'A reminder to finish setting up your profile.',
  },

  // ==========================================================================
  // Provider
  // ==========================================================================
  'provider.application.received': {
    label: 'Application received',
    description: 'We received your provider application.',
  },
  'provider.application.approved': {
    label: 'Application approved',
    description: 'Your provider application was approved.',
  },
  'provider.application.declined': {
    label: 'Application declined',
    description: 'Your provider application was declined.',
  },
  'provider.application.documentReuploadRequested': {
    label: 'Re-upload a document',
    description: 'A verification document needs to be re-uploaded.',
  },
  'provider.application.additionalInfoRequired': {
    label: 'More information needed',
    description: 'We need extra information to process your application.',
  },
  'provider.booking.requestReceived': {
    label: 'New booking request',
    description: 'A family requested to book — respond within 72 hours.',
  },
  'provider.booking.request48hReminder': {
    label: 'Request reminder (24h left)',
    description: 'A pending booking request is approaching its response deadline.',
  },
  'provider.booking.requestFinalReminder': {
    label: 'Final response reminder',
    description: 'A booking request is about to auto-expire without a response.',
  },
  'provider.booking.requestExpired': {
    label: 'Request expired',
    description: 'A booking request expired without a response.',
  },
  'provider.booking.requestWithdrawn': {
    label: 'Request withdrawn',
    description: 'A family withdrew a pending booking request.',
  },
  'provider.booking.accepted': {
    label: 'You accepted a booking',
    description: 'Confirmation that you accepted a booking request.',
  },
  'provider.booking.declined': {
    label: 'You declined a booking',
    description: 'Confirmation that you declined a booking request.',
  },
  'provider.booking.firstBooking': {
    label: 'Your first booking',
    description: 'You received your very first booking request.',
  },
  'provider.booking.modified': {
    label: 'Booking updated',
    description: 'Details of a confirmed booking changed.',
  },
  'provider.booking.cancelledByFamily': {
    label: 'Booking cancelled by family',
    description: 'A family cancelled a confirmed booking, with refund and payout impact.',
  },
  'provider.booking.cancelledNonPayment': {
    label: 'Booking cancelled (non-payment)',
    description: "A booking was cancelled after the family's balance couldn't be collected.",
  },
  'provider.payments.balanceCollected': {
    label: 'Balance collected',
    description: "A family's remaining balance was collected.",
  },
  'provider.refund.issued': {
    label: 'Refund issued',
    description: 'A refund was issued to a family.',
  },
  'provider.refund.failed': {
    label: 'Refund failed',
    description: "A refund to a family couldn't be processed.",
  },
  'provider.reimbursement.owed': {
    label: 'Reimbursement owed',
    description: 'You owe a reimbursement after a refund on already-disbursed funds.',
  },
  'provider.dispute.opened': {
    label: 'Dispute opened',
    description: 'A family opened a payment dispute (chargeback).',
  },
  'provider.dispute.evidenceDue': {
    label: 'Dispute evidence due',
    description: 'Evidence is needed to defend an open payment dispute.',
  },
  'provider.dispute.resolvedWon': {
    label: 'Dispute resolved (won)',
    description: 'A payment dispute was resolved in your favour.',
  },
  'provider.dispute.resolvedLost': {
    label: 'Dispute resolved (lost)',
    description: 'A payment dispute was resolved against you.',
  },
  'provider.messaging.newFromFamily': {
    label: 'New message from a family',
    description: 'A family sent you a message.',
  },
  'provider.messaging.unanswered24h': {
    label: 'Unanswered message (24h)',
    description: "A family's message has gone unanswered for a day.",
  },
  'provider.messaging.unanswered48h': {
    label: 'Unanswered message (48h)',
    description: "A family's message has gone unanswered for two days.",
  },
  'provider.review.new': {
    label: 'New review',
    description: 'A family left a new review.',
  },
  'provider.review.responsePublished': {
    label: 'Your review response is live',
    description: 'Your public response to a review was published.',
  },
  'provider.review.notRespondedReminder': {
    label: 'Unanswered review',
    description: 'A reminder to respond to a review.',
  },
  'provider.review.removed': {
    label: 'Review removed',
    description: 'A review was removed by moderation.',
  },
  'provider.support.ticketReply': {
    label: 'Support replied',
    description: 'Our support team replied to your ticket.',
  },
  'provider.support.ticketStatusChanged': {
    label: 'Support ticket updated',
    description: 'The status of your support ticket changed.',
  },
  'provider.onboarding.connectStripeNudge': {
    label: 'Connect Stripe',
    description: 'A reminder to connect Stripe so you can get paid.',
  },
  'provider.onboarding.connectStripeReminder': {
    label: 'Connect Stripe reminder',
    description: 'A follow-up to finish connecting your Stripe account.',
  },
  'provider.onboarding.stripeDisconnected': {
    label: 'Stripe disconnected',
    description: 'Your Stripe account was disconnected — payouts are paused.',
  },
  'provider.profile.published': {
    label: 'Profile published',
    description: 'Your provider profile is now live.',
  },
  'provider.profile.incomplete': {
    label: 'Complete your profile',
    description: 'A reminder to finish your provider profile.',
  },
  'provider.preCamp.rosterReady': {
    label: 'Roster ready',
    description: 'The camper roster for an upcoming session is ready.',
  },
  'provider.preCamp.checklist': {
    label: 'Pre-camp checklist',
    description: 'A preparation checklist before a session starts.',
  },
  'provider.preCamp.dayBefore': {
    label: 'Day-before reminder',
    description: 'Final reminders the day before a session starts.',
  },
  'provider.postCamp.wrap': {
    label: 'Post-camp wrap-up',
    description: 'A summary after a session ends.',
  },
  'provider.programs.notUpdated30d': {
    label: 'Programs not updated (30 days)',
    description: "Your programs haven't been updated in a month.",
  },
  'provider.programs.notUpdated60d': {
    label: 'Programs not updated (60 days)',
    description: "Your programs haven't been updated in two months.",
  },
  'provider.season.ended': {
    label: 'Season ended',
    description: 'Your camp season has ended.',
  },

  // ==========================================================================
  // Superadmin
  // ==========================================================================
  'superadmin.support.ticketNew': {
    label: 'New support ticket',
    description: 'A new support ticket was opened.',
  },
  'superadmin.support.ticketReply': {
    label: 'Support ticket reply',
    description: 'Someone replied on a support ticket.',
  },
  'superadmin.camp.applicationNew': {
    label: 'New camp application',
    description: 'A provider submitted a new camp application.',
  },
  'superadmin.camp.verificationDocsUploaded': {
    label: 'Verification docs uploaded',
    description: 'A camp uploaded verification documents for review.',
  },
  'superadmin.camp.verificationDocsNotUploaded': {
    label: 'Verification docs not uploaded',
    description: "A camp hasn't uploaded its required verification documents.",
  },
  'superadmin.camp.profileIncomplete14d': {
    label: 'Profile incomplete (14 days)',
    description: "A camp's profile has been incomplete for two weeks.",
  },
  'superadmin.camp.firstListingLive': {
    label: 'First listing live',
    description: 'A camp published its first live listing.',
  },
  'superadmin.booking.cancelledNonPayment': {
    label: 'Booking cancelled (non-payment)',
    description: "A booking was auto-cancelled after a family's balance couldn't be collected.",
  },
  'superadmin.camp.unresponsiveExpiredRequests': {
    label: 'Camp unresponsive to requests',
    description: 'A camp is letting booking requests expire without responding.',
  },
  'superadmin.dispute.filed': {
    label: 'Chargeback filed',
    description: 'A family filed a chargeback on a booking.',
  },
  'superadmin.dispute.resolved': {
    label: 'Dispute resolved',
    description: 'A payment dispute reached a resolution.',
  },
  'superadmin.payout.recoveryNeeded': {
    label: 'Clawback recovery needed',
    description: 'Funds need to be recovered from a camp after a refund.',
  },
  'superadmin.payout.fundsPendingTransfer': {
    label: 'Funds pending transfer',
    description: 'Collected funds are pending transfer to a camp.',
  },
  'superadmin.camp.stripeDisconnected': {
    label: 'Camp Stripe disconnected',
    description: "A camp's Stripe account was disconnected.",
  },
  'superadmin.camp.deletionRequested': {
    label: 'Account deletion requested',
    description: 'A camp requested account/listing deletion.',
  },
  'superadmin.review.flagged': {
    label: 'Review flagged',
    description: 'A review was flagged for moderation.',
  },
  'superadmin.camp.profileNeedsAttention60d': {
    label: 'Profile needs attention (60 days)',
    description: 'A camp profile has gone 60 days without attention.',
  },
  'superadmin.camp.profileDeactivated': {
    label: 'Profile deactivated',
    description: 'A camp profile was deactivated after prolonged inactivity.',
  },
}
