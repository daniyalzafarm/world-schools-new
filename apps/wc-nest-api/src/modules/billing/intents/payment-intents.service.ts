import { randomUUID } from 'crypto'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NotificationType } from '@world-schools/wc-types'
import Stripe from 'stripe'
import { notify } from '../../notifications/dispatcher/notify'
import { ConfigService } from '../../../config/config.service'
import { Prisma } from '../../../generated/client/client'
import {
  BookingGroupStatus,
  CaptureMethod,
  PaymentKind,
  PaymentStatus,
  ScheduledCaptureStatus,
} from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { StripeConnectService } from '../../provider/stripe-connect/stripe-connect.service'
import { StripeService } from '../../stripe/stripe.service'
import { redactPii } from '../../stripe/stripe-error.util'
import { BillingPaymentNotificationsService } from './notifications/billing-payment-notifications.service'
import { billingAudit } from '../shared/audit-log.util'
import { buildIdempotencyKey } from '../shared/idempotency.util'
import {
  computeApplicationFee,
  fromStripeMinorUnits,
  toStripeMinorUnits,
} from '../shared/money.util'
import { withStripeErrors } from '../shared/with-stripe-errors.util'

type StripeClient = InstanceType<typeof Stripe>
type StripePaymentIntent = Awaited<ReturnType<StripeClient['paymentIntents']['create']>>
type StripeSetupIntent = Awaited<ReturnType<StripeClient['setupIntents']['create']>>
type StripePaymentMethod = Awaited<ReturnType<StripeClient['paymentMethods']['retrieve']>>

// Stripe SDK only exports `StripeConstructor` from the package entry, so
// `PaymentIntentCreateParams` is not importable. We extract the param
// types via `Parameters<...>` instead. Mirrors the workaround used in
// `provider/stripe-connect/stripe-connect.service.ts`.
type PaymentIntentCreateParams = Parameters<StripeClient['paymentIntents']['create']>[0]
type PaymentIntentCancelParams = NonNullable<
  Parameters<StripeClient['paymentIntents']['cancel']>[1]
>
type SetupIntentCreateParams = Parameters<StripeClient['setupIntents']['create']>[0]
type CustomerCreateParams = Parameters<StripeClient['customers']['create']>[0]
type CancellationReason = NonNullable<PaymentIntentCancelParams['cancellation_reason']>

/**
 * Subset of PaymentIntent statuses we actually translate. Anything else is logged
 * and stored verbatim — Stripe occasionally adds new statuses (e.g. `requires_action_3ds2`)
 * and we do not want to lose webhook events because the SDK union outpaced us.
 */
const STRIPE_STATUS_MAP: Record<string, PaymentStatus> = {
  requires_payment_method: PaymentStatus.requires_payment_method,
  requires_confirmation: PaymentStatus.requires_confirmation,
  requires_action: PaymentStatus.requires_action,
  processing: PaymentStatus.processing,
  requires_capture: PaymentStatus.requires_capture,
  succeeded: PaymentStatus.succeeded,
  canceled: PaymentStatus.canceled,
}

/**
 * Stripe error codes that mean the intent was already in a terminal state and
 * cannot be transitioned further (usually because the auth expired before
 * provider acceptance). We translate these into a typed domain error so the
 * caller can surface a "card hold expired, please re-enter" path.
 */
const STALE_INTENT_CODES = new Set([
  'payment_intent_unexpected_state',
  'payment_intent_authentication_failure',
  'payment_intent_incompatible_payment_method',
])

/**
 * Spec default: off-session balance-charge has a 48h retry window with two
 * attempts. Exported so the cron and any "give up immediately" short-circuits
 * in this service (e.g. no-saved-PM) share a single fallback when the
 * ConfigService env override hasn't been wired (e.g. very old tests). The
 * runtime value comes from `ConfigService.billingConfig.maxAttempts` (H5);
 * this constant is the safety net.
 */
export const MAX_OFF_SESSION_ATTEMPTS = 2

/**
 * Stripe statement_descriptor_suffix max length per
 * https://docs.stripe.com/get-started/account/statement-descriptors. Suffixes
 * are ASCII-only, no `<>\\'"*` characters, and combined with the connected
 * account's prefix must fit in the cardholder's statement line.
 */
const STATEMENT_DESCRIPTOR_SUFFIX_MAX = 22

function buildStatementDescriptorSuffix(bookingGroupNumber: string): string {
  // ASCII-only, drop any disallowed punctuation, uppercase for legibility.
  const sanitized = `BG-${bookingGroupNumber}`
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, '')
    .trim()
  return sanitized.slice(0, STATEMENT_DESCRIPTOR_SUFFIX_MAX)
}

/**
 * BookingGroup statuses where a balance off-session charge MUST NOT run.
 * The booking has already left the happy path (parent or admin cancelled,
 * provider declined, the request expired, refunds are in flight, retries
 * exhausted, dispute open) — charging the saved card now would create a
 * billing surprise we'd then have to undo.
 */
const TERMINAL_BOOKING_STATUSES_FOR_CHARGE: ReadonlySet<BookingGroupStatus> =
  new Set<BookingGroupStatus>([
    BookingGroupStatus.cancelled,
    BookingGroupStatus.declined,
    BookingGroupStatus.expired,
    BookingGroupStatus.fully_refunded,
    BookingGroupStatus.partially_refunded,
    BookingGroupStatus.payment_failed,
    BookingGroupStatus.disputed,
  ])

export class PaymentAuthorizationExpiredError extends Error {
  constructor(
    public readonly paymentId: string,
    message?: string
  ) {
    super(message ?? `Payment ${paymentId} authorization is no longer capturable`)
    this.name = 'PaymentAuthorizationExpiredError'
  }
}

function translateStatus(stripeStatus: string | null | undefined): PaymentStatus {
  if (!stripeStatus) return PaymentStatus.processing
  return STRIPE_STATUS_MAP[stripeStatus] ?? PaymentStatus.processing
}

interface AuthorizeResult {
  paymentId: string
  paymentIntentId: string
  clientSecret: string
  amount: string
  currency: string
}

interface SetupResult {
  paymentId: string
  setupIntentId: string
  clientSecret: string
}

@Injectable()
export class PaymentIntentsService {
  private readonly logger = new Logger(PaymentIntentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly billingNotifications: BillingPaymentNotificationsService
  ) {}

  /**
   * H5: runtime max attempts read from env (`BILLING_OFF_SESSION_MAX_ATTEMPTS`,
   * default 2). Exposed as a method so callers (cron + this service) share a
   * single resolution path; falling back to the hardcoded constant only when
   * ConfigService isn't injected (tests that pre-date the env wiring).
   */
  get maxOffSessionAttempts(): number {
    return this.configService?.billingConfig?.maxAttempts ?? MAX_OFF_SESSION_ATTEMPTS
  }

  /**
   * Creates a manual-capture PaymentIntent for the deposit on a BookingGroup
   * and returns its client secret. The card is **authorized** (not captured)
   * here; capture happens later when the provider accepts the booking. If the
   * provider declines or the request expires, `cancelForBookingGroup` voids
   * the auth and the parent is never charged.
   *
   * Idempotent: if a deposit `Payment` row already exists in a non-terminal
   * status for this group, returns its existing client secret rather than
   * creating a second intent. Idempotency-keyed at Stripe via a content hash
   * of the params for full retry safety.
   */
  async authorizeDeposit(bookingGroupId: string): Promise<AuthorizeResult> {
    return this.authorizeIntent(bookingGroupId, PaymentKind.deposit)
  }

  /**
   * Creates a manual-capture PaymentIntent for the full program price on a
   * no-deposit booking that's due now. Otherwise behaves identically to
   * `authorizeDeposit`.
   */
  async authorizeFull(bookingGroupId: string): Promise<AuthorizeResult> {
    return this.authorizeIntent(bookingGroupId, PaymentKind.full)
  }

  /**
   * Creates a SetupIntent so we can save the parent's payment method for an
   * off-session balance charge later. Used when the booking is no-deposit AND
   * the balance is more than the auth-window away from now (~90 days for
   * default A.2 flow). A placeholder `Payment(kind=full, status=processing,
   * dueAt=balanceDueAt, stripeSetupIntentId=si_xxx, stripePaymentIntentId=null)`
   * row is created so the balance-charge cron picks it up.
   *
   * Returns the SetupIntent client secret so the frontend can mount
   * `<PaymentElement />` in setup mode and call `stripe.confirmSetup`.
   */
  async createSetupIntent(bookingGroupId: string): Promise<SetupResult> {
    const group = await this.loadBookingGroupOrThrow(bookingGroupId)
    // Payments revamp (Spec v2.3): the SetupIntent only SAVES the card for the
    // off-session captures the engine fires at the policy boundaries — it no
    // longer depends on a single `balanceDueAt`. (Near-term no-deposit bookings
    // have no `balanceDueAt` and are now valid here.)
    if (!group.serviceFeeAmount) {
      // Strict — the booking-groups service must always snapshot the service fee
      // at submission. Falling back to anything else here would make the eventual
      // off-session charge incorrect (camp earnings off, app fee off).
      throw new BadRequestException(
        `BookingGroup ${group.id} has no serviceFeeAmount snapshot; cannot create SetupIntent`
      )
    }
    await this.stripeConnectService.assertProviderPaymentReady(group.providerId)
    const stripeAccountId = this.requireProviderStripeAccount(group)
    const connectCustomer = await this.ensureProviderConnectCustomer(
      group.parentId,
      group.providerId,
      stripeAccountId
    )

    // Idempotency at the application layer: if a SetupIntent placeholder
    // already exists for this group and is still pending, return it.
    const existing = await this.prisma.payment.findFirst({
      where: {
        bookingGroupId: group.id,
        kind: PaymentKind.full,
        stripeSetupIntentId: { not: null },
        status: { in: [PaymentStatus.processing, PaymentStatus.requires_confirmation] },
      },
    })
    if (existing?.stripeSetupIntentId) {
      // Direct Charges: SetupIntent lives on the connected account.
      const live = await withStripeErrors(() =>
        this.stripeService.client.setupIntents.retrieve(existing.stripeSetupIntentId!, undefined, {
          stripeAccount: existing.stripeAccountId,
        })
      )
      if (!live.client_secret) {
        throw new Error(`Stripe SetupIntent ${live.id} has no client_secret`)
      }
      return {
        paymentId: existing.id,
        setupIntentId: live.id,
        clientSecret: live.client_secret,
      }
    }

    const params: SetupIntentCreateParams = {
      customer: connectCustomer.stripeCustomerId,
      // Mirror the PaymentIntent path (see authorizeIntent): the booking page
      // collects via PaymentElement (automatic payment methods) and confirms
      // with `stripe.confirmSetup`, so the SetupIntent must also be created
      // with automatic_payment_methods — explicit payment_method_types is the
      // manual integration and Stripe rejects it as a mismatch at confirm time.
      // `allow_redirects: 'never'` locks down to non-redirect PMs to match the
      // booking page's `redirect: 'if_required'` deferred-confirm flow.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      usage: 'off_session',
      metadata: {
        bookingGroupId: group.id,
        kind: PaymentKind.full,
      },
    }
    const idempotencyKey = buildIdempotencyKey(`si:bg:${group.id}:full`, params)

    const setupIntent = await withStripeErrors(() =>
      this.stripeService.client.setupIntents.create(params, {
        idempotencyKey,
        stripeAccount: stripeAccountId,
      })
    )

    // Placeholder Payment row carrying the connect context (customer +
    // connected account) that the per-capture balance Payment rows inherit.
    //
    // Payments revamp (Spec v2.3): `dueAt` is intentionally NULL so the legacy
    // balance-charge cron (which picks up `dueAt <= now`) NEVER charges this
    // full-price placeholder — the scheduled-capture engine owns the actual
    // charges now. Without this, a no-deposit booking would be double-charged
    // (placeholder + per-capture rows).
    const payment = await this.prisma.payment.upsert({
      where: { idempotencyKey: `${idempotencyKey}:placeholder` },
      create: {
        bookingGroupId: group.id,
        kind: PaymentKind.full,
        stripePaymentIntentId: null,
        stripeSetupIntentId: setupIntent.id,
        providerConnectCustomerId: connectCustomer.id,
        amount: group.totalAmount,
        applicationFeeAmount: group.serviceFeeAmount,
        currency: this.requireCurrency(group),
        stripeAccountId,
        status: PaymentStatus.processing,
        captureMethod: CaptureMethod.automatic,
        dueAt: null,
        idempotencyKey: `${idempotencyKey}:placeholder`,
        processingStartedAt: new Date(),
      },
      update: { stripeSetupIntentId: setupIntent.id },
    })

    if (!setupIntent.client_secret) {
      throw new Error(`Stripe SetupIntent ${setupIntent.id} returned no client_secret`)
    }

    billingAudit(this.logger, 'setup_intent_created', {
      bookingGroupId: group.id,
      paymentId: payment.id,
      setupIntentId: setupIntent.id,
    })

    return {
      paymentId: payment.id,
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret,
    }
  }

  /**
   * Captures all `requires_capture` PaymentIntents on a BookingGroup. Called
   * when the provider accepts the booking. Idempotent — already-succeeded
   * payments are left alone, so calling this twice cannot double-charge.
   *
   * Returns the IDs of payments that were actually captured (vs. already-succeeded).
   *
   * Translates Stripe `payment_intent_unexpected_state` (and similar terminal-
   * state codes) into `PaymentAuthorizationExpiredError` so the booking-groups
   * service can surface a "card hold expired, please re-enter" recovery path
   * instead of a generic 400.
   */
  async captureForBookingGroup(bookingGroupId: string): Promise<string[]> {
    const candidates = await this.prisma.payment.findMany({
      where: {
        bookingGroupId,
        // Only kinds that ever live in `requires_capture` (manual-capture flow).
        kind: { in: [PaymentKind.deposit, PaymentKind.full] },
        status: PaymentStatus.requires_capture,
        stripePaymentIntentId: { not: null },
      },
    })

    const captured: string[] = []
    for (const payment of candidates) {
      let updated: StripePaymentIntent
      try {
        updated = await this.stripeService.client.paymentIntents.capture(
          payment.stripePaymentIntentId!,
          undefined,
          {
            idempotencyKey: buildIdempotencyKey(`pi:capture:${payment.id}`, {
              attempt: payment.attemptCount,
            }),
            // Direct Charges: the intent lives on the connected account.
            stripeAccount: payment.stripeAccountId,
          }
        )
      } catch (err) {
        if (
          err instanceof Stripe.errors.StripeInvalidRequestError &&
          err.code &&
          STALE_INTENT_CODES.has(err.code)
        ) {
          // Auth no longer capturable — most likely the card hold expired.
          // Mark the row canceled and surface a typed error so the caller can
          // route the parent to a re-entry flow.
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.canceled,
              canceledAt: new Date(),
              failureCode: err.code,
              failureMessage: redactPii(err.message ?? ''),
              processingStartedAt: null,
            },
          })
          billingAudit(this.logger, 'capture_stale_auth', {
            bookingGroupId,
            paymentId: payment.id,
            stripeCode: err.code,
          })
          throw new PaymentAuthorizationExpiredError(payment.id, err.message)
        }
        // Any other Stripe error → typed Nest exception.
        return withStripeErrors(() => Promise.reject(err))
      }

      // When capture returns `succeeded`, run the SAME path the webhook will
      // take — `markSucceeded` is responsible for the full transition (Payment
      // row update + `BookingGroup.paidAmount` increment + `accepted →
      // deposit_paid` / `fully_paid` advance + saved-PM upsert + audit log).
      // Doing the row write here directly would set `Payment.status =
      // succeeded` synchronously and the webhook's idempotency check
      // (`if status === succeeded return`) would then short-circuit before the
      // BookingGroup ever advances. `markSucceeded` is itself idempotent on a
      // re-run (the eventual webhook), so the second invocation no-ops cleanly.
      //
      // For the rare non-succeeded post-capture status (e.g. `requires_action`
      // when a 3DS step-up is triggered post-capture), persist the status
      // directly and let the eventual webhook drive the advance.
      if (updated.status === 'succeeded') {
        await this.markSucceeded(updated)
      } else {
        // Status-guarded claim — capture-API and webhook can race; never roll
        // a terminal `canceled`/`failed`/`succeeded` row back to an in-flight
        // status just because the synchronous capture call returned one.
        await this.prisma.payment.updateMany({
          where: {
            id: payment.id,
            status: {
              in: [PaymentStatus.requires_capture, PaymentStatus.processing],
            },
          },
          data: {
            status: translateStatus(updated.status),
            stripeChargeId:
              typeof updated.latest_charge === 'string'
                ? updated.latest_charge
                : (updated.latest_charge?.id ?? payment.stripeChargeId),
          },
        })
      }
      captured.push(payment.id)
    }

    if (captured.length > 0) {
      billingAudit(this.logger, 'capture', {
        bookingGroupId,
        captured: captured.length,
      })
    }
    return captured
  }

  /**
   * Cancels every open (non-succeeded, non-canceled) PaymentIntent for a
   * BookingGroup. Used when the provider declines or the request expires —
   * the card auth is voided and the parent never sees a charge.
   *
   * Idempotent — Stripe accepts `paymentIntents.cancel` on already-canceled
   * intents and returns the existing object. We additionally skip succeeded
   * payments because Stripe rejects cancel on those (succeeded must be
   * refunded instead, which is a different flow).
   *
   * The query is intentionally not scoped by `kind`. A BookingGroup that has
   * both an outstanding deposit auth AND a SetupIntent placeholder for the
   * balance must have BOTH of them voided when the provider declines.
   */
  async cancelForBookingGroup(
    bookingGroupId: string,
    reason: CancellationReason = 'abandoned'
  ): Promise<string[]> {
    const candidates = await this.prisma.payment.findMany({
      where: {
        bookingGroupId,
        status: {
          in: [
            PaymentStatus.requires_payment_method,
            PaymentStatus.requires_confirmation,
            PaymentStatus.requires_action,
            PaymentStatus.requires_capture,
            PaymentStatus.processing,
          ],
        },
      },
    })

    const canceled: string[] = []
    for (const payment of candidates) {
      // SetupIntent placeholder rows have no real PaymentIntent yet. Cancel
      // the SetupIntent on Stripe (so the card cannot be later off-session
      // charged) and mark our row canceled.
      if (!payment.stripePaymentIntentId && payment.stripeSetupIntentId) {
        try {
          // Direct Charges: SetupIntent lives on the connected account.
          await this.stripeService.client.setupIntents.cancel(
            payment.stripeSetupIntentId,
            undefined,
            { stripeAccount: payment.stripeAccountId }
          )
        } catch (err) {
          if (
            !(err instanceof Stripe.errors.StripeInvalidRequestError) ||
            err.code !== 'setup_intent_unexpected_state'
          ) {
            throw err
          }
          // Already in a terminal state — fine.
        }
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.canceled,
            canceledAt: new Date(),
            processingStartedAt: null,
          },
        })
        canceled.push(payment.id)
        continue
      }

      if (!payment.stripePaymentIntentId) {
        // Defensive: row with neither real PI nor SetupIntent — shouldn't
        // happen, but mark canceled and move on so the booking can progress.
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.canceled,
            canceledAt: new Date(),
            processingStartedAt: null,
          },
        })
        canceled.push(payment.id)
        continue
      }

      const updated = await withStripeErrors(() =>
        this.stripeService.client.paymentIntents.cancel(
          payment.stripePaymentIntentId!,
          { cancellation_reason: reason },
          {
            idempotencyKey: buildIdempotencyKey(`pi:cancel:${payment.id}`, { reason }),
            // Direct Charges: the intent lives on the connected account.
            stripeAccount: payment.stripeAccountId,
          }
        )
      )
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: translateStatus(updated.status),
          canceledAt: new Date(),
          processingStartedAt: null,
        },
      })
      canceled.push(payment.id)
    }

    if (canceled.length > 0) {
      billingAudit(this.logger, 'cancel', {
        bookingGroupId,
        canceled: canceled.length,
        reason,
      })
    }
    return canceled
  }

  /**
   * Off-session charge for a balance/full Payment that was created via SetupIntent.
   * Called by `balance-charge.cron.ts` when `dueAt <= now`. Each call is a fresh
   * attempt; the idempotency key includes `attemptCount` so retries do not collide
   * with the prior failed attempt's key.
   *
   * On `requires_action` (3DS step-up), we send the parent a recovery link instead
   * of failing the booking. On a hard decline, we record the failure and let the
   * cron schedule the next retry within the spec's 48h / 2-attempt window.
   *
   * Concurrency note: the cron wraps batch iteration in a Redis lock; the
   * Stripe idempotency key here is the second line of defense (same params hash
   * → cached response within 24h, so a second call collapses to the same intent
   * id).
   */
  async chargeOffSession(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { bookingGroup: { include: { parent: true, provider: true } } },
    })
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`)

    // short-circuit if the booking has left the happy path.
    // Charging now would create a billing surprise we'd have to refund. Mark
    // the Payment row terminal so the cron's `status in [...]` query stops
    // matching it on subsequent runs (without this write the cron would
    // re-pick the row every 30 min and reprint the same skip).
    if (TERMINAL_BOOKING_STATUSES_FOR_CHARGE.has(payment.bookingGroup.status)) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.canceled,
          canceledAt: new Date(),
          failureCode: 'booking_terminal',
          failureMessage: `BookingGroup is in terminal status ${payment.bookingGroup.status}`,
          processingStartedAt: null,
        },
      })
      billingAudit(this.logger, 'off_session_skipped_terminal_booking', {
        paymentId: payment.id,
        bookingGroupId: payment.bookingGroupId,
        bookingStatus: payment.bookingGroup.status,
      })
      return
    }

    // Direct Charges: the customer + saved PM live on the provider's connected
    // account, scoped per `(parent, provider)` via `ProviderConnectCustomer`.
    const connectCustomer = payment.providerConnectCustomerId
      ? await this.prisma.providerConnectCustomer.findUnique({
          where: { id: payment.providerConnectCustomerId },
        })
      : null
    if (!connectCustomer) {
      throw new BadRequestException(
        `Payment ${payment.id} has no providerConnectCustomer; cannot charge off-session`
      )
    }

    const defaultPm = await this.prisma.savedPaymentMethod.findFirst({
      where: {
        providerConnectCustomerId: connectCustomer.id,
        isDefault: true,
        archivedAt: null,
      },
    })
    // instead of throwing (which the cron would log as a
    // transient error and then retry every 30 min indefinitely), mark the
    // row terminal with `attemptCount=maxOffSessionAttempts` so the cron's
    // post-state branch flips the BookingGroup to `payment_failed` and
    // dispatches the final-failure email. Future cron runs will skip this
    // row because retry-pickup requires `attemptCount < MAX`.
    if (!defaultPm) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.failed,
          attemptCount: this.maxOffSessionAttempts,
          failureCode: 'no_payment_method',
          failureMessage: 'Parent has no saved payment method on file',
          processingStartedAt: null,
        },
      })
      billingAudit(this.logger, 'off_session_no_pm', {
        paymentId: payment.id,
        bookingGroupId: payment.bookingGroupId,
      })
      return
    }

    // precheck that the saved PM is still attached to the Stripe
    // customer. The parent may have detached it directly via Stripe Customer
    // Portal (or Stripe Dashboard) — our `payment_method.detached` webhook
    // handler eventually archives the row, but in the racy window the cron
    // would call `paymentIntents.create` only to get a noisy `payment_method
    // missing` decline indistinguishable from a real card decline. The
    // precheck turns that into a clean abandonment path with a single audit
    // log line and no fake decline.
    try {
      // Direct Charges: PM lives on the connected account.
      await this.stripeService.client.paymentMethods.retrieve(
        defaultPm.stripePaymentMethodId,
        undefined,
        { stripeAccount: payment.stripeAccountId }
      )
    } catch (err) {
      if (
        err instanceof Stripe.errors.StripeInvalidRequestError &&
        err.code === 'resource_missing'
      ) {
        await this.prisma.savedPaymentMethod.updateMany({
          where: { stripePaymentMethodId: defaultPm.stripePaymentMethodId, archivedAt: null },
          data: { archivedAt: new Date(), isDefault: false },
        })
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.failed,
            attemptCount: this.maxOffSessionAttempts,
            failureCode: 'payment_method_detached',
            failureMessage: 'Parent’s saved payment method was detached before charge',
            processingStartedAt: null,
          },
        })
        billingAudit(this.logger, 'off_session_pm_detached', {
          paymentId: payment.id,
          bookingGroupId: payment.bookingGroupId,
          paymentMethodId: defaultPm.stripePaymentMethodId,
        })
        return
      }
      // Any other failure (auth, network, rate limit) is transient — let it
      // bubble so the cron's outer error log fires and the row stays in its
      // prior state for the next pickup. We do NOT mark `failed` here because
      // we don't know if the PM is actually missing.
      throw err
    }

    // use the LIVE variant here. The cached
    // `assertProviderPaymentReady` is fine for synchronous booking-create
    // flows (where the parent will see any error on the next page load), but
    // off-session balance charges fire up to 90 days after submit and the
    // parent isn't watching. A stale cache could mean we attempt a charge
    // against a deauthorized connected account, which surfaces as a silent
    // failure for the parent and a missed payout for the camp. The live
    // call re-checks the connected account's `charges_enabled` /
    // `payouts_enabled` directly against Stripe and refreshes the cached
    // flags as a side effect.
    await this.stripeConnectService.assertProviderPaymentReadyLive(payment.bookingGroup.providerId)

    const attempt = payment.attemptCount + 1
    const params: PaymentIntentCreateParams = {
      amount: toStripeMinorUnits(payment.amount, payment.currency),
      currency: payment.currency,
      // Customer + PM are on the connected account; the `stripeAccount` request
      // option below routes both to the right place.
      customer: connectCustomer.stripeCustomerId,
      payment_method: defaultPm.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      capture_method: 'automatic',
      // Direct Charges: platform's cut. See `authorizeIntent` for the
      // rationale on dropping `on_behalf_of`/`transfer_data`.
      application_fee_amount: toStripeMinorUnits(payment.applicationFeeAmount, payment.currency),
      // Same suffix logic as authorizeIntent so the parent's statement line
      // for the off-session balance charge matches the earlier deposit charge
      // — they recognise both as the same booking.
      statement_descriptor_suffix: buildStatementDescriptorSuffix(
        payment.bookingGroup.bookingGroupNumber
      ),
      // Operator-facing dashboard label. `attempt` distinguishes retries from
      // the initial cron pass when triaging declined-then-recovered charges.
      description: `World Camps booking ${payment.bookingGroup.bookingGroupNumber} (${payment.kind}, attempt ${attempt})`,
      metadata: {
        bookingGroupId: payment.bookingGroupId,
        paymentId: payment.id,
        kind: payment.kind,
        attempt: String(attempt),
      },
    }
    const idempotencyKey = buildIdempotencyKey(
      `pi:bg:${payment.bookingGroupId}:${payment.kind}:attempt:${attempt}`,
      params
    )

    let intent: StripePaymentIntent
    try {
      intent = await this.stripeService.client.paymentIntents.create(params, {
        idempotencyKey,
        stripeAccount: payment.stripeAccountId,
      })
    } catch (err) {
      // Stripe throws StripeCardError on off-session decline. Persist the failure
      // metadata and let the retry cron pick this up at `nextRetryAt`. Do NOT
      // call `mapStripeError` here — that would 4xx the cron worker, masking the
      // real outcome. The decline is a business event, not an HTTP error.
      if (err instanceof Stripe.errors.StripeCardError) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.failed,
            attemptCount: attempt,
            failureCode: err.code ?? null,
            // Stripe decline messages can echo card metadata
            // (last 4, BIN). Run through `redactPii` before persisting since
            // this column is rendered to admin UIs.
            failureMessage: redactPii(err.message ?? ''),
            nextRetryAt: this.computeNextRetry(attempt),
            processingStartedAt: null,
          },
        })
        billingAudit(this.logger, 'off_session_decline', {
          paymentId: payment.id,
          attempt,
          stripeCode: err.code ?? null,
        })
        // v28 catalog dispatch — 1st / 2nd retry failure. The cron emits the
        // `Final` variant after `runBatch` flips the BookingGroup status, so
        // we only fire the per-attempt failures here.
        if (attempt === 1 || attempt === 2) {
          notify(
            this.eventEmitter,
            attempt === 1
              ? NotificationType.ParentPaymentBalanceFailedFirst
              : NotificationType.ParentPaymentBalanceFailedSecond,
            {
              paymentId: payment.id,
              bookingGroupId: payment.bookingGroupId,
            }
          )
        }
        return
      }
      // Any other Stripe error is a transient infra failure — let it bubble.
      throw err
    }

    // Always set `stripePaymentIntentId` + `attemptCount` first so any webhook
    // delivery (which races our follow-up writes here) finds the row by its
    // primary index and our markSucceeded/markFailed handlers operate on
    // accurate state. The `metadata.paymentId` fallback in
    // `findPaymentForIntent` covers the narrow window before this UPDATE
    // commits.
    //
    // stamp `processingStartedAt` so the daily janitor cron can
    // detect rows stuck in `processing` / `requires_action` for >48h cheaply.
    // Cleared again on transition to a terminal state below.
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        stripePaymentIntentId: intent.id,
        stripePaymentMethodId: defaultPm.stripePaymentMethodId,
        attemptCount: attempt,
        processingStartedAt: payment.processingStartedAt ?? new Date(),
      },
    })

    // For a succeeded off-session charge, run the SAME path the webhook will
    // take — `markSucceeded` is responsible for the full transition (Payment
    // row update + `BookingGroup.paidAmount` increment + `deposit_paid →
    // fully_paid` advance + saved-PM upsert + audit log). Writing
    // `status = succeeded` here directly would trip markSucceeded's
    // idempotency check and the BookingGroup would never advance.
    // (This is the exact same trap that bit the capture flow.)
    // markSucceeded is itself idempotent on a re-run from the webhook.
    if (intent.status === 'succeeded') {
      await this.markSucceeded(intent)
      return
    }

    // Non-succeeded statuses: persist directly. `requires_action` means a 3DS
    // step-up is needed — the recovery email path picks it up by paymentId.
    // `requires_payment_method` etc. are similarly transient; the eventual
    // `payment_intent.payment_failed` webhook will run markFailed.
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: translateStatus(intent.status),
        // H8: any non-terminal status means the row is still in-flight;
        // ensure the processingStartedAt timestamp is set so the janitor /
        // step-up-abandon path can pick it up later.
        processingStartedAt: payment.processingStartedAt ?? new Date(),
      },
    })

    if (intent.status === 'requires_action') {
      billingAudit(this.logger, 'off_session_3ds', {
        paymentId: payment.id,
        intentId: intent.id,
      })
    }
  }

  /**
   * When an off-session charge has been sitting in
   * `requires_action` past the 48h step-up window, the parent has effectively
   * abandoned the 3DS challenge. Cancel the live Stripe intent so it stops
   * occupying a row of off-session capacity, mark the Payment row terminal
   * with `attemptCount = MAX_OFF_SESSION_ATTEMPTS`, and let the cron's
   * existing exhausted branch flip the BookingGroup to `payment_failed` and
   * dispatch the final-failure email.
   *
   * Idempotent — `paymentIntents.cancel` on an already-canceled intent
   * returns the existing object (Stripe doesn't error), and the DB update
   * is last-write-wins safe under a webhook re-fire.
   */
  async markStepUpAbandoned(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`)
    if (payment.status === PaymentStatus.failed || payment.status === PaymentStatus.canceled) {
      // Already terminal — nothing to do.
      return
    }

    if (payment.stripePaymentIntentId) {
      try {
        // Direct Charges: the intent lives on the connected account.
        await withStripeErrors(() =>
          this.stripeService.client.paymentIntents.cancel(
            payment.stripePaymentIntentId!,
            { cancellation_reason: 'abandoned' },
            { stripeAccount: payment.stripeAccountId }
          )
        )
      } catch (err) {
        // a failed cancel leaves a Stripe-side intent alive,
        // holding capacity until natural expiry. ERROR-level + structured
        // audit so the alerting hook can pick it up; we still flip the row
        // terminal so the booking can advance, but ops needs to reconcile
        // the Stripe-side intent.
        const intentId = payment.stripePaymentIntentId
        this.logger.error(
          `markStepUpAbandoned: paymentIntents.cancel FAILED for ${intentId}: ${(err as Error).message}. Stripe-side intent may still be alive — manual reconciliation required.`
        )
        billingAudit(this.logger, 'step_up_abandon_cancel_failed', {
          paymentId: payment.id,
          bookingGroupId: payment.bookingGroupId,
          intentId,
          error: redactPii((err as Error).message ?? ''),
        })
      }
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.failed,
        attemptCount: this.maxOffSessionAttempts,
        failureCode: 'step_up_abandoned',
        failureMessage: '3DS challenge was not completed within the off-session window',
        canceledAt: new Date(),
        // H8: terminal — clear the marker.
        processingStartedAt: null,
      },
    })

    billingAudit(this.logger, 'off_session_step_up_abandoned', {
      paymentId: payment.id,
      bookingGroupId: payment.bookingGroupId,
      intentId: payment.stripePaymentIntentId,
    })
  }

  /**
   * Lifts the saved-PM details from a Stripe PaymentMethod and persists them
   * for display + expiry-check. Mark this method's PM `isDefault` if the
   * parent has none yet, otherwise leave existing default in place — the
   * frontend exposes a "set default" action separately.
   *
   * Concurrency: the read of "any existing default" and the write of a new
   * row run in a single Prisma transaction so two parallel saves cannot both
   * elect themselves default. (Postgres default isolation is read-committed,
   * which is enough here because we re-check inside the transaction.)
   */
  async upsertSavedPaymentMethod(
    providerConnectCustomerId: string,
    paymentMethodId: string,
    stripeAccountId: string
  ): Promise<void> {
    let pm: StripePaymentMethod
    try {
      // Direct Charges: PM lives on the connected account.
      pm = await this.stripeService.client.paymentMethods.retrieve(paymentMethodId, undefined, {
        stripeAccount: stripeAccountId,
      })
    } catch (err) {
      if (
        err instanceof Stripe.errors.StripeInvalidRequestError &&
        err.code === 'resource_missing'
      ) {
        // The PM was already detached; nothing to record.
        return
      }
      throw err
    }
    if (pm.type !== 'card' || !pm.card) {
      this.logger.warn(`upsertSavedPaymentMethod: PM ${paymentMethodId} is not a card; skipping`)
      return
    }
    const card = pm.card

    await this.prisma.$transaction(async tx => {
      const existingDefault = await tx.savedPaymentMethod.findFirst({
        where: { providerConnectCustomerId, isDefault: true, archivedAt: null },
        select: { id: true, stripePaymentMethodId: true },
      })
      const shouldBeDefault =
        !existingDefault || existingDefault.stripePaymentMethodId === paymentMethodId

      await tx.savedPaymentMethod.upsert({
        where: {
          providerConnectCustomerId_stripePaymentMethodId: {
            providerConnectCustomerId,
            stripePaymentMethodId: paymentMethodId,
          },
        },
        create: {
          providerConnectCustomerId,
          stripePaymentMethodId: paymentMethodId,
          brand: card.brand,
          last4: card.last4,
          expMonth: card.exp_month,
          expYear: card.exp_year,
          // 'unknown' is a sentinel — Stripe occasionally returns null for
          // funding (e.g. on test PMs); avoids a NOT NULL violation while
          // surfacing the gap to anyone reading the row.
          funding: card.funding ?? 'unknown',
          isDefault: shouldBeDefault,
        },
        update: {
          brand: card.brand,
          last4: card.last4,
          expMonth: card.exp_month,
          expYear: card.exp_year,
          funding: card.funding ?? 'unknown',
          archivedAt: null,
        },
      })
    })
  }

  // -------- Synchronous client-driven sync -------------------------------

  /**
   * Pulls the live state of every non-terminal Payment for a BookingGroup
   * from Stripe and runs the matching webhook-handler logic against it.
   *
   * This is the dev-friendly counterpart to webhook delivery. After the
   * frontend's `stripe.confirmPayment` resolves, it calls the parent-scoped
   * sync endpoint which fans out to this method so the Payment row
   * transitions from `requires_payment_method` → `requires_capture`
   * (manual-capture flow) or `requires_capture` → `succeeded` (off-session
   * flow) without waiting for the Stripe webhook to arrive.
   *
   * Idempotent: every handler it dispatches to is the same one used from
   * the webhook dispatcher, so webhook delivery later is a safe no-op.
   *
   * Best-effort: we swallow per-row errors so a single bad Payment doesn't
   * prevent the rest from syncing. Errors are logged for ops visibility.
   */
  async syncForBookingGroup(bookingGroupId: string): Promise<void> {
    const payments = await this.prisma.payment.findMany({
      where: {
        bookingGroupId,
        status: {
          in: [
            PaymentStatus.requires_payment_method,
            PaymentStatus.requires_confirmation,
            PaymentStatus.requires_action,
            PaymentStatus.requires_capture,
            PaymentStatus.processing,
          ],
        },
      },
    })

    for (const payment of payments) {
      try {
        if (payment.stripePaymentIntentId) {
          // Direct Charges: the intent lives on the connected account.
          const intent = await this.stripeService.client.paymentIntents.retrieve(
            payment.stripePaymentIntentId,
            undefined,
            { stripeAccount: payment.stripeAccountId }
          )
          await this.dispatchPaymentIntentSync(intent)
        } else if (payment.stripeSetupIntentId) {
          const setupIntent = await this.stripeService.client.setupIntents.retrieve(
            payment.stripeSetupIntentId,
            undefined,
            { stripeAccount: payment.stripeAccountId }
          )
          await this.dispatchSetupIntentSync(setupIntent)
        }
      } catch (err) {
        // best-effort, but emit a structured audit line so a
        // metrics emitter can alert on consistently-failing rows. Without the
        // audit signal, a row that gets stuck syncing is invisible (the warn
        // alone doesn't escalate).
        const message = (err as Error)?.message ?? 'unknown error'
        this.logger.warn(`payments.sync row=${payment.id} skipped: ${message}`)
        billingAudit(this.logger, 'sync_row_failed', {
          paymentId: payment.id,
          bookingGroupId,
          error: redactPii(message),
        })
      }
    }
  }

  /**
   * Routes a freshly-retrieved PaymentIntent to the same handler that the
   * matching webhook would invoke. Status mapping mirrors `dispatch()` in
   * `stripe-webhook.service.ts` for the payment_intent.* event family.
   */
  private async dispatchPaymentIntentSync(intent: StripePaymentIntent): Promise<void> {
    switch (intent.status) {
      case 'requires_capture':
        await this.markCapturable(intent)
        return
      case 'succeeded':
        await this.markSucceeded(intent)
        return
      case 'canceled':
        await this.markCanceled(intent)
        return
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
      case 'processing':
        // Still in-flight — nothing to update beyond persisting the latest
        // PM/charge fields. markCapturable handles the field sync without
        // the status flip when status is already these values.
        return
      default:
        // Unknown future Stripe status; if there's a last_payment_error we
        // treat the intent as failed.
        if (intent.last_payment_error) {
          await this.markFailed(intent)
        }
    }
  }

  private async dispatchSetupIntentSync(setupIntent: StripeSetupIntent): Promise<void> {
    if (setupIntent.status === 'succeeded') {
      await this.markSetupSucceeded(setupIntent)
    } else if (setupIntent.status === 'canceled') {
      // SetupIntent cancellation is rare; we don't have a dedicated handler
      // because the webhook path goes through `cancelForBookingGroup` which
      // is provider-driven. Leave the row in `processing` for the cron to
      // pick up; the cron already handles the missing-card case gracefully.
      this.logger.log(
        `setup_intent.canceled detected via sync for ${setupIntent.id}; cron will reconcile`
      )
    }
  }

  // -------- Webhook event handlers ---------------------------------------

  /**
   * Webhook: `payment_intent.amount_capturable_updated`. Fires when a manual-
   * capture intent has been authorized and is now waiting for capture. Update
   * our row so the booking dashboard can show "card authorized, awaiting
   * provider response."
   */
  async markCapturable(intent: StripePaymentIntent): Promise<void> {
    const payment = await this.findPaymentForIntent(intent)
    if (!payment) {
      this.logger.warn(`markCapturable: no Payment row for intent ${intent.id}`)
      return
    }
    if (payment.status === PaymentStatus.requires_capture) return

    // Status-guarded claim — webhook deliveries can arrive out of order
    // (`payment_intent.payment_failed` before `amount_capturable_updated`,
    // or two near-simultaneous deliveries from Stripe). The WHERE clause
    // restricts the transition to in-flight statuses; `succeeded`/`failed`/
    // `canceled` rows stay terminal instead of rolling back to capturable.
    await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: [
            PaymentStatus.requires_payment_method,
            PaymentStatus.requires_confirmation,
            PaymentStatus.requires_action,
            PaymentStatus.processing,
          ],
        },
      },
      data: {
        status: PaymentStatus.requires_capture,
        stripePaymentIntentId: intent.id,
        stripePaymentMethodId:
          typeof intent.payment_method === 'string'
            ? intent.payment_method
            : (intent.payment_method?.id ?? payment.stripePaymentMethodId),
        // H8: `requires_capture` is the manual-capture in-flight state — the
        // auth is held until the provider accepts. Stamp so the auth-expiry
        // monitor cron (B9) can find rows approaching the 7-day cliff.
        // N1: derive the stamp from Stripe's `intent.created` (epoch seconds)
        // so the 7-day auth window measured from authorization — not webhook
        // receipt — drives the cron's cancel cutoff.
        processingStartedAt:
          payment.processingStartedAt ??
          (typeof intent.created === 'number' ? new Date(intent.created * 1000) : new Date()),
      },
    })
  }

  /**
   * Payments revamp (Spec v2.3): fire a single BALANCE scheduled capture. The
   * scheduled-capture engine calls this at each refund-tier boundary. It
   * idempotently creates the per-capture balance `Payment` row carrying that
   * increment's amount + application fee, links it to the scheduled-capture row,
   * then charges it off-session via `chargeOffSession` (whose retry pickup the
   * balance-charge cron already owns).
   *
   * Connect context (customer + connected account) is inherited from an existing
   * Payment on the booking (the deposit auth or the no-deposit SetupIntent
   * placeholder). Returns the resulting Payment status rather than throwing on a
   * decline — `chargeOffSession` swallows `StripeCardError` (records the row
   * `failed` + nextRetryAt) and persists `requires_action` for SCA, so the
   * engine must read the settled status to mark the scheduled-capture correctly.
   */
  async chargeScheduledBalanceCapture(scheduledCaptureId: string): Promise<{
    status: 'succeeded' | 'failed' | 'requires_action'
    paymentId: string
    stripePaymentIntentId: string | null
    failureCode: string | null
    failureMessage: string | null
  }> {
    const capture = await this.prisma.bookingScheduledCapture.findUnique({
      where: { id: scheduledCaptureId },
    })
    if (!capture) throw new NotFoundException(`ScheduledCapture ${scheduledCaptureId} not found`)

    // Reuse the linked Payment row if a prior fire already created it (idempotent).
    let paymentId = capture.paymentId
    if (!paymentId) {
      // Inherit connect context from an existing Payment on the booking.
      const context = await this.prisma.payment.findFirst({
        where: {
          bookingGroupId: capture.bookingGroupId,
          providerConnectCustomerId: { not: null },
        },
        select: { providerConnectCustomerId: true, stripeAccountId: true },
        orderBy: { createdAt: 'asc' },
      })
      if (!context?.providerConnectCustomerId) {
        throw new BadRequestException(
          `Booking ${capture.bookingGroupId} has no connect customer; cannot charge balance capture`
        )
      }
      const idempotencyKey = buildIdempotencyKey(`pay:capture:${capture.id}`, {
        seq: capture.sequence,
        amount: capture.amount.toString(),
      })
      const payment = await this.prisma.payment.create({
        data: {
          bookingGroupId: capture.bookingGroupId,
          kind: PaymentKind.balance,
          stripePaymentIntentId: null,
          stripeSetupIntentId: null,
          providerConnectCustomerId: context.providerConnectCustomerId,
          amount: capture.amount,
          applicationFeeAmount: capture.applicationFeeAmount,
          currency: capture.currency,
          stripeAccountId: context.stripeAccountId,
          status: PaymentStatus.processing,
          captureMethod: CaptureMethod.automatic,
          dueAt: capture.effectiveCaptureDate,
          idempotencyKey,
        },
      })
      paymentId = payment.id
      await this.prisma.bookingScheduledCapture.update({
        where: { id: capture.id },
        data: { paymentId },
      })
    }

    await this.chargeOffSession(paymentId)

    const settled = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        status: true,
        stripePaymentIntentId: true,
        failureCode: true,
        failureMessage: true,
      },
    })
    const status =
      settled?.status === PaymentStatus.succeeded
        ? 'succeeded'
        : settled?.status === PaymentStatus.requires_action
          ? 'requires_action'
          : 'failed'
    return {
      status,
      paymentId,
      stripePaymentIntentId: settled?.stripePaymentIntentId ?? null,
      failureCode: settled?.failureCode ?? null,
      failureMessage: settled?.failureMessage ?? null,
    }
  }

  /**
   * Webhook: `payment_intent.succeeded`. Captures (no pun intended) the success
   * path: persist the charge id + saved PM, increment paidAmount on the
   * BookingGroup, and (if this was the deposit) advance the group status.
   *
   * Idempotent — re-running with the same intent is a no-op past the first call.
   */
  async markSucceeded(intent: StripePaymentIntent): Promise<void> {
    const payment = await this.findPaymentForIntent(intent)
    if (!payment) {
      this.logger.warn(`markSucceeded: no Payment row for intent ${intent.id}`)
      return
    }
    if (payment.status === PaymentStatus.succeeded) return

    // defensive guard against an `intent.amount_received` that
    // diverges from our cached `payment.amount`. Stripe supports partial
    // capture (`amount_to_capture`), so a future bug, manual Dashboard tweak,
    // or new feature could capture less (or more) than authorized. Without
    // this check we'd increment `BookingGroup.paidAmount` by the wrong number.
    // Surface loudly instead of silently corrupting accounting.
    if (typeof intent.amount_received === 'number' && intent.amount_received > 0) {
      const captured = fromStripeMinorUnits(intent.amount_received, intent.currency)
      if (!payment.amount.equals(captured)) {
        this.logger.error(
          `markSucceeded amount-mismatch: payment ${payment.id} expected ${payment.amount.toFixed(2)} ${payment.currency} but Stripe captured ${captured} ${intent.currency} (intent ${intent.id})`
        )
        billingAudit(this.logger, 'amount_mismatch', {
          paymentId: payment.id,
          intentId: intent.id,
          expected: payment.amount.toFixed(2),
          captured: captured.toString(),
          currency: payment.currency,
        })
        // Refuse to advance the booking with the wrong number. The Payment
        // row itself stays whatever the prior status was; ops must reconcile
        // before the booking can move forward.
        return
      }
    }

    const chargeId =
      typeof intent.latest_charge === 'string'
        ? intent.latest_charge
        : (intent.latest_charge?.id ?? null)
    const pmId =
      typeof intent.payment_method === 'string'
        ? intent.payment_method
        : (intent.payment_method?.id ?? null)

    await this.prisma.$transaction(async tx => {
      // Status-guarded claim — only one writer flips the row to `succeeded`.
      // Prevents (a) two concurrent webhook deliveries from double-incrementing
      // `BookingGroup.paidAmount`, and (b) a delayed `payment_intent.succeeded`
      // from rolling a row back out of a terminal `canceled`/`failed` state set
      // by an out-of-band event (e.g. admin cancel, dispute funds-withdrawn).
      const claim = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: {
            in: [
              PaymentStatus.requires_capture,
              PaymentStatus.processing,
              PaymentStatus.requires_action,
            ],
          },
        },
        data: {
          status: PaymentStatus.succeeded,
          succeededAt: new Date(),
          capturedAt: payment.capturedAt ?? new Date(),
          // H8: clear the in-flight marker now that we've reached terminal
          // success — keeps the janitor query selective.
          processingStartedAt: null,
          // Always set stripePaymentIntentId — covers the SetupIntent → cron
          // race where the row's PI id may not yet have been written by
          // `chargeOffSession`'s update.
          stripePaymentIntentId: intent.id,
          stripeChargeId: chargeId ?? payment.stripeChargeId,
          stripePaymentMethodId: pmId ?? payment.stripePaymentMethodId,
        },
      })
      if (claim.count === 0) {
        // Another invocation already flipped this row to `succeeded`
        // (concurrent webhook delivery) OR the row has been moved to a
        // terminal-but-non-succeeded state by an out-of-band event. Skip the
        // `BookingGroup.paidAmount` increment so accounting stays accurate.
        return
      }
      const updatedGroup = await tx.bookingGroup.update({
        where: { id: payment.bookingGroupId },
        data: {
          paidAmount: { increment: payment.amount },
        },
        select: {
          status: true,
          totalAmount: true,
          paidAmount: true,
          refundedAmount: true,
          // Snapshot fields used to mint the balance Payment row when the
          // deposit captures. `balanceDueAt` is only set
          // for bookings that have a balance to charge later;
          // `appFeePercentageSnapshot` lets us compute the proportional
          // application_fee_amount for the balance row consistent with the
          // deposit row.
          balanceDueAt: true,
          appFeePercentageSnapshot: true,
        },
      })

      // Payments revamp (Spec v2.3): sync the linked scheduled capture to
      // `completed` FIRST and UNCONDITIONALLY — the money for this capture
      // arrived regardless of the booking's lifecycle status. Covers a
      // SUCCESSFUL RETRY of a previously-failed / in-flight balance capture
      // (the balance-charge cron re-charged the Payment row, and the engine that
      // first fired it has moved on) — without this the capture row would stay
      // `failed` and later escalate to payment_review even though the money was
      // collected. Status-guarded so a webhook re-fire is idempotent. The legacy
      // single balance Payment row that used to be minted here on deposit
      // capture is REMOVED — balance is owned by `booking_scheduled_captures`.
      await tx.bookingScheduledCapture.updateMany({
        where: {
          paymentId: payment.id,
          status: { in: [ScheduledCaptureStatus.processing, ScheduledCaptureStatus.failed] },
        },
        data: {
          status: ScheduledCaptureStatus.completed,
          failureCode: null,
          failureMessage: null,
        },
      })

      const netPaid = updatedGroup.paidAmount.minus(updatedGroup.refundedAmount)

      // Out-of-order tolerance (Spec v2.3 §9): a late `payment_intent.succeeded`
      // arriving AFTER the booking was escalated to `payment_review` must WIN —
      // clear the review and resume the booking so its remaining scheduled
      // captures continue. `paidAmount` was already incremented under the claim
      // guard above, so there is NO double-count. Resume to `fully_paid` when
      // this completes the balance, else the generic capture-eligible
      // `deposit_paid` (a partially-paid, captures-ongoing state).
      if (updatedGroup.status === BookingGroupStatus.payment_review) {
        await tx.bookingGroup.update({
          where: { id: payment.bookingGroupId },
          data: {
            status: netPaid.greaterThanOrEqualTo(updatedGroup.totalAmount)
              ? BookingGroupStatus.fully_paid
              : BookingGroupStatus.deposit_paid,
            paymentReviewStatus: null,
            paymentReviewResolvedAt: new Date(),
          },
        })
        return
      }

      // Advance BookingGroup.status based on Payment.kind + new paidAmount.
      // Only transition from "intermediate" payment-flow states; never
      // overwrite cancelled/declined/expired/disputed (parent or admin
      // already moved the booking out of the happy path) and never roll
      // back from at_camp/completed (program lifecycle states).
      const advanceableFromStatuses = new Set<BookingGroupStatus>([
        BookingGroupStatus.request,
        BookingGroupStatus.accepted,
        BookingGroupStatus.deposit_paid,
      ])
      if (!advanceableFromStatuses.has(updatedGroup.status)) {
        return
      }

      let nextStatus: BookingGroupStatus | null = null
      if (
        payment.kind === PaymentKind.balance ||
        payment.kind === PaymentKind.full ||
        payment.kind === PaymentKind.rebill
      ) {
        // Any non-deposit Payment that brings the group to fully-paid
        // moves the lifecycle to fully_paid. We compare against totalAmount
        // (less refunds, in case a partial refund happened mid-flight).
        if (netPaid.greaterThanOrEqualTo(updatedGroup.totalAmount)) {
          nextStatus = BookingGroupStatus.fully_paid
        }
      } else if (payment.kind === PaymentKind.deposit) {
        // Deposit captured: advance to deposit_paid (or fully_paid in the
        // unusual case where the deposit equals the total — e.g. provider
        // configured 100% deposit).
        nextStatus = netPaid.greaterThanOrEqualTo(updatedGroup.totalAmount)
          ? BookingGroupStatus.fully_paid
          : BookingGroupStatus.deposit_paid
      }

      if (nextStatus && nextStatus !== updatedGroup.status) {
        await tx.bookingGroup.update({
          where: { id: payment.bookingGroupId },
          data: { status: nextStatus },
        })
      }
    })

    // Persist the saved PM (best-effort; failures here don't roll back the
    // payment success — the parent has already paid). Direct Charges: PM and
    // customer are scoped to the connected account; we attach to the
    // `ProviderConnectCustomer` already linked to this Payment.
    if (pmId && payment.providerConnectCustomerId) {
      try {
        await this.upsertSavedPaymentMethod(
          payment.providerConnectCustomerId,
          pmId,
          payment.stripeAccountId
        )
      } catch (err) {
        this.logger.error(
          `markSucceeded: upsertSavedPaymentMethod failed for providerConnectCustomer ${payment.providerConnectCustomerId}: ${(err as Error).message}`
        )
      }
    }

    billingAudit(this.logger, 'succeeded', {
      paymentId: payment.id,
      intentId: intent.id,
      amount: fromStripeMinorUnits(intent.amount, intent.currency),
      currency: intent.currency,
    })

    // v28 catalog dispatch — payment-success notifications. Different
    // template per Payment.kind: deposit fires DepositConfirmed, balance/
    // full/rebill fire BalanceCharged. Loader hydrates against fresh DB
    // state at worker time. Skipped when the transaction's status-guarded
    // claim was a no-op (above) — by then we returned early.
    const dispatchType =
      payment.kind === PaymentKind.deposit
        ? NotificationType.ParentPaymentDepositConfirmed
        : NotificationType.ParentPaymentBalanceCharged
    notify(this.eventEmitter, dispatchType, {
      paymentId: payment.id,
      bookingGroupId: payment.bookingGroupId,
    })

    // provider-side mirror only for balance / full / rebill
    // captures. Deposit capture already fires `ProviderBookingAccepted`
    // so emitting "balance collected" for the deposit would be
    // duplicative. The catalog's `providerOwnerForBooking` resolver scopes
    // this to the camp owner; this is finance content the whole staff
    // doesn't need to see.
    if (payment.kind !== PaymentKind.deposit) {
      notify(this.eventEmitter, NotificationType.ProviderBalanceCollected, {
        paymentId: payment.id,
        bookingGroupId: payment.bookingGroupId,
      })
    }
    // superadmin "funds pending transfer" mirror. Fires on
    // every successful capture (deposit + balance + rebill) so admins
    // have visibility on the inbound-funds queue before the payout cron
    // releases them.
    notify(this.eventEmitter, NotificationType.SuperadminFundsPendingTransfer, {
      paymentId: payment.id,
      bookingGroupId: payment.bookingGroupId,
    })
  }

  /**
   * Webhook: `payment_intent.payment_failed`. Persist the failure metadata so
   * the cron's retry logic and the parent-facing UI both see consistent state.
   */
  async markFailed(intent: StripePaymentIntent): Promise<void> {
    const payment = await this.findPaymentForIntent(intent)
    if (!payment) {
      this.logger.warn(`markFailed: no Payment row for intent ${intent.id}`)
      return
    }
    if (payment.status === PaymentStatus.failed) return

    const lastError = intent.last_payment_error
    // SCA (Spec v2.3 §7): an off-session charge that needs a 3DS step-up fails
    // with `authentication_required`. This is NOT a hard decline — retrying
    // off-session just fails the same way until the window exhausts and the
    // parent is never prompted. Route it into the existing 3DS-recovery flow
    // (persist `requires_action` + email the parent a recovery link now) so they
    // can authenticate. A successful authentication later completes the linked
    // capture via `markSucceeded`.
    const requiresAuthentication = lastError?.code === 'authentication_required'

    // Status-guarded claim — never roll a row back from a terminal `succeeded`
    // or `canceled` state. A delayed `payment_intent.payment_failed` arriving
    // after a successful capture (or after an admin/webhook cancel) must be a
    // no-op; without this guard the row flips to `failed` while
    // `BookingGroup.paidAmount` stays incremented, leaving accounting wrong.
    const claim = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: [
            PaymentStatus.requires_payment_method,
            PaymentStatus.requires_confirmation,
            PaymentStatus.requires_action,
            PaymentStatus.processing,
            PaymentStatus.requires_capture,
          ],
        },
      },
      data: {
        status: requiresAuthentication ? PaymentStatus.requires_action : PaymentStatus.failed,
        stripePaymentIntentId: intent.id,
        failureCode: lastError?.code ?? null,
        // redact PII from failure messages. Stripe's
        // last_payment_error.message can include card BIN / last4 fragments;
        // this column renders into admin UIs.
        failureMessage: lastError?.message ? redactPii(lastError.message) : null,
        // For SCA keep `processingStartedAt` so the 48h step-up janitor can find
        // it; for a hard failure clear it (terminal for the cron's purposes).
        processingStartedAt: requiresAuthentication
          ? (payment.processingStartedAt ?? new Date())
          : null,
        // The cron decides whether to schedule a retry — webhooks should not
        // set `nextRetryAt` because they may arrive after a manual cancel.
      },
    })

    // Payments revamp (Spec v2.3): sync the linked scheduled capture so the
    // webhook is the source of truth for an ASYNC balance-capture failure (the
    // charge appeared in-flight, then `payment_intent.payment_failed` arrives).
    // Status-guarded to `processing` so a late failure can't roll a `completed`
    // (out-of-order success) capture back to failed; the engine's own path
    // already marks synchronous declines.
    await this.prisma.bookingScheduledCapture.updateMany({
      where: { paymentId: payment.id, status: ScheduledCaptureStatus.processing },
      data: {
        status: ScheduledCaptureStatus.failed,
        failureCode: lastError?.code ?? null,
        failureMessage: lastError?.message ? redactPii(lastError.message).slice(0, 500) : null,
        retryDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    })

    // SCA: prompt the parent to complete 3DS now (only if we actually claimed the
    // row — not on a no-op late webhook). Best-effort: the notification service
    // swallows its own send/Stripe errors, and the balance-charge cron's
    // `requires_action` branch is the recurring backstop.
    if (requiresAuthentication && claim.count > 0) {
      await this.billingNotifications.notifyOffSessionRequiresAction(payment.id)
    }
  }

  /**
   * Webhook: `payment_intent.canceled`. Sync our status to canceled.
   */
  async markCanceled(intent: StripePaymentIntent): Promise<void> {
    const payment = await this.findPaymentForIntent(intent)
    if (!payment) {
      this.logger.warn(`markCanceled: no Payment row for intent ${intent.id}`)
      return
    }
    if (payment.status === PaymentStatus.canceled) return
    // Status-guarded claim — never roll back from a terminal `succeeded` or
    // `failed` state. A delayed `payment_intent.canceled` arriving after a
    // successful capture would otherwise mark the row canceled while leaving
    // `BookingGroup.paidAmount` incremented.
    await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: [
            PaymentStatus.requires_payment_method,
            PaymentStatus.requires_confirmation,
            PaymentStatus.requires_action,
            PaymentStatus.requires_capture,
            PaymentStatus.processing,
          ],
        },
      },
      data: {
        status: PaymentStatus.canceled,
        canceledAt: new Date(),
        stripePaymentIntentId: intent.id,
        // H8: clear the in-flight marker on terminal cancellation.
        processingStartedAt: null,
      },
    })

    // Payments revamp (Spec v2.3): a canceled PaymentIntent cancels its linked
    // scheduled capture too (status-guarded so it never touches a completed one).
    await this.prisma.bookingScheduledCapture.updateMany({
      where: {
        paymentId: payment.id,
        status: {
          in: [ScheduledCaptureStatus.scheduled, ScheduledCaptureStatus.processing],
        },
      },
      data: {
        status: ScheduledCaptureStatus.cancelled,
        cancelledReason: 'payment_intent_canceled',
      },
    })
  }

  /**
   * Webhook: `payment_intent.requires_action`. Stripe fires this
   * when the intent transitions into a state that needs further action (most
   * commonly an async 3DS step-up post-auth). We capture the synchronous
   * `requires_action` from `paymentIntents.create` in `chargeOffSession`, but
   * an async transition (delayed step-up triggered by additional fraud signals
   * after auth) would otherwise leave us in `processing`. This handler aligns
   * the row with reality so `/payment/authorize` recovery emails can fire.
   */
  async markRequiresAction(intent: StripePaymentIntent): Promise<void> {
    const payment = await this.findPaymentForIntent(intent)
    if (!payment) {
      this.logger.warn(`markRequiresAction: no Payment row for intent ${intent.id}`)
      return
    }
    if (payment.status === PaymentStatus.requires_action) return
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.requires_action,
        stripePaymentIntentId: intent.id,
        processingStartedAt: payment.processingStartedAt ?? new Date(),
      },
    })
    billingAudit(this.logger, 'requires_action_async', {
      paymentId: payment.id,
      intentId: intent.id,
    })
  }

  /**
   * Webhook: `payment_intent.processing`. For PMs that go
   * through a `processing` state (some bank-redirects, future SEPA/iDEAL
   * additions). Cards skip this state, but explicit handling de-risks
   * future PM enablement.
   */
  async markProcessing(intent: StripePaymentIntent): Promise<void> {
    const payment = await this.findPaymentForIntent(intent)
    if (!payment) {
      this.logger.warn(`markProcessing: no Payment row for intent ${intent.id}`)
      return
    }
    if (payment.status === PaymentStatus.processing) return
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.processing,
        stripePaymentIntentId: intent.id,
        processingStartedAt: payment.processingStartedAt ?? new Date(),
      },
    })
  }

  /**
   * Webhook: `setup_intent.succeeded`. Persist the saved PM so the off-session
   * cron has a card to charge with. Looks up the placeholder `Payment` row
   * created by `createSetupIntent` so we can reuse its `providerConnectCustomerId`
   * and `stripeAccountId` — the PM under Direct Charges lives on the connected
   * account, not on a platform-side customer.
   */
  async markSetupSucceeded(setupIntent: StripeSetupIntent): Promise<void> {
    const bookingGroupId = setupIntent.metadata?.bookingGroupId
    const pmId =
      typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : (setupIntent.payment_method?.id ?? null)
    if (!bookingGroupId || !pmId) {
      this.logger.warn(
        `markSetupSucceeded: missing bookingGroupId or payment_method on setup intent ${setupIntent.id}`
      )
      return
    }
    const payment = await this.prisma.payment.findFirst({
      where: { stripeSetupIntentId: setupIntent.id },
      select: { providerConnectCustomerId: true, stripeAccountId: true },
    })
    if (!payment?.providerConnectCustomerId) {
      this.logger.warn(
        `markSetupSucceeded: no Payment row with providerConnectCustomer for setup intent ${setupIntent.id}`
      )
      return
    }
    await this.upsertSavedPaymentMethod(
      payment.providerConnectCustomerId,
      pmId,
      payment.stripeAccountId
    )
  }

  /**
   * Webhook: `setup_intent.setup_failed`. We don't currently mutate state on
   * this — the parent simply hasn't completed the save. The frontend handles
   * re-prompting; logging here is enough for ops visibility.
   */
  markSetupFailed(setupIntent: StripeSetupIntent): void {
    this.logger.warn(
      `setup_intent.setup_failed id=${setupIntent.id} reason=${setupIntent.last_setup_error?.code ?? 'unknown'}`
    )
  }

  /**
   * Webhook: `payment_method.detached`. Archive our saved-PM row so the
   * pm-expiry-warning cron picks up that we no longer have a card on file.
   */
  async markPmDetached(paymentMethod: StripePaymentMethod): Promise<void> {
    await this.prisma.savedPaymentMethod.updateMany({
      where: { stripePaymentMethodId: paymentMethod.id, archivedAt: null },
      data: { archivedAt: new Date(), isDefault: false },
    })
  }

  // -------- Internal helpers ---------------------------------------------

  /**
   * Finds the Payment row associated with a Stripe PaymentIntent webhook.
   *
   * Primary lookup: `stripePaymentIntentId = intent.id`. This is the steady
   * state once the cron's create→update pair has committed.
   *
   * Fallback: when the row is from the SetupIntent flow, the cron creates a
   * Stripe PaymentIntent and then updates the row's `stripePaymentIntentId`.
   * Stripe webhook delivery can race that DB UPDATE — it's fast (often
   * <500ms) and our cron's UPDATE is in a separate transaction. If we miss
   * the row by intent id, fall back to `metadata.paymentId` which we always
   * set in `chargeOffSession`. This eliminates the silent-failure mode where
   * a successful off-session charge never advances our DB state.
   */
  private async findPaymentForIntent(intent: StripePaymentIntent) {
    const byIntent = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: intent.id },
    })
    if (byIntent) return byIntent

    const fallbackId = intent.metadata?.paymentId
    if (!fallbackId) return null
    return this.prisma.payment.findUnique({ where: { id: fallbackId } })
  }

  private async authorizeIntent(
    bookingGroupId: string,
    kind: typeof PaymentKind.deposit | typeof PaymentKind.full
  ): Promise<AuthorizeResult> {
    const group = await this.loadBookingGroupOrThrow(bookingGroupId)
    await this.stripeConnectService.assertProviderPaymentReady(group.providerId)

    // Idempotency at the application layer: if a non-terminal Payment of the
    // same kind already exists for this group, return its existing client
    // secret. This is the natural retry case (the parent reloaded the page).
    const existing = await this.prisma.payment.findFirst({
      where: {
        bookingGroupId: group.id,
        kind,
        stripePaymentIntentId: { not: null },
        status: {
          in: [
            PaymentStatus.requires_payment_method,
            PaymentStatus.requires_confirmation,
            PaymentStatus.requires_action,
            PaymentStatus.requires_capture,
            PaymentStatus.processing,
          ],
        },
      },
    })
    if (existing?.stripePaymentIntentId) {
      // Re-fetch the live intent to get a fresh client_secret. Stripe rotates
      // client_secret on certain status transitions; using a stale one fails
      // the confirmation. We do NOT create a new intent here.
      // Direct Charges: the intent lives on the connected account; must pass
      // `stripeAccount` in the 3rd-arg request options.
      const live = await withStripeErrors(() =>
        this.stripeService.client.paymentIntents.retrieve(
          existing.stripePaymentIntentId!,
          undefined,
          { stripeAccount: existing.stripeAccountId }
        )
      )
      if (!live.client_secret) {
        throw new Error(
          `Stripe PaymentIntent ${live.id} has no client_secret; cannot resume payment`
        )
      }
      return {
        paymentId: existing.id,
        paymentIntentId: live.id,
        clientSecret: live.client_secret,
        amount: existing.amount.toFixed(2),
        currency: existing.currency,
      }
    }

    const stripeAccountId = this.requireProviderStripeAccount(group)
    const connectCustomer = await this.ensureProviderConnectCustomer(
      group.parentId,
      group.providerId,
      stripeAccountId
    )
    const currency = this.requireCurrency(group)

    const amount =
      kind === PaymentKind.deposit ? this.requireDepositAmount(group) : group.totalAmount
    if (group.appFeePercentageSnapshot == null) {
      throw new BadRequestException(
        `BookingGroup ${group.id} has no appFeePercentageSnapshot; cannot compute application fee`
      )
    }
    const applicationFee = computeApplicationFee(amount, group.appFeePercentageSnapshot)

    // Pre-generate the Payment row id so we can include it as
    // `metadata.paymentId` on the Stripe intent itself. This makes the
    // `findPaymentForIntent` metadata fallback reachable for any webhook that
    // might arrive in the narrow window between the Stripe API call returning
    // and our `prisma.payment.create` landing — and also for any future
    // event types we add (e.g. `payment_intent.created`).
    //
    // If Stripe succeeds but our DB write fails afterward, this attempt's
    // intent becomes an orphan that Stripe will auto-expire. The next retry
    // generates a fresh UUID and a fresh idempotency key; Stripe creates a
    // new intent. No body-mismatch risk because each call has its own key.
    const generatedPaymentId = randomUUID()

    const params: PaymentIntentCreateParams = {
      amount: toStripeMinorUnits(amount, currency),
      currency,
      // Customer + PM live on the connected account (Direct Charges); the
      // `Stripe-Account` request header below routes both to the right place.
      customer: connectCustomer.stripeCustomerId,
      capture_method: 'manual',
      // Save the PM for the off-session balance charge. Even when this is the
      // full charge (no deposit, due-now), we still save in case future
      // top-ups need the same card. NOTE: `setup_future_usage='off_session'`
      // combined with `automatic_payment_methods.enabled=true` causes Stripe
      // to filter out PM types that don't support off-session usage. This is
      // the right behaviour for our flow (cards always support it, wallets
      // mostly do); document the constraint here so a future SEPA/iDEAL
      // enablement doesn't silently break.
      setup_future_usage: 'off_session',
      // Direct Charges: platform's cut. The connected account receives
      // `amount - application_fee_amount - Stripe processing fees`. Per
      // https://docs.stripe.com/connect/direct-charges, this is the only
      // routing param needed — no `on_behalf_of` or `transfer_data` because
      // the charge already lives on the connected account.
      application_fee_amount: toStripeMinorUnits(applicationFee, currency),
      // lock down to non-redirect PMs only. Our deferred-mode
      // confirm flow inside the booking page expects `redirect: 'if_required'`
      // to redirect ONLY for 3DS step-up; redirect-only PMs (iDEAL, Bancontact,
      // Klarna, etc.) would bounce the parent off-page even on the happy path,
      // breaking our state machine. A future enable of these PMs must also
      // revisit the return-URL handler in `payment/authorize/page.tsx`.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      // Direct Charges: the charge already lives on the connected account, so
      // its `settings.payments.statement_descriptor` is what shows on the
      // cardholder statement. Append a per-intent suffix so parents can
      // recognize the booking ("CAMPS-CH * BG-12345") and don't call support
      // over an unfamiliar charge.
      statement_descriptor_suffix: buildStatementDescriptorSuffix(group.bookingGroupNumber),
      // Surfaces in the Stripe dashboard search/list views; saves operators
      // from cross-referencing metadata to identify a charge during triage.
      description: `World Camps booking ${group.bookingGroupNumber} (${kind})`,
      metadata: {
        bookingGroupId: group.id,
        bookingGroupNumber: group.bookingGroupNumber,
        kind,
        paymentId: generatedPaymentId,
      },
    }
    const idempotencyKey = buildIdempotencyKey(`pi:bg:${group.id}:${kind}`, params)

    const intent = await withStripeErrors(() =>
      this.stripeService.client.paymentIntents.create(params, {
        idempotencyKey,
        stripeAccount: stripeAccountId,
      })
    )
    if (!intent.client_secret) {
      throw new Error(`Stripe PaymentIntent ${intent.id} returned no client_secret`)
    }

    const initialStatus = translateStatus(intent.status)
    const payment = await this.prisma.payment.create({
      data: {
        id: generatedPaymentId,
        bookingGroupId: group.id,
        kind,
        stripePaymentIntentId: intent.id,
        providerConnectCustomerId: connectCustomer.id,
        amount,
        applicationFeeAmount: new Prisma.Decimal(applicationFee),
        currency,
        stripeAccountId,
        status: initialStatus,
        captureMethod: CaptureMethod.manual,
        idempotencyKey,
        // H8: every freshly-authorized intent is in-flight by definition.
        // Stamping at create time means even rows that never receive a
        // status update (orphaned auths) get picked up by the auth-expiry
        // monitor cron (B9).
        processingStartedAt: new Date(),
      },
    })

    billingAudit(this.logger, 'authorize', {
      bookingGroupId: group.id,
      paymentId: payment.id,
      intentId: intent.id,
      kind,
      amount: amount.toFixed(2),
      currency,
    })

    return {
      paymentId: payment.id,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amount: amount.toFixed(2),
      currency,
    }
  }

  private async loadBookingGroupOrThrow(bookingGroupId: string) {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      include: {
        parent: { include: { user: true } },
        provider: { include: { settings: true } },
      },
    })
    if (!group) throw new NotFoundException(`BookingGroup ${bookingGroupId} not found`)
    return group
  }

  /**
   * Ensures a `(parent, provider)` Stripe customer exists on the connected
   * (provider) account, returning the resolved row. Under Direct Charges, the
   * Customer + PaymentMethods must live on the connected account that the
   * PaymentIntent runs on — one platform-side Customer is no longer usable.
   *
   * Concurrency: Stripe's idempotency key (hashed on `(parentId, providerId)`)
   * guarantees a second parallel caller gets the same `cus_…` back from Stripe.
   * The DB race is resolved by the `@@unique([parentId, providerId])` constraint
   * on `ProviderConnectCustomer` — the losing caller catches the P2002 unique-
   * violation, refetches, and returns the existing row.
   *
   * Idempotency key is hashed on `(parentId, providerId)` ONLY (not email/name)
   * so a parent who edits their profile mid-booking doesn't get a second Stripe
   * customer minted on the next call.
   */
  private async ensureProviderConnectCustomer(
    parentId: string,
    providerId: string,
    stripeAccountId: string
  ): Promise<{ id: string; stripeCustomerId: string; stripeAccountId: string }> {
    const existing = await this.prisma.providerConnectCustomer.findUnique({
      where: { parentId_providerId: { parentId, providerId } },
    })
    if (existing) {
      return {
        id: existing.id,
        stripeCustomerId: existing.stripeCustomerId,
        stripeAccountId: existing.stripeAccountId,
      }
    }

    const parent = await this.prisma.parent.findUnique({
      where: { id: parentId },
      include: { user: true },
    })
    if (!parent) throw new NotFoundException(`Parent ${parentId} not found`)

    const params: CustomerCreateParams = {
      email: parent.user.email,
      name:
        [parent.user.firstName, parent.user.lastName].filter(Boolean).join(' ').trim() || undefined,
      metadata: { parentId: parent.id, userId: parent.userId, providerId },
    }
    // Hash on (parentId, providerId) only — see docstring for why other fields
    // must NOT contribute to the key.
    const idempotencyKey = buildIdempotencyKey(`customer:connect`, { parentId, providerId })
    const customer = await withStripeErrors(() =>
      this.stripeService.client.customers.create(params, {
        idempotencyKey,
        stripeAccount: stripeAccountId,
      })
    )

    try {
      const row = await this.prisma.providerConnectCustomer.create({
        data: {
          parentId,
          providerId,
          stripeAccountId,
          stripeCustomerId: customer.id,
        },
      })
      return { id: row.id, stripeCustomerId: row.stripeCustomerId, stripeAccountId }
    } catch (err) {
      // Unique-violation on (parentId, providerId): a concurrent caller beat
      // us. Refetch and return the winning row. Stripe's idempotency cache
      // ensured both calls got the same cus_… back so the two rows would carry
      // the same `stripeCustomerId` — but emit a structured audit if they
      // diverge so reconciliation can pick it up (mirrors the orphan-account
      // pattern in stripe-connect.service.ts).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await this.prisma.providerConnectCustomer.findUniqueOrThrow({
          where: { parentId_providerId: { parentId, providerId } },
        })
        if (winner.stripeCustomerId !== customer.id) {
          this.logger.error(
            `Stripe connect customer orphan: parent=${parentId} provider=${providerId} stored=${winner.stripeCustomerId} returned=${customer.id}. Reconciliation required.`
          )
          billingAudit(this.logger, 'connect_customer_orphan_detected', {
            parentId,
            providerId,
            stripeCustomerIdStored: winner.stripeCustomerId,
            stripeCustomerIdReturned: customer.id,
          })
        }
        return {
          id: winner.id,
          stripeCustomerId: winner.stripeCustomerId,
          stripeAccountId: winner.stripeAccountId,
        }
      }
      throw err
    }
  }

  private requireCurrency(group: { provider: { settings: { currency: string } | null } }): string {
    const currency = group.provider.settings?.currency
    if (!currency) {
      throw new BadRequestException('Provider has no currency configured')
    }
    return currency.toLowerCase()
  }

  private requireProviderStripeAccount(group: {
    provider: { stripeAccountId: string | null }
  }): string {
    const id = group.provider.stripeAccountId
    if (!id) throw new BadRequestException('Provider has no Stripe account')
    return id
  }

  private requireDepositAmount(group: { depositAmount: Prisma.Decimal | null }): Prisma.Decimal {
    if (!group.depositAmount || group.depositAmount.isZero()) {
      throw new BadRequestException('Booking group has no deposit configured')
    }
    return group.depositAmount
  }

  /**
   * Default spec: 48h window, 2 retries 24h apart. After the configured max
   * attempts, the cron stops retrying and the booking is flagged
   * `payment_failed`. Both the attempt cap and the retry
   * spacing read from `ConfigService.billingConfig` so ops can widen the
   * window per environment.
   */
  private computeNextRetry(attempt: number): Date | null {
    const max = this.maxOffSessionAttempts
    if (attempt >= max) return null
    const retryHours = this.configService?.billingConfig?.retryHours ?? 24
    return new Date(Date.now() + retryHours * 60 * 60 * 1000)
  }
}
