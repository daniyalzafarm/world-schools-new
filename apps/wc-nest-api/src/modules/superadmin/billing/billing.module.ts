import { Module } from '@nestjs/common'
import { BillingModule } from '../../billing/billing.module'
import { ProviderReviewModule } from '../provider-review/provider-review.module'
import { SuperAdminBillingController } from './billing.controller'

/**
 * Aggregates the superadmin-side billing endpoints (refund triggers +
 * reimbursement management). Pulls services from `BillingModule`'s exports,
 * so this module owns no business logic of its own — it's a thin HTTP
 * surface in front of `RefundsService`, `ReimbursementsService`, and
 * `PaymentIntentsService`.
 */
@Module({
  imports: [BillingModule, ProviderReviewModule],
  controllers: [SuperAdminBillingController],
})
export class SuperAdminBillingModule {}
