import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '../../config/config.module'
import { PrismaModule } from '../../prisma/prisma.module'
import { StripeService } from './stripe.service'

/**
 * Provides the Stripe SDK client (`StripeService`) globally.
 *
 * The webhook controller + service used to live here, but they need to call
 * into PaymentIntentsService / RefundsService / etc. which live under
 * `modules/billing/`. To avoid a circular import (StripeModule → BillingModule
 * → StripeService back) the webhook handler is now registered in BillingModule.
 * StripeService itself stays here since it's a pure SDK wrapper with no
 * billing-domain dependencies.
 */
@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
