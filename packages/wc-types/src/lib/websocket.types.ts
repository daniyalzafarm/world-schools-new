/**
 * WebSocket Event Type Contracts
 *
 * Single source of truth for all Socket.io event payloads exchanged between
 * the wc-nest-api backend and wc-* frontend applications.
 *
 * Server → Client events are what the backend emits and the frontend listens to.
 * Client → Server events are what the frontend emits and the backend handles.
 *
 * Using these types in both the NestJS gateway handlers and the frontend
 * WebSocket adapter gives compile-time safety against payload drift.
 */

// `BookingDeclineReason` now lives in `bookings.types.ts` (its domain home).
// Imported here only for the `WsBookingStatusChangedPayload.declineReason`
// field type. It is re-exported from the package root via index.ts.
import { BookingDeclineReason } from './bookings.types'

// ---------------------------------------------------------------------------
// Shared enums (no DB enum — extensible without Prisma migrations)
// ---------------------------------------------------------------------------

/**
 * Notification type catalog key. Uses the dotted-namespace
 * `<audience>.<domain>.<event>` convention. Entries are added incrementally
 * as new catalog entries land.
 *
 * The 7 legacy values have been removed. The 3 that were in use
 * (BookingAccepted/Declined/RequestReceived) are now
 * `parent.booking.accepted` + `provider.booking.accepted` (etc.).
 * The other 4 (BookingExpired, MessageNew, SupportTicketUpdated, SystemAlert)
 * were never emitted by any code path and were dropped without replacement.
 */
export enum NotificationType {
  // ---- parent : booking lifecycle ----
  ParentBookingRequestSubmitted = 'parent.booking.requestSubmitted',
  ParentBookingRequestStillPending = 'parent.booking.requestStillPending',
  ParentBookingAccepted = 'parent.booking.accepted',
  ParentBookingDeclined = 'parent.booking.declined',
  ParentBookingExpired = 'parent.booking.expired',
  ParentBookingCancelled = 'parent.booking.cancelled',
  ParentBookingModified = 'parent.booking.modified',
  ParentBookingRequestWithdrawn = 'parent.booking.requestWithdrawn',

  // ---- provider : booking lifecycle ----
  ProviderBookingAccepted = 'provider.booking.accepted',
  ProviderBookingDeclined = 'provider.booking.declined',
  ProviderBookingRequestReceived = 'provider.booking.requestReceived',

  // ---- parent : payment lifecycle ----
  ParentPaymentDepositConfirmed = 'parent.payment.depositConfirmed',
  ParentPaymentBalanceReminder14d = 'parent.payment.balanceReminder14d',
  ParentPaymentBalanceReminder7d = 'parent.payment.balanceReminder7d',
  ParentPaymentBalanceReminder3d = 'parent.payment.balanceReminder3d',
  ParentPaymentBalanceCharged = 'parent.payment.balanceCharged',
  ParentPaymentBalanceFailedFirst = 'parent.payment.balanceFailedFirst',
  ParentPaymentBalanceFailedSecond = 'parent.payment.balanceFailedSecond',
  ParentPaymentBalanceFailedFinal = 'parent.payment.balanceFailedFinal',
  ParentPaymentCancelledNonPayment = 'parent.payment.cancelledNonPayment',

  // ---- parent : refund / dispute ----
  ParentRefundIssued = 'parent.refund.issued',
  ParentRefundFailed = 'parent.refund.failed',
  ParentDisputeOpened = 'parent.dispute.opened',
  ParentDisputeResolvedWon = 'parent.dispute.resolvedWon',
  ParentDisputeResolvedLost = 'parent.dispute.resolvedLost',

  // ---- parent : messaging / support ----
  ParentMessagingNewFromCamp = 'parent.messaging.newFromCamp',
  ParentSupportTicketReply = 'parent.support.ticketReply',
  ParentSupportTicketStatusChanged = 'parent.support.ticketStatusChanged',

  // ---- parent : wishlist / conversion ----
  ParentWishlistEmpty = 'parent.wishlist.empty',
  ParentWishlistItemsNoBooking7d = 'parent.wishlist.itemsNoBooking7d',
  ParentWishlistItemsNoBooking21d = 'parent.wishlist.itemsNoBooking21d',
  ParentWishlistPriceDrop = 'parent.wishlist.priceDrop',
  ParentWishlistFillingUp = 'parent.wishlist.fillingUp',
  ParentWishlistDeadlineApproaching = 'parent.wishlist.deadlineApproaching',
  ParentWishlistEarlyBirdIncrease = 'parent.wishlist.earlyBirdIncrease',
  ParentConversionPostDeclineAlternatives = 'parent.conversion.postDeclineAlternatives',
  ParentCheckoutAbandoned3h = 'parent.checkout.abandoned3h',
  ParentCheckoutAbandoned2d = 'parent.checkout.abandoned2d',
  ParentCheckoutAbandoned4d = 'parent.checkout.abandoned4d',
  ParentCheckoutAbandoned6d = 'parent.checkout.abandoned6d',

  // ---- parent : pre/post-camp + reviews + profile ----
  ParentPreCampChecklist14d = 'parent.preCamp.checklist14d',
  ParentPreCampPackingReminder7d = 'parent.preCamp.packingReminder7d',
  ParentPreCampDayBefore = 'parent.preCamp.dayBefore',
  ParentPostCampReviewRequest = 'parent.postCamp.reviewRequest',
  ParentPostCampReviewReminder = 'parent.postCamp.reviewReminder',
  ParentPostCampSurvey = 'parent.postCamp.survey',
  ParentReviewResponsePublished = 'parent.review.responsePublished',
  ParentReviewRemoved = 'parent.review.removed',
  ParentProfileIncomplete = 'parent.profile.incomplete',

  // ---- provider : onboarding ----
  ProviderApplicationReceived = 'provider.application.received',
  ProviderApplicationApproved = 'provider.application.approved',
  ProviderApplicationDeclined = 'provider.application.declined',
  ProviderDocumentReuploadRequested = 'provider.application.documentReuploadRequested',
  ProviderAdditionalInfoRequired = 'provider.application.additionalInfoRequired',
  ProviderConnectStripeNudge = 'provider.onboarding.connectStripeNudge',
  ProviderConnectStripeReminder = 'provider.onboarding.connectStripeReminder',
  ProviderProfileIncomplete = 'provider.profile.incomplete',
  ProviderProfilePublished = 'provider.profile.published',
  ProviderFirstBooking = 'provider.booking.firstBooking',
  ProviderStripeDisconnected = 'provider.onboarding.stripeDisconnected',

  // ---- provider : booking lifecycle ----
  ProviderBookingRequest48hReminder = 'provider.booking.request48hReminder',
  ProviderBookingRequestFinalReminder = 'provider.booking.requestFinalReminder',
  ProviderBookingRequestExpired = 'provider.booking.requestExpired',
  ProviderBookingCancelledByFamily = 'provider.booking.cancelledByFamily',
  ProviderBookingCancelledNonPayment = 'provider.booking.cancelledNonPayment',
  ProviderBookingRequestWithdrawn = 'provider.booking.requestWithdrawn',
  ProviderBookingModified = 'provider.booking.modified',

  // ---- provider : payments / payouts ----
  ProviderPayoutScheduleConfirmed = 'provider.payouts.scheduleConfirmed',
  ProviderBalanceCollected = 'provider.payments.balanceCollected',
  ProviderPayoutReminder = 'provider.payouts.reminder',
  ProviderPayoutReleased = 'provider.payouts.released',
  ProviderPayoutFailed = 'provider.payouts.failed',
  ProviderPayoutDelayed = 'provider.payouts.delayed',

  // ---- provider : refunds / disputes ----
  ProviderRefundIssued = 'provider.refund.issued',
  ProviderRefundFailed = 'provider.refund.failed',
  ProviderReimbursementOwed = 'provider.reimbursement.owed',
  ProviderDisputeOpened = 'provider.dispute.opened',
  ProviderDisputeEvidenceDue = 'provider.dispute.evidenceDue',
  ProviderDisputeResolvedWon = 'provider.dispute.resolvedWon',
  ProviderDisputeResolvedLost = 'provider.dispute.resolvedLost',

  // ---- provider : messaging / reviews / support ----
  ProviderMessagingNewFromFamily = 'provider.messaging.newFromFamily',
  ProviderMessagingUnanswered24h = 'provider.messaging.unanswered24h',
  ProviderMessagingUnanswered48h = 'provider.messaging.unanswered48h',
  ProviderReviewNew = 'provider.review.new',
  ProviderReviewResponsePublished = 'provider.review.responsePublished',
  ProviderReviewNotRespondedReminder = 'provider.review.notRespondedReminder',
  ProviderReviewRemoved = 'provider.review.removed',
  ProviderSupportTicketReply = 'provider.support.ticketReply',
  ProviderSupportTicketStatusChanged = 'provider.support.ticketStatusChanged',

  // ---- provider : pre-camp + operations + seasonal ----
  ProviderPreCampRosterReady = 'provider.preCamp.rosterReady',
  ProviderPreCampChecklist = 'provider.preCamp.checklist',
  ProviderPreCampDayBefore = 'provider.preCamp.dayBefore',
  ProviderPostCampWrap = 'provider.postCamp.wrap',
  ProviderSeasonEnded = 'provider.season.ended',
  ProviderProgramsNotUpdated30d = 'provider.programs.notUpdated30d',
  ProviderProgramsNotUpdated60d = 'provider.programs.notUpdated60d',

  // ---- superadmin : support tickets (2) ----
  SuperadminSupportTicketNew = 'superadmin.support.ticketNew',
  SuperadminSupportTicketReply = 'superadmin.support.ticketReply',

  // ---- superadmin : onboarding (5) ----
  SuperadminCampApplicationNew = 'superadmin.camp.applicationNew',
  SuperadminVerificationDocsUploaded = 'superadmin.camp.verificationDocsUploaded',
  SuperadminVerificationDocsNotUploaded = 'superadmin.camp.verificationDocsNotUploaded',
  SuperadminCampProfileIncomplete14d = 'superadmin.camp.profileIncomplete14d',
  SuperadminCampFirstListingLive = 'superadmin.camp.firstListingLive',

  // ---- superadmin : booking lifecycle (2) ----
  SuperadminBookingCancelledNonPayment = 'superadmin.booking.cancelledNonPayment',
  SuperadminCampUnresponsiveExpiredRequests = 'superadmin.camp.unresponsiveExpiredRequests',

  // ---- superadmin : payments / disputes (5) ----
  SuperadminDisputeFiled = 'superadmin.dispute.filed',
  SuperadminDisputeResolved = 'superadmin.dispute.resolved',
  SuperadminPayoutFailure = 'superadmin.payout.failure',
  SuperadminPayoutRecoveryNeeded = 'superadmin.payout.recoveryNeeded',
  SuperadminFundsPendingTransfer = 'superadmin.payout.fundsPendingTransfer',

  // ---- superadmin : platform health (2) ----
  SuperadminCampStripeDisconnected = 'superadmin.camp.stripeDisconnected',
  SuperadminCampDeletionRequested = 'superadmin.camp.deletionRequested',

  // ---- superadmin : reviews (1) ----
  SuperadminReviewFlagged = 'superadmin.review.flagged',

  // ---- superadmin : seasonal / profile (2) ----
  SuperadminCampProfileNeedsAttention60d = 'superadmin.camp.profileNeedsAttention60d',
  SuperadminCampProfileDeactivated = 'superadmin.camp.profileDeactivated',
}

export enum NotificationEntityType {
  BookingGroup = 'booking_group',
  Conversation = 'conversation',
  Message = 'message',
  SupportTicket = 'support_ticket',
  Payment = 'payment',
  Refund = 'refund',
  Dispute = 'dispute',
  Payout = 'payout',
  PayoutTranche = 'payout_tranche',
  Reimbursement = 'reimbursement',
  Review = 'review',
  WishlistItem = 'wishlist_item',
  VerificationDocument = 'verification_document',
  Camp = 'camp',
  Session = 'session',
}

/**
 * High-level grouping used by:
 *  - the notifications filter UI (Bookings / Messages / etc.)
 *  - the notification preferences UI (one settings section per category)
 *  - the icon mapping on the notifications page
 *
 * Single source of truth — each `NotificationType` maps to exactly one
 * `NotificationCategory` via `NOTIFICATION_CATEGORY` (notification-categories.ts).
 */
export enum NotificationCategory {
  Booking = 'booking',
  Payment = 'payment',
  Refund = 'refund',
  Dispute = 'dispute',
  Payout = 'payout',
  Message = 'message',
  Review = 'review',
  Wishlist = 'wishlist',
  Profile = 'profile',
  Onboarding = 'onboarding',
  Support = 'support',
  System = 'system',
  Marketing = 'marketing',
}

export type WsPresenceStatus = 'online' | 'away' | 'offline'

// ---------------------------------------------------------------------------
// Server → Client payloads
// ---------------------------------------------------------------------------

export interface WsNewMessagePayload {
  message: WsMessageData
}

export interface WsMessageCreatedPayload {
  message: WsMessageData
  /** Client-generated temp ID used for optimistic update correlation */
  tempId: string
}

export interface WsMessageErrorPayload {
  tempId: string
  error: string
}

export interface WsMessageUpdatedPayload {
  conversationId: string
  messageId: string
  content: string
  editedAt: string
}

export interface WsMessageDeletedPayload {
  conversationId: string
  messageId: string
}

export interface WsTypingPayload {
  conversationId: string
  userId: string
}

export interface WsPresencePayload {
  userId: string
  status: WsPresenceStatus
  lastSeenAt: string
}

export interface WsReadReceiptPayload {
  messageId: string
  userId: string
  conversationId: string
  readAt?: string
  senderId?: string
}

export interface WsDeliveredReceiptPayload {
  messageId: string
  userId: string
  conversationId: string
  deliveredAt?: string
  senderId?: string
  deliveryLatencyMs?: number
}

export interface WsReactionPayload {
  conversationId: string
  messageId: string
  userId: string
  emoji: string
}

export interface WsConversationNewPayload {
  conversation: WsConversationData
}

export interface WsConversationAssignedPayload {
  conversationId: string
  assignedToUserId: string | null
  assignedByUserId: string
}

export interface WsBookingStatusPayload {
  bookingGroupId: string
  bookingGroupNumber: string
  newStatus: string
  previousStatus: string
  parentUserId: string
  providerId: string
  campName: string
  respondedAt?: string
  /// Captured charge total in major units. Set on `accepted` so the parent
  /// notification can include the exact amount taken from the card.
  chargedAmount?: number
  /// ISO-4217 currency code (Provider settlement currency). Always set;
  /// every booking is denominated in the provider's settlement currency.
  currency: string
  /// Session window for `declined` notifications so the parent sees which
  /// booking was rejected without an extra lookup.
  sessionStartDate?: string
  sessionEndDate?: string
  /// Decline reason from the controlled list (Provider Terms §5.1(h)(iii)).
  /// `declineReasonOther` free-text is intentionally NOT included — parent
  /// notifications surface a fixed reason label, not provider free-text.
  declineReason?: BookingDeclineReason
}

export interface WsBookingRequestReceivedPayload {
  bookingGroupId: string
  bookingGroupNumber: string
  parentUserId: string
  providerId: string
  campName: string
  requestExpiresAt: string
}

export interface WsNotificationPayload {
  id: string
  type: string
  title: string
  body?: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

export interface WsApplicationSubmittedPayload {
  providerId: string
  businessName: string
  submittedAt: string
  ownerUserId: string
}

export interface WsTicketStatusUpdatedPayload {
  ticketId: string
  status: string
  resolvedAt?: string | null
  closedAt?: string | null
  updatedAt: string
  changedByUserId: string
  requesterUserId?: string | null
  assignedToUserId?: string | null
}

export interface WsTicketAssignedPayload {
  ticketId: string
  assignedToUserId: string | null
  assignedByUserId: string
  assignedAt?: string | null
  requesterUserId?: string | null
  fromAssigneeUserId?: string | null
}

export interface WsOnboardingStatusChangedPayload {
  providerId: string
  newStatus: string
  previousStatus: string
  rejectionReason?: string | null
  rejectionCategory?: string | null
}

export interface WsHeartbeatPingPayload {
  serverTime: number
}

// ---------------------------------------------------------------------------
// Client → Server payloads
// ---------------------------------------------------------------------------

export interface WsSendMessagePayload {
  conversationId: string
  content: string
  tempId: string
  attachmentIds?: string[]
}

export interface WsJoinConversationPayload {
  conversationId: string
}

export interface WsLeaveConversationPayload {
  conversationId: string
}

export interface WsTypingStartPayload {
  conversationId: string
}

export interface WsTypingStopPayload {
  conversationId: string
}

export interface WsPresenceUpdatePayload {
  status: WsPresenceStatus
}

export interface WsMessageReadPayload {
  messageId: string
  conversationId: string
}

export interface WsMessageDeliveredPayload {
  messageId: string
  conversationId: string
  deliveryLatencyMs?: number
}

// Auth lifecycle payloads
export interface WsAuthTokenExpiringPayload {
  /** Milliseconds until token expiry */
  expiresInMs: number
}

export interface WsAuthTokenPayload {
  /** The refreshed access token */
  token: string
}

// ---------------------------------------------------------------------------
// Event name constants (single source of truth — use instead of raw strings)
// ---------------------------------------------------------------------------

/** Socket.io events emitted by the server and received by the client */
export const WsServerEvent = {
  // Messaging
  MessageNew: 'message:new',
  MessageCreated: 'message:created',
  MessageError: 'message:error',
  MessageUpdated: 'message:updated',
  MessageDeleted: 'message:deleted',
  TypingStart: 'typing:start',
  TypingStop: 'typing:stop',
  PresenceUpdate: 'presence:update',
  ReceiptRead: 'receipt:read',
  ReceiptDelivered: 'receipt:delivered',
  ReactionAdded: 'reaction:added',
  ReactionRemoved: 'reaction:removed',
  ConversationNew: 'conversation:new',
  ConversationAssigned: 'conversation:assigned',
  // Booking
  BookingStatusChanged: 'booking:status_changed',
  BookingRequestReceived: 'booking:request_received',
  // Notifications
  NotificationNew: 'notification:new',
  // Support tickets
  TicketStatusUpdated: 'ticket:statusUpdated',
  TicketAssigned: 'ticket:assigned',
  // System
  HeartbeatPing: 'heartbeat:ping',
  // Auth lifecycle
  /** Token is expiring within 4 minutes — client should refresh and send AuthToken */
  AuthTokenExpiring: 'auth:token_expiring',
  /** Token has expired and the session has been terminated */
  AuthExpired: 'auth:expired',
  /** Server confirms the new token is valid */
  AuthTokenRefreshed: 'auth:token_refreshed',
  // Onboarding
  OnboardingStatusChanged: 'onboarding:status_changed',
  // Provider applications (superadmin-facing)
  ApplicationSubmitted: 'application:submitted',
} as const

/** Socket.io events emitted by the client and received by the server */
export const WsClientEvent = {
  SendMessage: 'send_message',
  JoinConversation: 'join_conversation',
  LeaveConversation: 'leave_conversation',
  TypingStart: 'typing:start',
  TypingStop: 'typing:stop',
  PresenceUpdate: 'presence:update',
  MessageRead: 'message:read',
  MessageDelivered: 'message:delivered',
  HeartbeatPong: 'heartbeat:pong',
  /** Client sends a refreshed access token to keep the session alive */
  AuthToken: 'auth:token',
} as const

// ---------------------------------------------------------------------------
// Typed event maps (for use with socket.io TypeScript generics)
// ---------------------------------------------------------------------------

/** Events the server emits and the client listens to */
export interface WsServerToClientEvents {
  'message:new': (data: WsNewMessagePayload) => void
  'message:created': (data: WsMessageCreatedPayload) => void
  'message:error': (data: WsMessageErrorPayload) => void
  'message:updated': (data: WsMessageUpdatedPayload) => void
  'message:deleted': (data: WsMessageDeletedPayload) => void
  'typing:start': (data: WsTypingPayload) => void
  'typing:stop': (data: WsTypingPayload) => void
  'presence:update': (data: WsPresencePayload) => void
  'receipt:read': (data: WsReadReceiptPayload) => void
  'receipt:delivered': (data: WsDeliveredReceiptPayload) => void
  'reaction:added': (data: WsReactionPayload) => void
  'reaction:removed': (data: WsReactionPayload) => void
  'conversation:new': (data: WsConversationNewPayload) => void
  'conversation:assigned': (data: WsConversationAssignedPayload) => void
  'booking:status_changed': (data: WsBookingStatusPayload) => void
  'booking:request_received': (data: WsBookingRequestReceivedPayload) => void
  'notification:new': (data: WsNotificationPayload) => void
  'ticket:statusUpdated': (data: WsTicketStatusUpdatedPayload) => void
  'ticket:assigned': (data: WsTicketAssignedPayload) => void
  'heartbeat:ping': (data: WsHeartbeatPingPayload) => void
  'auth:token_expiring': (data: WsAuthTokenExpiringPayload) => void
  'auth:expired': (data: Record<string, never>) => void
  'auth:token_refreshed': (data: Record<string, never>) => void
  'onboarding:status_changed': (data: WsOnboardingStatusChangedPayload) => void
  'application:submitted': (data: WsApplicationSubmittedPayload) => void
}

/** Events the client emits and the server handles */
export interface WsClientToServerEvents {
  send_message: (data: WsSendMessagePayload) => void
  join_conversation: (data: WsJoinConversationPayload) => void
  leave_conversation: (data: WsLeaveConversationPayload) => void
  'typing:start': (data: WsTypingStartPayload) => void
  'typing:stop': (data: WsTypingStopPayload) => void
  'presence:update': (data: WsPresenceUpdatePayload) => void
  'message:read': (data: WsMessageReadPayload) => void
  'message:delivered': (data: WsMessageDeliveredPayload) => void
  'heartbeat:pong': (data: Record<string, never>) => void
  'auth:token': (data: WsAuthTokenPayload) => void
}

// ---------------------------------------------------------------------------
// Shared data shapes (referenced by event payloads above)
// ---------------------------------------------------------------------------

export interface WsMessageData {
  id: string
  conversationId: string
  senderId: string
  senderType: string
  content: string
  status: string
  messageType: string
  contentType: string
  createdAt: string
  updatedAt: string
  tempId?: string
  attachments?: WsAttachmentData[]
}

export interface WsAttachmentData {
  id: string
  url: string
  fileName: string
  fileSize: number
  mimeType: string
}

export interface WsConversationData {
  id: string
  type: string
  status: string
  contextType?: string
  contextId?: string
  createdAt: string
  updatedAt: string
}
