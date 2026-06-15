import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ProviderAdminReviewQueueService } from './provider-admin-review.service'
import { ProviderReviewController } from './provider-review.controller'

/**
 * Provider admin-review queue (Payments revamp, Spec v2.3 §4). Owns the
 * `ProviderAdminReviewQueueService` and its superadmin HTTP surface; exports the
 * service so producers (e.g. the superadmin billing controller's provider-cancel
 * endpoint) can open a review after a cancellation commits.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ProviderReviewController],
  providers: [ProviderAdminReviewQueueService],
  exports: [ProviderAdminReviewQueueService],
})
export class ProviderReviewModule {}
