import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationType } from '@world-schools/wc-types'
import { ConfigService } from '../../../../config/config.service'
import { BookingGroupStatus, PaymentKind, PaymentStatus } from '../../../../generated/client/enums'
import { PrismaService } from '../../../../prisma/prisma.service'
import { notify } from '../../../notifications/dispatcher/notify'
import { RedisService } from '../../../redis/redis.service'
import { BillingPaymentNotificationsService } from '../notifications/billing-payment-notifications.service'
import { PaymentIntentsService } from '../payment-intents.service'

const LOCK_KEY = 'cron:lock:balance-charge'
const LOCK_TTL_SECONDS = 600 // 10 min — comfortably longer than a worst-case batch
const BATCH_SIZE = 100
// H5 audit fix: maxAttempts and STEP_UP_ABANDON_HOURS come from
// `ConfigService.billingConfig` (env-driven) rather than hardcoded constants.
// The `@Cron` decorator below still uses a literal `EVERY_30_MINUTES` because
// Nest schedule decorators don't accept dynamic values at decorate-time —
// `BILLING_BALANCE_CHARGE_CRON_MINUTES` is informational documentation; ops
// who change the env must also update the decorator (caught by code review,
// rare event).

/**
 * Drives every off-session charge: the initial pickup of `Payment` rows whose
 * `dueAt` has arrived (deposit→balance balance Payment, or no-deposit-due-later
 * SetupIntent placeholder) and the retry of rows whose first off-session
 * attempt failed within the 48h retry window.
 *
 * Why one cron for both: the underlying action is identical (`chargeOffSession`
 * is itself idempotent across both paths). Splitting "initial" and "retry"
 * into two crons would just mean two separate Redis locks competing for the
 * same set of rows.
 *
 * Idempotency:
 *  - Stripe-side: `chargeOffSession` builds an idempotency key keyed on
 *    `bookingGroupId + kind + attempt`, so a duplicate run of the same
 *    attempt collapses to the same intent on Stripe.
 *  - DB-side: `chargeOffSession` delegates a succeeded charge through
 *    `markSucceeded`, which short-circuits if the row's status is already
 *    `succeeded`. (This is the same guard that bit Phase 2's capture flow when
 *    the synchronous status write pre-empted the webhook — fixed there and
 *    intentionally mirrored here.)
 *  - Cron-side: the Redis lock prevents two instances of the cron from
 *    running concurrently. Within a run, rows are processed sequentially so
 *    the per-row `chargeOffSession` call sees the full prior state.
 *
 * On retry exhaustion (`attemptCount >= maxAttempts` after a final decline),
 * we transition the BookingGroup to `payment_failed` so the parent dashboard
 * surfaces a "couldn't charge your card" state and an admin can intervene.
 * The `updateMany`-with-status-guard is intentional — never roll back from
 * `cancelled`/`fully_paid`/etc., never overwrite an admin-driven status.
 */
@Injectable()
export class BalanceChargeCron {
  private readonly logger = new Logger(BalanceChargeCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly paymentIntents: PaymentIntentsService,
    private readonly notifications: BillingPaymentNotificationsService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async run(): Promise<void> {
    const redis = this.redis.getClient()
    const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    if (!acquired) {
      this.logger.debug('balance-charge cron already running on another instance, skipping')
      return
    }
    try {
      await this.runBatch()
    } finally {
      await redis.del(LOCK_KEY)
    }
  }

  /**
   * Visible for testing — exposed without the `@Cron` lock so specs can drive
   * the batch logic directly with mocked Prisma + PaymentIntentsService.
   */
  async runBatch(): Promise<{
    succeeded: number
    requiresAction: number
    failed: number
    exhausted: number
    stepUpAbandoned: number
  }> {
    const billingConfig = this.configService.billingConfig
    const maxAttempts = billingConfig.maxAttempts
    const stepUpAbandonHours = billingConfig.stepUpWindowHours

    const now = new Date()
    const stepUpAbandonCutoff = new Date(now.getTime() - stepUpAbandonHours * 60 * 60 * 1000)

    // Combined query: initial-due, retry-due, and stuck-step-up rows.
    // The three clauses are mutually exclusive at the row level (a row is
    // either pre-attempt with status=processing, post-decline with
    // status=failed, or stuck in requires_action), so there's no
    // double-counting.
    const candidates = await this.prisma.payment.findMany({
      where: {
        kind: { in: [PaymentKind.balance, PaymentKind.full] },
        OR: [
          // Initial off-session pickup. `processing` is the SetupIntent
          // placeholder state from `createSetupIntent`; the others cover
          // edge-case rows that landed in a non-final state at submit.
          {
            status: {
              in: [
                PaymentStatus.processing,
                PaymentStatus.requires_payment_method,
                PaymentStatus.requires_confirmation,
              ],
            },
            dueAt: { lte: now },
          },
          // Retry pickup — first attempt failed and we're inside the 48h
          // window. `chargeOffSession` set `nextRetryAt` after the decline.
          {
            status: PaymentStatus.failed,
            attemptCount: { lt: maxAttempts },
            nextRetryAt: { lte: now },
          },
          // Phase 3 fix Q3: stuck `requires_action` rows. The parent was
          // emailed a 3DS recovery link but didn't complete the challenge
          // within the 48h window. `updatedAt` reliably tracks "time
          // entered requires_action" because no other code path updates a
          // requires_action row (webhook handlers short-circuit on no-op).
          {
            status: PaymentStatus.requires_action,
            updatedAt: { lte: stepUpAbandonCutoff },
          },
        ],
      },
      // Select prior status so the loop can branch between
      // `chargeOffSession` (initial / retry) and `markStepUpAbandoned`
      // (stuck step-up).
      select: { id: true, status: true },
      take: BATCH_SIZE,
    })

    if (candidates.length === 0) {
      this.logger.debug('balance-charge cron: no candidates due')
      return { succeeded: 0, requiresAction: 0, failed: 0, exhausted: 0, stepUpAbandoned: 0 }
    }

    let succeeded = 0
    let requiresAction = 0
    let failed = 0
    let exhausted = 0
    let stepUpAbandoned = 0

    for (const { id, status: priorStatus } of candidates) {
      try {
        if (priorStatus === PaymentStatus.requires_action) {
          // Phase 3 fix Q3: stuck step-up. Cancel the live Stripe intent
          // and mark the row terminal. The post-state inspection below
          // sees status=failed && attemptCount>=maxAttempts and routes
          // through the existing exhausted branch (BookingGroup →
          // payment_failed + final-failure email).
          await this.paymentIntents.markStepUpAbandoned(id)
          stepUpAbandoned++
        } else {
          await this.paymentIntents.chargeOffSession(id)
        }
      } catch (err) {
        // chargeOffSession already swallows StripeCardError into a `failed`
        // row write; any error reaching here is a transient infra failure
        // (Stripe down, network, etc.). Log and move on — the row stays in
        // its prior state, the next cron run will retry.
        this.logger.error(
          `balance-charge: row ${id} (priorStatus=${priorStatus}) failed: ${(err as Error).message}`,
          (err as Error).stack
        )
        continue
      }

      // Inspect the row's post-state to decide on follow-up actions:
      // BookingGroup transition + caller-side notifications.
      const after = await this.prisma.payment.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          attemptCount: true,
          bookingGroupId: true,
        },
      })
      if (!after) continue

      if (after.status === PaymentStatus.succeeded) {
        succeeded++
        continue
      }
      if (after.status === PaymentStatus.requires_action) {
        requiresAction++
        // Email the parent a recovery link. The notifications service
        // retrieves a fresh `client_secret` from Stripe, builds the
        // /payment/authorize URL, and sends the template. Best-effort:
        // failures log but don't abort the rest of the batch.
        await this.notifications.notifyOffSessionRequiresAction(after.id)
        continue
      }
      if (after.status === PaymentStatus.failed) {
        failed++
        if (after.attemptCount >= maxAttempts) {
          exhausted++
          // Final decline: parent's card has been tried twice within the
          // 48h window. Move the BookingGroup to `payment_failed` so the
          // dashboard surfaces an admin-action state. Guard the update so
          // we never roll back from cancelled / fully_paid / disputed (an
          // operator or earlier flow already moved the booking out).
          await this.prisma.bookingGroup.updateMany({
            where: {
              id: after.bookingGroupId,
              status: {
                in: [
                  BookingGroupStatus.deposit_paid,
                  BookingGroupStatus.accepted,
                  BookingGroupStatus.request,
                ],
              },
            },
            data: { status: BookingGroupStatus.payment_failed },
          })
          await this.notifications.notifyPaymentFailedFinal(after.id)
          // v28 catalog dispatch — final-attempt failure. Distinct from the
          // legacy notifications.notifyPaymentFailedFinal email which the
          // catalog cutover will retire in a future phase; both fire today
          // since the legacy path still serves any consumer keyed off the
          // template id.
          notify(this.eventEmitter, NotificationType.ParentPaymentBalanceFailedFinal, {
            paymentId: after.id,
            bookingGroupId: after.bookingGroupId,
          })
        }
      }
    }

    this.logger.log(
      `balance-charge cron: processed=${candidates.length} succeeded=${succeeded} requires_action=${requiresAction} failed=${failed} exhausted=${exhausted} step_up_abandoned=${stepUpAbandoned}`
    )
    return { succeeded, requiresAction, failed, exhausted, stepUpAbandoned }
  }
}
