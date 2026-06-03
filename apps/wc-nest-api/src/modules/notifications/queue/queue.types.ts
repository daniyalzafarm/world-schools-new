/**
 * BullMQ payload contracts for the notifications subsystem.
 *
 * **Job context carries primitive IDs only** — never embedded entities. The
 * worker re-hydrates fresh state via `loadProps(prisma, ctx)` at execution
 * time, which matters for retries that fire days later (e.g. a scheduled
 * 14-day pre-camp reminder where the refund amount or session date may have
 * shifted between enqueue and fire).
 */

/** Channels a notification job can target. Plain string so adding `push` /
 *  `sms` later doesn't require a migration. */
export type NotificationChannel = 'in_app' | 'email'

/**
 * Primitive-IDs-only context shared across the dispatcher, worker, and
 * recipient resolvers. Catalog entries pick the fields they need; absent
 * fields are simply undefined.
 */
export interface NotificationContext {
  bookingGroupId?: string
  bookingId?: string
  sessionId?: string
  campId?: string
  providerId?: string
  parentUserId?: string
  paymentId?: string
  refundId?: string
  disputeId?: string
  reviewId?: string
  conversationId?: string
  messageId?: string
  supportTicketId?: string
  payoutEventId?: string
  payoutScheduleId?: string
  reimbursementId?: string
  wishlistItemId?: string
  verificationDocumentId?: string
  /** Free-form per-trigger extras (decline reason, charged amount, etc.).
   *  Prefer adding a typed field above when a value is reused across
   *  multiple triggers. */
  extra?: Record<string, unknown>
}

/**
 * Single BullMQ job for a single (recipient × dispatched channels) pair.
 * Each recipient gets their own job so per-user retries are isolated and
 * Bull Board surfaces per-user failures.
 */
export interface NotificationJobData {
  /** The `NotificationType` enum value (catalog key). */
  type: string
  recipientUserId: string
  /** Channels resolved at enqueue time after applying user preferences. */
  channels: NotificationChannel[]
  /** Primitive IDs only — see top-of-file. */
  context: NotificationContext
  /** ISO-8601 enqueue timestamp; used for staleness diagnostics. */
  enqueuedAt: string
  /** Deterministic per-(type, recipient, entity) key. Mirrored into the
   *  BullMQ jobId AND the NotificationDelivery uniqueness guard. */
  dedupeKey: string
  /** Origin: live dispatch, scheduled fan-out, or reconciliation backfill. */
  source: 'live' | 'scheduled' | 'reconciliation'
}
