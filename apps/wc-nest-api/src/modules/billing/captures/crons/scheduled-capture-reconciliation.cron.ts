import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ScheduledCaptureStatus } from '../../../../generated/client/enums'
import { PrismaService } from '../../../../prisma/prisma.service'
import { RedisService } from '../../../redis/redis.service'
import { CAPTURE_ELIGIBLE_STATUSES } from '../../shared/capture-eligible-statuses'
import { CaptureEngineService } from '../capture-engine.service'

const LOCK_KEY = 'cron:lock:scheduled-captures'
const LOCK_TTL_SECONDS = 600 // 10 min — comfortably longer than a worst-case batch
const BATCH_SIZE = 200

/**
 * Backstop for the delayed-job capture engine (Payments revamp, Spec v2.3).
 * Derives due captures from STATE — not from remembered BullMQ jobs — so a lost
 * job (Redis flush, worker crash mid-fire) is still captured at/after its
 * boundary. The delayed job and this cron may race the same row; the engine's
 * atomic claim + Stripe idempotency key make that harmless.
 *
 * Eligibility encodes the acceptance guard: a row is due only when its booking
 * is in a capture-eligible status AND has an acceptance time (`respondedAt`) —
 * the same `CAPTURE_ELIGIBLE_STATUSES` set used by the engine and the
 * off-session pickup query, so the three never drift.
 */
@Injectable()
export class ScheduledCaptureReconciliationCron {
  private readonly logger = new Logger(ScheduledCaptureReconciliationCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly engine: CaptureEngineService
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const redis = this.redis.getClient()
    const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    if (!acquired) {
      this.logger.debug('scheduled-capture reconciliation already running elsewhere, skipping')
      return
    }
    try {
      await this.runBatch()
    } finally {
      await redis.del(LOCK_KEY)
    }
  }

  /**
   * Visible for testing — runs the batch without the Redis lock so specs can
   * drive it directly with a mocked Prisma + engine and a fixed `now`.
   */
  async runBatch(
    now: Date = new Date()
  ): Promise<{ processed: number; completed: number; failed: number }> {
    const due = await this.prisma.bookingScheduledCapture.findMany({
      where: {
        status: ScheduledCaptureStatus.scheduled,
        effectiveCaptureDate: { lte: now },
        bookingGroup: {
          status: { in: CAPTURE_ELIGIBLE_STATUSES },
          respondedAt: { not: null },
        },
      },
      select: { bookingGroupId: true, sequence: true },
      orderBy: { effectiveCaptureDate: 'asc' },
      take: BATCH_SIZE,
    })

    let completed = 0
    let failed = 0
    for (const row of due) {
      const outcome = await this.engine.executeCapture(row.bookingGroupId, row.sequence, now)
      if (outcome.status === 'completed') completed++
      else if (outcome.status === 'failed') failed++
    }

    if (due.length > 0) {
      this.logger.log(
        `scheduled-capture reconciliation: processed=${due.length} completed=${completed} failed=${failed}`
      )
    }
    return { processed: due.length, completed, failed }
  }
}
