import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PayoutTrancheStatus } from '../../../../generated/client/enums'
import { PrismaService } from '../../../../prisma/prisma.service'
import { RedisService } from '../../../redis/redis.service'
import { PayoutsService } from '../payouts.service'

const LOCK_KEY = 'cron:lock:payout-release'
const LOCK_TTL_SECONDS = 600
const BATCH_SIZE = 200

/**
 * Phase 8 — payout-release cron.
 *
 * Walks `BookingPayoutSchedule` for rows where `status = pending` and
 * `releaseAt <= now`, then calls `PayoutsService.releasePendingTranche`
 * for each. Replaces the legacy "wall-clock check on BookingGroup.transferDate"
 * model with a single query against the unified tranche table — covers all
 * three payout modes (default_after_start, offset_days, policy_staged) without
 * branching.
 *
 * Safety:
 *   - Redis SET-NX lock prevents two API instances from running the batch
 *     simultaneously. TTL of 600s safely exceeds any plausible run time.
 *   - One tranche failure does NOT abort the batch — failed rows surface in
 *     logs and the next cron tick retries.
 *   - `releasePendingTranche` is idempotent (status guard + Stripe
 *     idempotency key keyed on tranche id), so a re-pickup on the next tick
 *     after a partial commit is safe.
 *   - Cadence: every 15 minutes. The schedule generator clamps tranche
 *     releaseAt forward when it lands before balanceDueAt + 24h, so the
 *     "tranche fires before balance has captured" race is contained even
 *     if the off-session balance cron runs late.
 */
@Injectable()
export class PayoutReleaseCron {
  private readonly logger = new Logger(PayoutReleaseCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly payoutsService: PayoutsService
  ) {}

  @Cron('*/15 * * * *')
  async run(): Promise<void> {
    const redis = this.redis.getClient()
    const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    if (!acquired) {
      this.logger.debug('payout-release cron already running on another instance, skipping')
      return
    }
    try {
      await this.runBatch()
    } finally {
      await redis.del(LOCK_KEY)
    }
  }

  /**
   * Visible for testing — exposed without the Redis lock so specs can drive
   * batch logic directly. Returns counts so tests can assert.
   */
  async runBatch(): Promise<{ processed: number; released: number; skipped: number }> {
    const due = await this.prisma.bookingPayoutSchedule.findMany({
      where: {
        status: PayoutTrancheStatus.pending,
        releaseAt: { lte: new Date() },
      },
      orderBy: { releaseAt: 'asc' },
      take: BATCH_SIZE,
      select: { id: true },
    })

    let released = 0
    let skipped = 0
    for (const t of due) {
      try {
        const result = await this.payoutsService.releasePendingTranche(t.id)
        if (result.skipped) skipped++
        else released++
      } catch (err) {
        this.logger.error(
          `payout-release: tranche ${t.id} failed: ${(err as Error).message}`,
          (err as Error).stack
        )
        // Don't break the batch — the cron's next tick retries.
        continue
      }
    }

    if (due.length > 0) {
      this.logger.log(
        `payout-release: processed=${due.length} released=${released} skipped=${skipped}`
      )
    } else {
      this.logger.debug('payout-release: no due tranches')
    }

    return { processed: due.length, released, skipped }
  }
}
