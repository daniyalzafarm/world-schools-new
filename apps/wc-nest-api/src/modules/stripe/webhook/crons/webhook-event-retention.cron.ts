import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ConfigService } from '../../../../config/config.service'
import { PrismaService } from '../../../../prisma/prisma.service'
import { RedisService } from '../../../redis/redis.service'

const LOCK_KEY = 'cron:lock:webhook-event-retention'
const LOCK_TTL_SECONDS = 600
const DELETE_BATCH_SIZE = 1000

/**
 * H1 audit fix — bounded retention for the `stripe_webhook_events` table.
 *
 * Every Stripe webhook delivery inserts a row keyed by `event.id` (used to
 * dedup retries). At production throughput the table accumulates indefinitely;
 * over years it grows to millions of rows and the `upsert` path slows even
 * though it's PK-indexed (especially under autovacuum pressure).
 *
 * This cron fires daily at 03:30 UTC (just after `auth-expiry-monitor` so the
 * two don't contend for the same idle window) and deletes rows older than
 * `STRIPE_WEBHOOK_EVENT_RETENTION_DAYS` (default 90). The horizon comfortably
 * covers Stripe's longest retry window (~72h) and leaves operators a generous
 * tail for post-mortem queries.
 *
 * Safety:
 *   - Deletes in batches so a backlog doesn't lock the table for minutes.
 *   - Lock-protected so two instances don't race the same window.
 *   - Idempotent — the WHERE clause only matches rows past the cutoff.
 */
@Injectable()
export class WebhookEventRetentionCron {
  private readonly logger = new Logger(WebhookEventRetentionCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService
  ) {}

  // 03:30 UTC every day — runs after auth-expiry-monitor (03:00) in the same
  // ops-quiet window.
  @Cron('30 3 * * *')
  async run(): Promise<void> {
    const redis = this.redis.getClient()
    const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    if (!acquired) {
      this.logger.debug(
        'webhook-event-retention cron already running on another instance, skipping'
      )
      return
    }
    try {
      const result = await this.runBatch()
      // M4 audit fix: emit a deletion summary at info level on every run so
      // alerting + dashboards can detect a stuck cron (gap in expected
      // emissions) without having to poll the table directly.
      this.logger.log(
        `webhook-event-retention completed: deleted=${result.deleted} retentionDays=${this.configService.stripeConfig.webhookEventRetentionDays}`
      )
    } catch (err) {
      // M4 audit fix: a failed retention cron will silently let the
      // stripe_webhook_events table grow unbounded. ERROR-level log so the
      // existing alert hook fires and an operator can intervene.
      this.logger.error(
        `webhook-event-retention cron FAILED: ${(err as Error).message ?? err}`,
        (err as Error).stack
      )
      // Re-throw so @nestjs/schedule's own error path can record the failure
      // for observability tooling that hooks into it.
      throw err
    } finally {
      await redis.del(LOCK_KEY)
    }
  }

  /**
   * Exposed without the lock so specs can drive the deletion loop directly.
   * Returns the total number of rows deleted across all batches.
   */
  async runBatch(): Promise<{ deleted: number }> {
    const retentionDays = this.configService.stripeConfig.webhookEventRetentionDays
    if (retentionDays === 0) {
      // 0 = retention disabled; useful for environments that want to retain
      // every event for forensic audit (e.g. early production).
      this.logger.debug('webhook-event-retention: retention disabled (days=0)')
      return { deleted: 0 }
    }
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    let total = 0
    // Batched delete: cap each pass at DELETE_BATCH_SIZE so a years-long
    // backlog doesn't lock the table for minutes on first run. The inner
    // subquery is the standard idiom for "delete the oldest N matching rows"
    // under Prisma since `deleteMany` doesn't support LIMIT directly.
    while (true) {
      const oldIds = await this.prisma.stripeWebhookEvent.findMany({
        where: { receivedAt: { lt: cutoff } },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
      })
      if (oldIds.length === 0) break
      const result = await this.prisma.stripeWebhookEvent.deleteMany({
        where: { id: { in: oldIds.map(r => r.id) } },
      })
      total += result.count
      if (oldIds.length < DELETE_BATCH_SIZE) break
    }

    if (total > 0) {
      this.logger.log(
        `webhook-event-retention: deleted ${total} rows older than ${retentionDays} days`
      )
    } else {
      this.logger.debug('webhook-event-retention: nothing to delete')
    }
    return { deleted: total }
  }
}
