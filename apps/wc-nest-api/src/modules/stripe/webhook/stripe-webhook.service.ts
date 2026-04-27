import { Injectable, Logger } from '@nestjs/common'
import Stripe from 'stripe'
import { Prisma } from '../../../generated/client/client'
import { PrismaService } from '../../../prisma/prisma.service'

type StripeEvent = ReturnType<InstanceType<typeof Stripe>['webhooks']['constructEvent']>
type StripeAccount = Awaited<ReturnType<InstanceType<typeof Stripe>['accounts']['retrieve']>>

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name)

  constructor(private readonly prisma: PrismaService) {}

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
      case 'account.updated': {
        await this.handleAccountUpdated(event.data.object as StripeAccount)
        return
      }
      case 'account.application.deauthorized': {
        if (event.account) {
          await this.handleAccountDeauthorized(event.account)
        }
        return
      }
      default:
        // L7: log at info, not debug — debug is suppressed at default log
        // levels, which makes it invisible during early operations when we
        // most want to know whether Stripe is sending event types we don't
        // yet handle (e.g. new capability events, rolling-KYC notifications).
        this.logger.log(`Unhandled Stripe webhook event type: ${event.type}`)
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
      this.logger.warn(`Received deauthorization for unknown Stripe account: ${accountId}`)
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
        // Clear the snapshotted commission too — leaving it set produces an
        // incoherent UI ("10% commission, no account"). On reconnect, the
        // current platform default will be re-snapshotted by createOrGetAccount.
        stripeCommissionPercentage: null,
      },
    })

    this.logger.log(`Provider ${provider.id} disconnected their Stripe account ${accountId}`)
  }
}
