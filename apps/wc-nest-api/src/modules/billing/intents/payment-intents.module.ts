import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { EmailTemplatesModule } from '../../common/email-templates/email-templates.module'
import { RedisModule } from '../../redis/redis.module'
import { StripeConnectModule } from '../../provider/stripe-connect/stripe-connect.module'
import { AuthExpiryMonitorCron } from './crons/auth-expiry-monitor.cron'
import { BalanceChargeCron } from './crons/balance-charge.cron'
import { BillingPaymentNotificationsService } from './notifications/billing-payment-notifications.service'
import { PaymentIntentsService } from './payment-intents.service'

@Module({
  imports: [PrismaModule, ConfigModule, RedisModule, StripeConnectModule, EmailTemplatesModule],
  providers: [
    PaymentIntentsService,
    BalanceChargeCron,
    AuthExpiryMonitorCron,
    BillingPaymentNotificationsService,
  ],
  exports: [PaymentIntentsService],
})
export class PaymentIntentsModule {}
