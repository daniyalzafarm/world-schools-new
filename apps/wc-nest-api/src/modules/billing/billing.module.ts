import { Module } from '@nestjs/common'
import { ConfigModule } from '../../config/config.module'
import { PrismaModule } from '../../prisma/prisma.module'
import { RedisModule } from '../redis/redis.module'
import { WebhookEventRetentionCron } from '../stripe/webhook/crons/webhook-event-retention.cron'
import { StripeWebhookController } from '../stripe/webhook/stripe-webhook.controller'
import { StripeWebhookService } from '../stripe/webhook/stripe-webhook.service'
import { CapturesModule } from './captures/captures.module'
import { DisputesModule } from './disputes/disputes.module'
import { PaymentIntentsModule } from './intents/payment-intents.module'
import { PayoutsModule } from './payouts/payouts.module'
import { RefundsModule } from './refunds/refunds.module'
import { ReimbursementsModule } from './reimbursements/reimbursements.module'

/**
 * Umbrella for all billing/payments domain submodules.
 *
 * Consumer modules (e.g. BookingGroupsModule) import BillingModule and pull
 * the specific service they need from its exports. This keeps the rest of
 * the app from having to know the sub-module structure of `billing/`, and
 * lets us reorganize internals without churning imports across the app.
 *
 * The Stripe webhook controller + service are registered here (rather than
 * in `StripeModule`) so they can inject the billing services without
 * creating a circular module import. `StripeModule` remains a pure SDK
 * wrapper module.
 *
 * `ConfigModule` is imported because `StripeWebhookController` injects
 * `ConfigService` (for the webhook signing secret). The submodules don't
 * need it directly — only the webhook controller does — but Nest's
 * dependency-resolution treats it as a same-module requirement, so it must
 * be in this module's `imports`.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    // H1: `WebhookEventRetentionCron` needs `RedisService` for the Redis lock
    // that gates concurrent runs across pods.
    RedisModule,
    PaymentIntentsModule,
    CapturesModule,
    RefundsModule,
    PayoutsModule,
    DisputesModule,
    ReimbursementsModule,
  ],
  controllers: [StripeWebhookController],
  providers: [StripeWebhookService, WebhookEventRetentionCron],
  exports: [
    PaymentIntentsModule,
    CapturesModule,
    RefundsModule,
    PayoutsModule,
    DisputesModule,
    ReimbursementsModule,
  ],
})
export class BillingModule {}
