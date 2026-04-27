import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '../../config/config.module'
import { PrismaModule } from '../../prisma/prisma.module'
import { StripeService } from './stripe.service'
import { StripeWebhookController } from './webhook/stripe-webhook.controller'
import { StripeWebhookService } from './webhook/stripe-webhook.service'

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [StripeWebhookController],
  providers: [StripeService, StripeWebhookService],
  exports: [StripeService],
})
export class StripeModule {}
