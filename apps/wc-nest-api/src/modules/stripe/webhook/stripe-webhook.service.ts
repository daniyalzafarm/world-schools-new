import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NotificationType } from '@world-schools/wc-types'
import Stripe from 'stripe'
import { Prisma } from '../../../generated/client/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { DisputesService } from '../../billing/disputes/disputes.service'
import { PaymentIntentsService } from '../../billing/intents/payment-intents.service'
import { RefundsService } from '../../billing/refunds/refunds.service'
import { notify } from '../../notifications/dispatcher/notify'

type StripeEvent = ReturnType<InstanceType<typeof Stripe>['webhooks']['constructEvent']>
type StripeAccount = Awaited<ReturnType<InstanceType<typeof Stripe>['accounts']['retrieve']>>
type StripePaymentIntent = Awaited<
  ReturnType<InstanceType<typeof Stripe>['paymentIntents']['retrieve']>
>
type StripeSetupIntent = Awaited<
  ReturnType<InstanceType<typeof Stripe>['setupIntents']['retrieve']>
>
type StripeRefund = Awaited<ReturnType<InstanceType<typeof Stripe>['refunds']['retrieve']>>
type StripeCharge = Awaited<ReturnType<InstanceType<typeof Stripe>['charges']['retrieve']>>
type StripeDispute = Awaited<ReturnType<InstanceType<typeof Stripe>['disputes']['retrieve']>>
type StripePayout = Awaited<ReturnType<InstanceType<typeof Stripe>['payouts']['retrieve']>>
type StripePaymentMethod = Awaited<
  ReturnType<InstanceType<typeof Stripe>['paymentMethods']['retrieve']>
>
type StripeCapability = Awaited<
  ReturnType<InstanceType<typeof Stripe>['accounts']['retrieveCapability']>
>
type StripePerson = Awaited<ReturnType<InstanceType<typeof Stripe>['accounts']['retrievePerson']>>
type StripeExternalAccount = {
  id: string
  object: string
  account?: string | null
  last4?: string | null
  bank_name?: string | null
  status?: string | null
}
type StripeTaxId = {
  id: string
  account?: string | null
  type?: string | null
  verification?: { status?: string | null } | null
}
type StripeTransfer = {
  id: string
  amount: number
  amount_reversed?: number | null
  currency: string
  destination?: string | { id: string } | null
  source_transaction?: string | null
  metadata?: Record<string, string> | null
}
type StripeApplicationFee = {
  id: string
  amount: number
  amount_refunded?: number | null
  currency: string
  account?: string | null
  charge?: string | null
}
type StripeRadarEarlyFraudWarning = {
  id: string
  charge?: string | { id: string } | null
  payment_intent?: string | { id: string } | null
  fraud_type?: string | null
  actionable?: boolean | null
  created?: number | null
}

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentIntentsService: PaymentIntentsService,
    private readonly refundsService: RefundsService,
    private readonly disputesService: DisputesService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Persists the event for audit + dedup, dispatches it to the right handler, and
   * marks it processed on success. Stripe delivers at-least-once and may retry
   * concurrently (parallel webhook + retry windows), so the insert MUST be
   * atomic to avoid TOCTOU: a `findUnique` followed by `create` lets two workers
   * both miss the row and both attempt the create, with the second one failing
   * the unique-key constraint and bubbling up as a 500.
   *
   * The dedup contract:
   *   - First delivery: row upserted (created), handler runs, processedAt set.
   *   - Retry of an already-processed event: upsert returns the existing row
   *     with `processedAt` set → skipped.
   *   - Retry of a previously-failed event: upsert returns the row with
   *     `processedAt` null → reprocessed (handlers are idempotent).
   *   - Two concurrent deliveries of the same event: upsert serializes on the
   *     PK; both then see `processedAt: null` and both call `dispatch`.
   *     Handlers do last-write-wins updates, so this is safe — the cost is
   *     redundant DB writes, not data corruption.
   *
   * Handler-idempotency contract (H2 audit fix — read before adding handlers):
   *   The dedup row above is best-effort against single-deliverer retries; it
   *   does NOT serialize concurrent same-event deliveries from Stripe (which
   *   happen under retry-storm / network-flap conditions). Every status-changing
   *   handler in this dispatcher MUST therefore enforce idempotency at the data
   *   layer rather than relying on the dedup row alone:
   *     - Status writes go through `updateMany({ where: { id, status: { in: ALLOWED_PRIOR } } })`
   *       so a concurrent winner causes our update to match zero rows.
   *     - Side-effecting writes (e.g. `BookingGroup.paidAmount` increments,
   *       `SavedPaymentMethod` upserts) are gated on the status-claim count
   *       and only run when this invocation is the race winner.
   *     - Webhook-driven row updates MUST tolerate out-of-order delivery:
   *       a later event of one type may arrive *before* an earlier event of
   *       another type (`payment_intent.payment_failed` before
   *       `amount_capturable_updated`, etc.). The prior-status WHERE clause
   *       is what prevents rollback from a terminal state.
   *   New handlers MUST follow this pattern. See the four `mark*` methods on
   *   `PaymentIntentsService` for canonical implementations.
   */
  async processEvent(event: StripeEvent): Promise<void> {
    const accountId = event.account ?? null

    // Atomic insert-if-absent. Replacing the prior `findUnique` + `create` pair
    // with `upsert` closes the TOCTOU window on concurrent same-event delivery.
    const row = await this.prisma.stripeWebhookEvent.upsert({
      where: { id: event.id },
      create: {
        id: event.id,
        type: event.type,
        accountId,
        apiVersion: event.api_version ?? 'unknown',
        payload: event as unknown as Prisma.InputJsonValue,
      },
      update: {},
    })

    if (row.processedAt) {
      this.logger.log(`Skipping already-processed Stripe event ${event.id} [${event.type}]`)
      return
    }

    try {
      await this.dispatch(event)
    } catch (err) {
      const message = (err as Error).message
      await this.prisma.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { processingError: message },
      })
      this.logger.error(
        `Stripe event ${event.id} [${event.type}] handler failed: ${message}`,
        (err as Error).stack
      )
      throw err
    }

    await this.prisma.stripeWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date(), processingError: null },
    })
  }

  private async dispatch(event: StripeEvent): Promise<void> {
    switch (event.type) {
      // ----- Connect account lifecycle ------------------------------------
      case 'account.updated': {
        await this.handleAccountUpdated(event.data.object as StripeAccount)
        return
      }
      case 'account.application.authorized': {
        // Symmetric counterpart of `account.application.deauthorized`. Stripe
        // fires this when a (re-)authorization completes (rare for Express,
        // but possible during onboarding handoff or after a deauth/reauth
        // cycle). We don't mutate DB here — the subsequent `account.updated`
        // delivers the canonical capability snapshot. Logged for the audit
        // trail so reconnections are visible in metrics.
        this.logger.log(
          `webhook.account.application.authorized stripeAccountId=${JSON.stringify(event.account ?? null)}`
        )
        return
      }
      case 'account.application.deauthorized': {
        if (event.account) {
          await this.handleAccountDeauthorized(event.account)
        }
        return
      }
      case 'capability.updated': {
        // Capability-level events arrive before `account.updated` reflects
        // the rolled-up state. Currently we let the trailing `account.updated`
        // do the DB sync, but log the capability transition so on-call can
        // correlate provider-side dashboards with Stripe's internal state.
        const cap = event.data.object as StripeCapability
        this.logger.log(
          `webhook.capability.updated stripeAccountId=${JSON.stringify(cap.account)} ` +
            `capability=${JSON.stringify(cap.id)} status=${JSON.stringify(cap.status)} ` +
            `requested=${JSON.stringify(cap.requested)}`
        )
        return
      }
      case 'account.external_account.created':
      case 'account.external_account.updated':
      case 'account.external_account.deleted': {
        // External-account changes (bank account / debit-card edits for payouts).
        // Today external accounts are fetched live via `accounts.retrieve` on
        // every page load, so we don't need to mutate DB here. Log for the
        // audit trail; switch to an eager re-fetch + cache invalidation when
        // we add a `defaultBankLast4` snapshot column.
        const ea = event.data.object as StripeExternalAccount
        this.logger.log(
          `webhook.${event.type} stripeAccountId=${JSON.stringify(event.account ?? ea.account ?? null)} ` +
            `externalAccountId=${JSON.stringify(ea.id)} object=${JSON.stringify(ea.object)} ` +
            `last4=${JSON.stringify(ea.last4 ?? null)} status=${JSON.stringify(ea.status ?? null)}`
        )
        return
      }
      case 'person.created':
      case 'person.updated':
      case 'person.deleted': {
        // KYC for individual stakeholders on `business_type: company` accounts.
        // Today our flow is individuals-only (verified by the embedded form
        // collecting `individual.*` fields directly), so we audit-log only.
        // When company onboarding is enabled, route to a future
        // `PersonsService` here so director/owner KYC state is mirrored.
        const person = event.data.object as StripePerson
        this.logger.log(
          `webhook.${event.type} stripeAccountId=${JSON.stringify(event.account ?? null)} ` +
            `personId=${JSON.stringify(person.id)} ` +
            `verification=${JSON.stringify(person.verification?.status ?? null)}`
        )
        return
      }
      // Note: `account.tax_id.*` events are intentionally handled in the
      // `default` branch below — the Stripe SDK's type union for the pinned
      // API version does not include them as discriminated literals, so
      // listing them as `case` clauses produces a `TS2678` "type not
      // comparable" compile error. Runtime-detect them by string prefix
      // instead, with the same audit-log semantic as the other Connect
      // lifecycle events above.

      // ----- PaymentIntent lifecycle (deposit + balance + full charges) ----
      case 'payment_intent.amount_capturable_updated': {
        await this.paymentIntentsService.markCapturable(event.data.object as StripePaymentIntent)
        return
      }
      case 'payment_intent.succeeded': {
        await this.paymentIntentsService.markSucceeded(event.data.object as StripePaymentIntent)
        return
      }
      case 'payment_intent.payment_failed': {
        await this.paymentIntentsService.markFailed(event.data.object as StripePaymentIntent)
        return
      }
      case 'payment_intent.canceled': {
        await this.paymentIntentsService.markCanceled(event.data.object as StripePaymentIntent)
        return
      }
      case 'payment_intent.requires_action': {
        // B2 audit fix: Stripe fires this when a payment intent needs further
        // action (typically async 3DS step-up triggered by additional fraud
        // signals after auth). The synchronous create response in
        // `chargeOffSession` already handles the immediate case; this webhook
        // is the safety net for delayed transitions.
        await this.paymentIntentsService.markRequiresAction(
          event.data.object as StripePaymentIntent
        )
        return
      }
      case 'payment_intent.processing': {
        // P1 audit fix: explicit handler for PMs that go through `processing`
        // (some bank-redirects, future SEPA/iDEAL). Cards skip this state.
        await this.paymentIntentsService.markProcessing(event.data.object as StripePaymentIntent)
        return
      }
      case 'payment_intent.partially_funded': {
        // P1 audit fix: documented in the official Custom Flow event list.
        // We don't accept partial funding for our flow today; audit-log so
        // a future enable doesn't go silent.
        const intent = event.data.object as StripePaymentIntent
        this.logger.log(
          `webhook.payment_intent.partially_funded paymentIntentId=${JSON.stringify(intent.id)} ` +
            `amountReceived=${JSON.stringify(intent.amount_received)} ` +
            `amount=${JSON.stringify(intent.amount)}`
        )
        return
      }

      // ----- Charge lifecycle (P1: explicit handlers for forensic audit) ---
      // Subsumed by payment_intent.* for our card flow today, but explicit
      // handling de-risks future PM enablement and gives ops a per-event
      // audit trail of charge-level lifecycle.
      case 'charge.succeeded':
      case 'charge.captured':
      case 'charge.failed':
      case 'charge.updated': {
        const charge = event.data.object as StripeCharge
        this.logger.log(
          `webhook.${event.type} chargeId=${JSON.stringify(charge.id)} ` +
            `paymentIntentId=${JSON.stringify(typeof charge.payment_intent === 'string' ? charge.payment_intent : (charge.payment_intent?.id ?? null))} ` +
            `status=${JSON.stringify(charge.status)} amount=${JSON.stringify(charge.amount)} ` +
            `currency=${JSON.stringify(charge.currency)}`
        )
        return
      }

      // ----- Radar (pre-chargeback signals) -------------------------------
      case 'radar.early_fraud_warning.created': {
        // B3 audit fix: pre-chargeback signal. For Destination Charges where
        // the provider is the merchant of record, EFWs are the only proactive
        // way to refund before a dispute fires (saving dispute fees).
        // Annotate the matching Payment row + emit an alert-grade structured
        // log; auto-refund is a follow-up PR (gated on `actionable`).
        await this.handleRadarEarlyFraudWarning(event.data.object as StripeRadarEarlyFraudWarning)
        return
      }

      // ----- Transfers (B4: forensic audit of fund movement) --------------
      case 'transfer.created':
      case 'transfer.updated':
      case 'transfer.reversed': {
        const transfer = event.data.object as StripeTransfer
        this.logger.log(
          `webhook.${event.type} transferId=${JSON.stringify(transfer.id)} ` +
            `destination=${JSON.stringify(typeof transfer.destination === 'string' ? transfer.destination : (transfer.destination?.id ?? null))} ` +
            `amount=${JSON.stringify(transfer.amount)} amountReversed=${JSON.stringify(transfer.amount_reversed)} ` +
            `currency=${JSON.stringify(transfer.currency)} sourceTransaction=${JSON.stringify(transfer.source_transaction ?? null)}`
        )
        return
      }

      // ----- Application fees (B5: keep our snapshot honest) --------------
      // Note: `application_fee.updated` and `application_fee.refund.updated`
      // are intentionally handled in the `default` branch via prefix-match
      // because the Stripe SDK type union for the pinned API version omits
      // them as discriminated literals (same TS2678 problem as the
      // `account.tax_id.*` events). `created` and `refunded` ARE in the
      // union so they get explicit cases here.
      case 'application_fee.created':
      case 'application_fee.refunded': {
        const fee = event.data.object as StripeApplicationFee
        this.logger.log(
          `webhook.${event.type} applicationFeeId=${JSON.stringify(fee.id)} ` +
            `account=${JSON.stringify(fee.account ?? null)} chargeId=${JSON.stringify(fee.charge ?? null)} ` +
            `amount=${JSON.stringify(fee.amount)} amountRefunded=${JSON.stringify(fee.amount_refunded)} ` +
            `currency=${JSON.stringify(fee.currency)}`
        )
        return
      }

      // ----- SetupIntent lifecycle (save-card for off-session balance) -----
      case 'setup_intent.succeeded': {
        await this.paymentIntentsService.markSetupSucceeded(event.data.object as StripeSetupIntent)
        return
      }
      case 'setup_intent.setup_failed': {
        this.paymentIntentsService.markSetupFailed(event.data.object as StripeSetupIntent)
        return
      }

      // ----- Saved payment methods ----------------------------------------
      case 'payment_method.detached': {
        await this.paymentIntentsService.markPmDetached(event.data.object as StripePaymentMethod)
        return
      }

      // ----- Refunds -------------------------------------------------------
      case 'refund.updated':
      case 'refund.created': {
        await this.refundsService.markRefundCompleted(event.data.object as StripeRefund)
        return
      }
      case 'charge.refunded': {
        // The Charge object's `refunds.data` carries the underlying Refunds.
        // We sync each one. Idempotent at the Refund row level.
        await this.refundsService.syncFromCharge(event.data.object as StripeCharge)
        return
      }

      // ----- Disputes ------------------------------------------------------
      case 'charge.dispute.created':
      case 'charge.dispute.updated': {
        await this.disputesService.handleCreated(event.data.object as StripeDispute)
        return
      }
      case 'charge.dispute.closed': {
        await this.disputesService.handleClosed(event.data.object as StripeDispute)
        return
      }
      case 'charge.dispute.funds_withdrawn':
      case 'charge.dispute.funds_reinstated': {
        await this.disputesService.handleFundsMovement(
          event.data.object as StripeDispute,
          event.type === 'charge.dispute.funds_withdrawn' ? 'withdrawn' : 'reinstated'
        )
        return
      }

      // ----- Payouts (connected-account funds → bank) ----------------------
      // Payments revamp (Spec v2.3): the platform no longer schedules or tracks
      // payouts — providers receive Stripe automatic payouts on their own
      // schedule. All payout events are now LOG-ONLY (informational); there is no
      // `PayoutEvent` row or `PayoutsService` to update.
      case 'payout.paid':
      case 'payout.failed':
      case 'payout.created':
      case 'payout.updated':
      case 'payout.canceled': {
        const payout = event.data.object as StripePayout
        this.logger.log(
          `webhook.${event.type} stripeAccountId=${JSON.stringify(event.account ?? null)} ` +
            `payoutId=${JSON.stringify(payout.id)} status=${JSON.stringify(payout.status)} ` +
            `amount=${JSON.stringify(payout.amount)}`
        )
        return
      }

      default: {
        // Routes for events whose literal types are NOT in the Stripe SDK's
        // pinned-version union (which would otherwise produce TS2678 "type
        // not comparable" compile errors as case clauses):
        //   - `account.tax_id.*`: tax-ID submission lifecycle for connected
        //     accounts. Audit-log only; verification status propagates via
        //     `account.updated.requirements`.
        //   - `application_fee.updated` and `application_fee.refund.updated`:
        //     mid-lifecycle fee + fee-refund metadata changes. Audit-log so
        //     a future fee-snapshot reconciliation has the events.
        const eventType = event.type as string
        if (eventType.startsWith('account.tax_id.')) {
          const tax = event.data.object as unknown as StripeTaxId
          this.logger.log(
            `webhook.${eventType} stripeAccountId=${JSON.stringify(event.account ?? tax.account ?? null)} ` +
              `taxIdId=${JSON.stringify(tax.id)} verification=${JSON.stringify(tax.verification?.status ?? null)}`
          )
          return
        }
        if (
          eventType === 'application_fee.updated' ||
          eventType === 'application_fee.refund.updated'
        ) {
          this.logger.log(`webhook.${eventType} eventId=${JSON.stringify(event.id)}`)
          return
        }

        // L7: log at info, not debug — debug is suppressed at default log
        // levels, which makes it invisible during early operations when we
        // most want to know whether Stripe is sending event types we don't
        // yet handle (e.g. new capability events, rolling-KYC notifications).
        this.logger.log(`Unhandled Stripe webhook event type: ${eventType}`)
      }
    }
  }

  /**
   * `radar.early_fraud_warning.created` — Stripe's early-fraud pre-chargeback
   * signal. Under Direct Charges the charge lives on the connected (provider)
   * account and EFWs are the only proactive way to refund before the chargeback
   * fires — which avoids the dispute fees the platform absorbs under our
   * controller-liability config.
   *
   * Behavior:
   *   1. Resolve the EFW to a matching Payment row (charge id first, then PI).
   *   2. Stamp `Payment.failureCode = 'early_fraud_warning'` if the row was
   *      previously clean (preserves prior failure codes for triage).
   *   3. Emit an ERROR-level structured log for alert-grade visibility.
   *   4. H1 audit fix: if Stripe marked the EFW `actionable: true`, fire an
   *      automatic 100% refund (`RefundReason.fraud`, app-fee included). The
   *      platform absorbs the cost on the theory that a refund-now is cheaper
   *      than the chargeback + fees that would otherwise follow. Non-actionable
   *      EFWs do NOT auto-refund — Stripe sets `actionable=false` for noisy /
   *      low-confidence signals, and historically those have too many false
   *      positives to act on without human review.
   *
   * The auto-refund is wrapped in its own try/catch so a Stripe-side failure
   * doesn't crash the webhook — the EFW alert log + Payment annotation are
   * already in place, and the refund can be retried by an admin.
   */
  async handleRadarEarlyFraudWarning(efw: StripeRadarEarlyFraudWarning): Promise<void> {
    const chargeId = typeof efw.charge === 'string' ? efw.charge : (efw.charge?.id ?? null)
    const intentId =
      typeof efw.payment_intent === 'string' ? efw.payment_intent : (efw.payment_intent?.id ?? null)

    if (!chargeId && !intentId) {
      this.logger.warn(
        `radar.early_fraud_warning.created has no charge or payment_intent id (efw=${efw.id}) — cannot correlate`
      )
      return
    }

    const payment = await this.prisma.payment.findFirst({
      where: chargeId ? { stripeChargeId: chargeId } : { stripePaymentIntentId: intentId! },
      select: { id: true, bookingGroupId: true, failureCode: true },
    })
    if (!payment) {
      this.logger.warn(
        `radar.early_fraud_warning.created chargeId=${chargeId} intentId=${intentId} efw=${efw.id} — no matching Payment row`
      )
      return
    }

    // Only stamp `failureCode` when the row is clean — preserve any prior
    // failure code (decline reason etc.) for the admin triage timeline.
    if (!payment.failureCode) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          failureCode: 'early_fraud_warning',
          failureMessage: `Stripe Radar early fraud warning${efw.fraud_type ? ` (${efw.fraud_type})` : ''} — review before payout`,
        },
      })
    }

    // ERROR-level so the alert hook fires even though the payment isn't in
    // a failed state — this is a "react fast" signal.
    this.logger.error(
      `radar.early_fraud_warning paymentId=${payment.id} bookingGroupId=${payment.bookingGroupId} ` +
        `efwId=${efw.id} fraudType=${efw.fraud_type ?? 'unknown'} actionable=${efw.actionable ?? false}`
    )

    // H1 audit fix: auto-refund actionable EFWs.
    if (efw.actionable === true) {
      try {
        const refunds = await this.refundsService.processFraudRefund({
          bookingGroupId: payment.bookingGroupId,
        })
        this.logger.warn(
          `radar.early_fraud_warning auto-refund issued bookingGroupId=${payment.bookingGroupId} ` +
            `efwId=${efw.id} refundCount=${refunds.length}`
        )
      } catch (err) {
        // Never crash the webhook on refund failure — the alert + Payment
        // annotation are already persisted, and an admin can retry the
        // refund manually from the dashboard.
        this.logger.error(
          `radar.early_fraud_warning auto-refund FAILED bookingGroupId=${payment.bookingGroupId} ` +
            `efwId=${efw.id}: ${(err as Error).message ?? err}`
        )
      }
    }
  }

  // Replay-safe: each invocation overwrites the same fields with the latest snapshot,
  // so duplicate delivery of the same event id is harmless beyond the dedup short-circuit.
  async handleAccountUpdated(account: StripeAccount): Promise<void> {
    const provider = await this.prisma.provider.findUnique({
      where: { stripeAccountId: account.id },
    })

    if (!provider) {
      this.logger.warn(`Received account.updated for unknown Stripe account: ${account.id}`)
      return
    }

    // H11: derive a single boolean signal from the requirements payload so
    // dashboard surfaces can highlight providers needing action without
    // needing to fetch the live Stripe account.
    const currentlyDue = account.requirements?.currently_due ?? []
    const pastDue = account.requirements?.past_due ?? []
    const attentionRequired = currentlyDue.length > 0 || pastDue.length > 0

    // M4: skip the write entirely when nothing changed. Stripe re-emits
    // `account.updated` for every minor capability shift, and most of those
    // are no-ops on our side — saves DB writes / WAL traffic at scale.
    const unchanged =
      provider.stripeChargesEnabled === account.charges_enabled &&
      provider.stripePayoutsEnabled === account.payouts_enabled &&
      provider.stripeDetailsSubmitted === account.details_submitted &&
      provider.stripeAttentionRequired === attentionRequired

    if (unchanged) {
      this.logger.debug(`account.updated for provider ${provider.id} is a no-op — skipping write`)
      return
    }

    await this.prisma.provider.update({
      where: { id: provider.id },
      data: {
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled,
        stripeDetailsSubmitted: account.details_submitted,
        stripeAttentionRequired: attentionRequired,
      },
    })

    this.logger.log(
      `Synced Stripe account status for provider ${provider.id}: ` +
        `charges=${account.charges_enabled}, payouts=${account.payouts_enabled}, ` +
        `details=${account.details_submitted}, attention=${attentionRequired}`
    )
  }

  // Replay-safe: clearing the same fields twice is a no-op after the first call.
  async handleAccountDeauthorized(accountId: string): Promise<void> {
    const provider = await this.prisma.provider.findUnique({
      where: { stripeAccountId: accountId },
    })

    if (!provider) {
      // H7: this is a healthy convergence outcome — `getAccountStatus` already
      // scrubbed the cached `stripeAccountId` via the `resource_missing` path
      // when the account was deleted Stripe-side, and the deauth webhook is
      // arriving after the fact. Logged at INFO (not WARN) so it doesn't
      // pollute alerts on the orphan-detection signal.
      this.logger.log(
        `Deauthorization for Stripe account ${accountId} — provider already cleared (likely a post-scrub convergence)`
      )
      return
    }

    await this.prisma.provider.update({
      where: { id: provider.id },
      data: {
        stripeAccountId: null,
        stripeOnboardingCompleted: false,
        stripeOnboardingCompletedAt: null,
        stripeOnboardingSkippedAt: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        stripeAttentionRequired: false,
        // v28 notification trigger fields. The catalog `Provider_Stripe_*`
        // entries (Phase 8) read these to render the "your Stripe account
        // was disconnected" notification with timing + reason. Cleared on
        // re-connect via `StripeConnectService` (Phase 8 wiring).
        stripeAccountDisconnectedAt: new Date(),
        stripeAccountDisconnectedReason: 'stripe_webhook_deauthorized',
        // B2: `appFeePercentage` is deliberately NOT cleared. App-fee fields
        // are managed exclusively by the superadmin (Phase 5 audit) and a
        // Stripe disconnect is a payment-rails change, not a commercial-terms
        // change. The negotiated rate must survive a deauth/reauth round-trip.
        // This matches the resource_missing scrub at
        // `StripeConnectService.scrubIfResourceMissing` — keep the two
        // semantics in sync.
      },
    })

    this.logger.log(`Provider ${provider.id} disconnected their Stripe account ${accountId}`)

    // v28 catalog dispatch — Phase 8a.
    notify(this.eventEmitter, NotificationType.ProviderStripeDisconnected, {
      providerId: provider.id,
    })
    // v28 Phase 9 — superadmin mirror. Platform team intervenes when a
    // camp loses payouts (no new bookings can be accepted).
    notify(this.eventEmitter, NotificationType.SuperadminCampStripeDisconnected, {
      providerId: provider.id,
    })
  }
}
