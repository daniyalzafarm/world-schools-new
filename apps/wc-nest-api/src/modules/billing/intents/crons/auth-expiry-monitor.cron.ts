import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ConfigService } from '../../../../config/config.service'
import { BookingGroupStatus, PaymentStatus } from '../../../../generated/client/enums'
import { PrismaService } from '../../../../prisma/prisma.service'
import { RedisService } from '../../../redis/redis.service'
import { StripeService } from '../../../stripe/stripe.service'
import { billingAudit } from '../../shared/audit-log.util'
import { buildIdempotencyKey } from '../../shared/idempotency.util'

const LOCK_KEY = 'cron:lock:auth-expiry-monitor'
const LOCK_TTL_SECONDS = 600
const BATCH_SIZE = 200

/**
 * Proactive monitor for the card-network authorization-window
 * cliff.
 *
 * Per Stripe's manual-capture documentation, an uncaptured authorization
 * expires after 7 days for Visa/Mastercard/Amex/Discover (CIT, card-not-
 * present). At that point Stripe silently flips the PaymentIntent to
 * `canceled` and releases the funds. A booking sitting in `request` /
 * `accepted` with a `requires_capture` Payment row past that window leaves
 * the parent confused ("I thought I was charged?") and the provider with no
 * way to capture even if they finally accept.
 *
 * This cron fires daily at 03:00 UTC and:
 *   1. Emits a structured "auth expiring soon" warning audit log line for
 *      every Payment whose `processingStartedAt` is older than
 *      `BILLING_AUTH_EXPIRY_WARN_DAYS` (default 5d) but NOT yet at the
 *      cancel threshold. The audit signal can be wired into provider
 *      notification emails (follow-up PR).
 *   2. Force-cancels every Payment whose `processingStartedAt` exceeds
 *      `BILLING_AUTH_EXPIRY_CANCEL_DAYS` (default 6d) by calling
 *      `paymentIntents.cancel` and flipping the BookingGroup to `expired`,
 *      ensuring the parent gets a clean "your hold was released" outcome
 *      instead of a Stripe-side silent void.
 *
 * Safety:
 *   - The cancel threshold MUST be < 7 days (validated in ConfigService).
 *   - We only act on `requires_capture` rows — any other status is either
 *     terminal (canceled/succeeded/failed) or already in the off-session
 *     flow which has its own retry / abandonment logic.
 *   - BookingGroup transition is gated on `status IN (request, accepted)`
 *     so we never roll back from `cancelled`/`fully_paid`/`disputed`/etc.
 *   - `paymentIntents.cancel` is idempotent on Stripe; if Stripe says the
 *     intent is already in a terminal state we proceed with the local row
 *     update anyway.
 */
@Injectable()
export class AuthExpiryMonitorCron {
  private readonly logger = new Logger(AuthExpiryMonitorCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService
  ) {}

  // 03:00 UTC every day — ops-quiet window with low contention.
  @Cron('0 3 * * *')
  async run(): Promise<void> {
    const redis = this.redis.getClient()
    const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    if (!acquired) {
      this.logger.debug('auth-expiry-monitor cron already running on another instance, skipping')
      return
    }
    try {
      await this.runBatch()
    } finally {
      await redis.del(LOCK_KEY)
    }
  }

  /**
   * Visible for testing — exposed without the lock so specs can drive batch
   * logic directly.
   */
  async runBatch(): Promise<{ warned: number; canceled: number }> {
    const cfg = this.configService.billingConfig
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const warnCutoff = new Date(now - cfg.authExpiryWarnDays * dayMs)
    const cancelCutoff = new Date(now - cfg.authExpiryCancelDays * dayMs)

    // Cancel-threshold rows first so a row that crosses both thresholds in a
    // single run is canceled, not just warned.
    const toCancel = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.requires_capture,
        processingStartedAt: { lte: cancelCutoff },
      },
      select: {
        id: true,
        bookingGroupId: true,
        stripePaymentIntentId: true,
        // Direct Charges: the PaymentIntent lives on the connected account,
        // so `paymentIntents.cancel` MUST be scoped via `{ stripeAccount }`.
        stripeAccountId: true,
      },
      take: BATCH_SIZE,
    })

    let canceled = 0
    for (const payment of toCancel) {
      try {
        await this.cancelExpiringAuth(payment)
        canceled++
      } catch (err) {
        this.logger.error(
          `auth-expiry-monitor: cancel failed for payment ${payment.id}: ${(err as Error).message}`,
          (err as Error).stack
        )
        // Don't break the batch — next pickup retries.
        continue
      }
    }

    // Warn rows: between warn cutoff and cancel cutoff. Exclude the rows we
    // just canceled by checking `processingStartedAt > cancelCutoff`.
    const toWarn = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.requires_capture,
        processingStartedAt: { lte: warnCutoff, gt: cancelCutoff },
      },
      select: {
        id: true,
        bookingGroupId: true,
        processingStartedAt: true,
      },
      take: BATCH_SIZE,
    })

    let warned = 0
    for (const payment of toWarn) {
      const ageDays = payment.processingStartedAt
        ? Math.floor((now - payment.processingStartedAt.getTime()) / dayMs)
        : null
      billingAudit(this.logger, 'auth_expiring_soon', {
        paymentId: payment.id,
        bookingGroupId: payment.bookingGroupId,
        ageDays,
        cancelInDays: cfg.authExpiryCancelDays - (ageDays ?? 0),
      })
      // Follow-up: wire into BillingPaymentNotificationsService once a
      // provider-side "your acceptance is needed within Xh" template ships.
      warned++
    }

    if (canceled > 0 || warned > 0) {
      this.logger.log(`auth-expiry-monitor: canceled=${canceled} warned=${warned}`)
    } else {
      this.logger.debug('auth-expiry-monitor: no candidates')
    }

    return { warned, canceled }
  }

  private async cancelExpiringAuth(payment: {
    id: string
    bookingGroupId: string
    stripePaymentIntentId: string | null
    stripeAccountId: string | null
  }): Promise<void> {
    if (payment.stripePaymentIntentId && payment.stripeAccountId) {
      try {
        await this.stripeService.client.paymentIntents.cancel(
          payment.stripePaymentIntentId,
          { cancellation_reason: 'abandoned' },
          {
            // Direct Charges: the intent lives on the connected account.
            stripeAccount: payment.stripeAccountId,
            // Stable per (payment, reason) so a retried run hits Stripe's
            // idempotency cache instead of producing a duplicate cancel call.
            idempotencyKey: buildIdempotencyKey(`pi:cancel:${payment.id}:auth-expired`, {
              reason: 'auth_window_expired',
            }),
          }
        )
      } catch (err) {
        // Idempotent: Stripe rejects cancel on already-terminal intents.
        // Log and continue with the local update so the booking advances.
        this.logger.warn(
          `auth-expiry-monitor: stripe cancel failed for ${payment.stripePaymentIntentId}: ${(err as Error).message}`
        )
      }
    } else if (payment.stripePaymentIntentId && !payment.stripeAccountId) {
      // Row has a PI id but no connected-account id — invariant violation.
      // Skip the Stripe call (we cannot scope it correctly) and proceed with
      // the local DB cleanup so the booking still advances.
      this.logger.error(
        `auth-expiry-monitor: payment ${payment.id} has stripePaymentIntentId but no stripeAccountId; ` +
          `skipping Stripe cancel and falling back to local-only cleanup`
      )
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.canceled,
        canceledAt: new Date(),
        failureCode: 'auth_window_expired',
        failureMessage:
          'Authorization window approaching expiry — proactively canceled by platform',
        processingStartedAt: null,
      },
    })

    // Flip the BookingGroup to `expired` ONLY from happy-path payment-flow
    // statuses. Never overwrite cancelled/fully_paid/declined/disputed/etc.
    await this.prisma.bookingGroup.updateMany({
      where: {
        id: payment.bookingGroupId,
        status: { in: [BookingGroupStatus.request, BookingGroupStatus.accepted] },
      },
      data: { status: BookingGroupStatus.expired },
    })

    billingAudit(this.logger, 'auth_window_expired', {
      paymentId: payment.id,
      bookingGroupId: payment.bookingGroupId,
      intentId: payment.stripePaymentIntentId,
    })
  }
}
