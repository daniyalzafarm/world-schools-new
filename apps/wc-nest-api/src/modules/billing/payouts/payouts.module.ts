import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { RedisModule } from '../../redis/redis.module'
import { StripeModule } from '../../stripe/stripe.module'
import { PayoutReleaseCron } from './crons/payout-release.cron'
import { PayoutsService } from './payouts.service'

@Module({
  imports: [PrismaModule, RedisModule, StripeModule],
  providers: [PayoutsService, PayoutReleaseCron],
  exports: [PayoutsService],
})
export class PayoutsModule {}
