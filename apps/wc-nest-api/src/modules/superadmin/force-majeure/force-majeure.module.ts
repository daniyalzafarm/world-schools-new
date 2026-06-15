import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { BillingModule } from '../../billing/billing.module'
import { ForceMajeureController } from './force-majeure.controller'
import { ForceMajeureService } from './force-majeure.service'

/**
 * Force Majeure bulk tool (Payments revamp, Spec v2.3 §8). Pulls
 * `RefundsService` / `PaymentIntentsService` from `BillingModule`'s exports.
 */
@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [ForceMajeureController],
  providers: [ForceMajeureService],
})
export class ForceMajeureModule {}
