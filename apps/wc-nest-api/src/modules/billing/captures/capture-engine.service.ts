import { Injectable, Logger } from '@nestjs/common'
import { PaymentAuditEventType, ScheduledCaptureStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { CAPTURE_ELIGIBLE_STATUSES } from '../shared/capture-eligible-statuses'
import { PaymentAuditLogService } from '../shared/payment-audit-log.service'
import { PaymentIntentsService } from '../intents/payment-intents.service'

/** Retry window after a failed capture before it escalates to admin review (Spec v2.3 §7). */
export const CAPTURE_RETRY_DEADLINE_HOURS = 48

export type CaptureOutcome =
  | { status: 'completed' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

/**
 * Fires a single scheduled capture (Payments revamp, Spec v2.3). Invoked by the
 * delayed BullMQ worker AND by the hourly reconciliation cron — both converge
 * here, and the engine is the single place that enforces the safety rules:
 *
 *   - ACCEPTANCE GUARD (contractual invariant, CT v1.4 §5.2(f)/§7.4(d)): never
 *     fire on a booking that is not in a capture-eligible status or has no
 *     `respondedAt` (acceptance time). A pre-acceptance auth must never capture.
 *   - ATOMIC CLAIM: `scheduled → processing` via a status-guarded `updateMany`,
 *     so a racing job + cron can't both fire the same row.
 *   - IDEMPOTENCY: the underlying Stripe calls carry idempotency keys; "already
 *     captured" is success and "PaymentIntent canceled" (customer cancelled in
 *     the grace window) is a no-op.
 */
@Injectable()
export class CaptureEngineService {
  private readonly logger = new Logger(CaptureEngineService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentIntents: PaymentIntentsService,
    private readonly audit: PaymentAuditLogService
  ) {}

  async executeCapture(
    bookingGroupId: string,
    sequence: number,
    now: Date = new Date()
  ): Promise<CaptureOutcome> {
    const row = await this.prisma.bookingScheduledCapture.findUnique({
      where: { bookingGroupId_sequence: { bookingGroupId, sequence } },
      include: {
        bookingGroup: {
          select: { status: true, respondedAt: true, depositPaymentIntentId: true },
        },
      },
    })

    if (!row) return { status: 'skipped', reason: 'capture row not found' }
    if (row.status !== ScheduledCaptureStatus.scheduled) {
      // Already processing / completed / failed / cancelled — idempotent no-op.
      return { status: 'skipped', reason: `row status ${row.status}` }
    }

    // --- Acceptance guard (never fire before the provider accepts) ---
    const booking = row.bookingGroup
    if (!booking.respondedAt || !CAPTURE_ELIGIBLE_STATUSES.includes(booking.status)) {
      return { status: 'skipped', reason: `booking not capture-eligible (${booking.status})` }
    }
    // Defensive: never fire ahead of the resolved boundary (a job should not,
    // but the cron query and a manual call could).
    if (row.effectiveCaptureDate.getTime() > now.getTime()) {
      return { status: 'skipped', reason: 'not yet due' }
    }

    // --- Atomic claim: scheduled → processing ---
    const claim = await this.prisma.bookingScheduledCapture.updateMany({
      where: { id: row.id, status: ScheduledCaptureStatus.scheduled },
      data: { status: ScheduledCaptureStatus.processing },
    })
    if (claim.count === 0) {
      return { status: 'skipped', reason: 'claimed by another runner' }
    }

    const isDeposit = row.sequence === 0
    try {
      let stripePaymentIntentId: string | null = row.stripePaymentIntentId
      let paymentId: string | null = row.paymentId

      if (isDeposit) {
        // Captures the deposit PaymentIntent sitting in `requires_capture`.
        // Idempotent: returns [] if the webhook already captured it. Throws only
        // on a stale/expired auth or transient Stripe error (handled below).
        await this.paymentIntents.captureForBookingGroup(bookingGroupId)
        stripePaymentIntentId = booking.depositPaymentIntentId
      } else {
        // `chargeOffSession` swallows declines (records the Payment `failed`) and
        // persists `requires_action` for SCA — so act on the RETURNED status,
        // not on a throw (which only happens for transient infra errors).
        const result = await this.paymentIntents.chargeScheduledBalanceCapture(row.id)
        paymentId = result.paymentId
        stripePaymentIntentId = result.stripePaymentIntentId
        if (result.status !== 'succeeded') {
          return await this.recordFailure(row.id, bookingGroupId, sequence, now, {
            code: result.failureCode ?? result.status,
            message: result.failureMessage ?? `balance capture ${result.status}`,
          })
        }
      }

      await this.prisma.bookingScheduledCapture.update({
        where: { id: row.id },
        data: {
          status: ScheduledCaptureStatus.completed,
          stripePaymentIntentId,
          paymentId,
          failureCode: null,
          failureMessage: null,
        },
      })
      await this.audit.appendSafe({
        actor: 'system',
        eventType: isDeposit
          ? PaymentAuditEventType.deposit_captured
          : PaymentAuditEventType.balance_capture_fired,
        bookingGroupId,
        scheduledCaptureId: row.id,
        paymentIntentId: stripePaymentIntentId,
        priorStatus: ScheduledCaptureStatus.scheduled,
        newStatus: ScheduledCaptureStatus.completed,
      })
      return { status: 'completed' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const code = (err as { code?: string })?.code ?? null
      this.logger.warn(`capture ${bookingGroupId}/${sequence} threw: ${message}`)
      return this.recordFailure(row.id, bookingGroupId, sequence, now, { code, message })
    }
  }

  /** Mark a claimed capture row `failed` with a 48h retry window + audit. */
  private async recordFailure(
    rowId: string,
    bookingGroupId: string,
    sequence: number,
    now: Date,
    failure: { code: string | null; message: string }
  ): Promise<CaptureOutcome> {
    const retryDeadline = new Date(now.getTime() + CAPTURE_RETRY_DEADLINE_HOURS * 60 * 60 * 1000)
    await this.prisma.bookingScheduledCapture.update({
      where: { id: rowId },
      data: {
        status: ScheduledCaptureStatus.failed,
        failureCode: failure.code,
        failureMessage: failure.message.slice(0, 500),
        retryDeadline,
      },
    })
    await this.audit.appendSafe({
      actor: 'system',
      eventType: PaymentAuditEventType.balance_capture_failed,
      bookingGroupId,
      scheduledCaptureId: rowId,
      priorStatus: ScheduledCaptureStatus.processing,
      newStatus: ScheduledCaptureStatus.failed,
      reasonText: `${failure.code ?? 'error'}: ${failure.message}`.slice(0, 1000),
    })
    this.logger.warn(`capture ${bookingGroupId}/${sequence} failed: ${failure.message}`)
    return { status: 'failed', reason: failure.message }
  }
}
