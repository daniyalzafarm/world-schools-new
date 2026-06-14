import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { RedisModule } from '../../redis/redis.module'
import { PaymentIntentsModule } from '../intents/payment-intents.module'
import { PaymentAuditLogService } from '../shared/payment-audit-log.service'
import { CaptureEngineService } from './capture-engine.service'
import { CancelCaptureService } from './cancel-capture.service'
import { EnqueueCaptureService } from './enqueue-capture.service'
import { ScheduledCaptureReconciliationCron } from './crons/scheduled-capture-reconciliation.cron'
import { ScheduledCapturesQueueModule } from './scheduled-captures.queue'
import { ScheduledCapturesWorker } from './scheduled-captures.worker'

/**
 * Payments revamp (Spec v2.3) — the scheduled-capture engine: a delayed BullMQ
 * job per capture (primary) + an hourly reconciliation cron (backstop), both
 * converging on `CaptureEngineService`, which owns the acceptance guard, the
 * atomic claim, and idempotency.
 *
 * Exports the enqueue + cancel services (used by the acceptance flow and the
 * shared cancellation sink) and the append-only `PaymentAuditLogService` (used
 * by captures now and by refunds / Force Majeure in later steps).
 */
@Module({
  imports: [PrismaModule, RedisModule, PaymentIntentsModule, ScheduledCapturesQueueModule],
  providers: [
    CaptureEngineService,
    EnqueueCaptureService,
    CancelCaptureService,
    ScheduledCapturesWorker,
    ScheduledCaptureReconciliationCron,
    PaymentAuditLogService,
  ],
  exports: [
    EnqueueCaptureService,
    CancelCaptureService,
    PaymentAuditLogService,
    CaptureEngineService,
  ],
})
export class CapturesModule {}
