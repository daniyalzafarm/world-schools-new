import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { BillingModule } from '../../billing/billing.module'
import { PaymentReviewController } from './payment-review.controller'
import { PaymentReviewService } from './payment-review.service'

/**
 * Payment-review queue (Payments revamp, Spec v2.3 §7). Thin superadmin surface
 * over the billing services — pulls `RefundsService` / `PaymentIntentsService` /
 * `PaymentAuditLogService` from `BillingModule`'s exports.
 */
@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [PaymentReviewController],
  providers: [PaymentReviewService],
})
export class PaymentReviewModule {}
