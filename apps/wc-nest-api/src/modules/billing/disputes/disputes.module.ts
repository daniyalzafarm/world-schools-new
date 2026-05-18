import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { StripeModule } from '../../stripe/stripe.module'
import { DisputesService } from './disputes.service'

@Module({
  imports: [PrismaModule, StripeModule],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
