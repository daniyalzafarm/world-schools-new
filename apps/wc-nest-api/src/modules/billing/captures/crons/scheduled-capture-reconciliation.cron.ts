import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationType } from '@world-schools/wc-types'
import {
  BookingGroupStatus,
  PaymentAuditEventType,
  ScheduledCaptureStatus,
} from '../../../../generated/client/enums'
import { PrismaService } from '../../../../prisma/prisma.service'
import { notify } from '../../../notifications/dispatcher/notify'
import { RedisService } from '../../../redis/redis.service'
import { CAPTURE_ELIGIBLE_STATUSES } from '../../shared/capture-eligible-statuses'
import { PaymentAuditLogService } from '../../shared/payment-audit-log.service'
import { CaptureEngineService } from '../capture-engine.service'

const LOCK_KEY = 'cron:lock:scheduled-captures'
const LOCK_TTL_SECONDS = 600 // 10 min — comfortably longer than a worst-case batch
const BATCH_SIZE = 200
// A capture should move out of `processing` within seconds (a Stripe capture/
// charge is sub-second). A row still `processing` this long after its last
// write means the worker that claimed it died mid-fire — comfortably longer than
// any real capture latency or webhook-delivery delay, so a genuine success has
// already reconciled the row to `completed` and won't be seen here.
const STUCK_PROCESSING_MS = 15 * 60 * 1000 // 15 min

/**
 * Backstop for the delayed-job capture engine (Payments revamp, Spec v2.3).
 * Derives due captures from STATE — not from remembered BullMQ jobs — so a lost
 * job (Redis flush, worker crash mid-fire) is still captured at/after its
 * boundary. The delayed job and this cron may race the same row; the engine's
 * atomic claim + Stripe idempotency key make that harmless.
 *
 * Eligibility encodes the acceptance guard: a row is due only when its booking
 * is in a capture-eligible status AND has an acceptance time (`respondedAt`) —
 * the same `CAPTURE_ELIGIBLE_STATUSES` set used by the engine and the
 * off-session pickup query, so the three never drift.
 */
@Injectable()
export class ScheduledCaptureReconciliationCron {
  private readonly logger = new Logger(ScheduledCaptureReconciliationCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly engine: CaptureEngineService,
    private readonly eventEmitter: EventEmitter2,
    private readonly paymentAuditLog: PaymentAuditLogService
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const redis = this.redis.getClient()
    const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    if (!acquired) {
      this.logger.debug('scheduled-capture reconciliation already running elsewhere, skipping')
      return
    }
    try {
      await this.runBatch()
    } finally {
      await redis.del(LOCK_KEY)
    }
  }

  /**
   * Visible for testing — runs the batch without the Redis lock so specs can
   * drive it directly with a mocked Prisma + engine and a fixed `now`.
   */
  async runBatch(now: Date = new Date()): Promise<{
    processed: number
    completed: number
    failed: number
    escalated: number
    reapedDeposits: number
  }> {
    // Recover captures stuck in `processing` (a worker died mid-fire) BEFORE the
    // due-pickup, so a reset deposit becomes eligible again in this same run.
    const reaped = await this.reapStuckProcessing(now)

    const due = await this.prisma.bookingScheduledCapture.findMany({
      where: {
        status: ScheduledCaptureStatus.scheduled,
        effectiveCaptureDate: { lte: now },
        bookingGroup: {
          status: { in: CAPTURE_ELIGIBLE_STATUSES },
          respondedAt: { not: null },
        },
      },
      select: { bookingGroupId: true, sequence: true },
      orderBy: { effectiveCaptureDate: 'asc' },
      take: BATCH_SIZE,
    })

    let completed = 0
    let failed = 0
    for (const row of due) {
      const outcome = await this.engine.executeCapture(row.bookingGroupId, row.sequence, now)
      if (outcome.status === 'completed') completed++
      else if (outcome.status === 'failed') failed++
    }

    const escalated = await this.escalateStuckCaptures(now)

    if (
      due.length > 0 ||
      escalated > 0 ||
      reaped.resetDeposits > 0 ||
      reaped.escalatedBalance > 0
    ) {
      this.logger.log(
        `scheduled-capture reconciliation: processed=${due.length} completed=${completed} ` +
          `failed=${failed} escalated=${escalated + reaped.escalatedBalance} ` +
          `reapedDeposits=${reaped.resetDeposits}`
      )
    }
    return {
      processed: due.length,
      completed,
      failed,
      escalated: escalated + reaped.escalatedBalance,
      reapedDeposits: reaped.resetDeposits,
    }
  }

  /**
   * Recovers captures stuck in `processing` — a worker claimed the row
   * (`scheduled → processing`) then died before writing the terminal state, and
   * `attempts:1` means the BullMQ job won't retry. The recovery diverges by kind
   * because re-firing has different idempotency guarantees:
   *
   *   - DEPOSIT (sequence 0): reset to `scheduled`. Re-capturing the deposit
   *     PaymentIntent is idempotent — Stripe rejects a double-capture and the
   *     engine treats "already captured" as success — so an automatic retry is
   *     safe even if the first attempt actually captured on Stripe.
   *   - BALANCE (sequence > 0): escalate to `payment_review`, never auto-retry.
   *     An off-session re-charge forks the Stripe idempotency key (it embeds the
   *     incrementing `attempt`), so retrying a charge that may have already
   *     succeeded on Stripe risks a DOUBLE CHARGE. A late `payment_intent.succeeded`
   *     webhook reconciles the row to `completed` and clears the review instead.
   */
  private async reapStuckProcessing(
    now: Date
  ): Promise<{ resetDeposits: number; escalatedBalance: number }> {
    const staleBefore = new Date(now.getTime() - STUCK_PROCESSING_MS)
    const stuck = await this.prisma.bookingScheduledCapture.findMany({
      where: {
        status: ScheduledCaptureStatus.processing,
        updatedAt: { lte: staleBefore },
      },
      select: { id: true, bookingGroupId: true, sequence: true },
      take: BATCH_SIZE,
    })

    let resetDeposits = 0
    let escalatedBalance = 0
    for (const row of stuck) {
      if (row.sequence === 0) {
        // Status-guarded so a concurrent completion isn't clobbered.
        const res = await this.prisma.bookingScheduledCapture.updateMany({
          where: { id: row.id, status: ScheduledCaptureStatus.processing },
          data: { status: ScheduledCaptureStatus.scheduled },
        })
        if (res.count > 0) {
          resetDeposits++
          this.logger.warn(
            `capture ${row.bookingGroupId}/0 was stuck in processing — reset to scheduled for re-capture`
          )
        }
      } else {
        const flagged = await this.flagBookingForReview(
          row.bookingGroupId,
          now,
          'stuck_processing',
          'a scheduled balance capture stayed in processing past the stuck-window (worker died mid-fire)'
        )
        if (flagged) escalatedBalance++
      }
    }
    return { resetDeposits, escalatedBalance }
  }

  /**
   * Routes bookings whose capture has stayed `failed` past its 48h retry window
   * to the admin payment-review queue — NEVER auto-cancel (Spec v2.3 §7). The
   * balance-charge cron retries the linked Payment row within the window; a
   * successful retry syncs the capture to `completed` (via `markSucceeded`), so
   * a capture still `failed` at `retryDeadline` is genuinely stuck.
   *
   * Flipping to `payment_review` pauses the booking's other captures too (the
   * status leaves `CAPTURE_ELIGIBLE_STATUSES`) — we stop charging a card that is
   * failing until an admin triages.
   */
  private async escalateStuckCaptures(now: Date): Promise<number> {
    const stuck = await this.prisma.bookingScheduledCapture.findMany({
      where: {
        status: ScheduledCaptureStatus.failed,
        retryDeadline: { lte: now },
        bookingGroup: {
          paymentReviewStatus: null,
          status: { in: CAPTURE_ELIGIBLE_STATUSES },
        },
      },
      select: { bookingGroupId: true },
      distinct: ['bookingGroupId'],
      take: BATCH_SIZE,
    })

    let escalated = 0
    for (const row of stuck) {
      const flagged = await this.flagBookingForReview(
        row.bookingGroupId,
        now,
        'capture_failed',
        'scheduled capture stayed failed past its retry window'
      )
      if (flagged) escalated++
    }
    return escalated
  }

  /**
   * Status-guarded flip of a booking to `payment_review` (NEVER auto-cancel —
   * Spec v2.3 §7), with the append-only audit row + superadmin alert. Only flags
   * from a capture-eligible state, so it never overwrites an admin/cancelled/
   * disputed status and never re-escalates. Returns whether the flip happened.
   * Shared by the failed-past-retry escalation and the stuck-`processing` reaper.
   */
  private async flagBookingForReview(
    bookingGroupId: string,
    now: Date,
    paymentReviewStatus: string,
    reasonText: string
  ): Promise<boolean> {
    const res = await this.prisma.bookingGroup.updateMany({
      where: {
        id: bookingGroupId,
        paymentReviewStatus: null,
        status: { in: CAPTURE_ELIGIBLE_STATUSES },
      },
      data: {
        status: BookingGroupStatus.payment_review,
        paymentReviewStatus,
        paymentReviewFlaggedAt: now,
      },
    })
    if (res.count === 0) return false

    this.logger.warn(`booking ${bookingGroupId} → payment_review: ${reasonText}`)
    // Append-only audit (10-yr retention) + alert superadmins to triage. Both
    // are best-effort: a logging/notify failure must not abort the batch (the
    // status flip already committed above).
    await this.paymentAuditLog.appendSafe({
      actor: 'system',
      eventType: PaymentAuditEventType.payment_review_flagged,
      bookingGroupId,
      priorStatus: null,
      newStatus: BookingGroupStatus.payment_review,
      reasonText,
    })
    notify(this.eventEmitter, NotificationType.SuperadminPaymentReviewNeeded, {
      bookingGroupId,
    })
    return true
  }
}
