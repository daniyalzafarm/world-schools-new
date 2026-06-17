import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { CapturesModule } from '../captures/captures.module'
import { RescheduleService } from './reschedule.service'

/**
 * Programme Reschedule by Provider (Payments revamp, Spec v2.5 §9.7).
 *
 * Pulls the capture scheduler (recompute/plan/write/dispatch) and the append-only
 * audit service from `CapturesModule`. Exposed via `BillingModule` so the
 * provider + user booking-group controllers can drive the propose / consent /
 * decline flow.
 */
@Module({
  imports: [PrismaModule, CapturesModule],
  providers: [RescheduleService],
  exports: [RescheduleService],
})
export class RescheduleModule {}
