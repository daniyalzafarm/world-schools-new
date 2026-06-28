import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationType } from '@world-schools/wc-types'
import { BookingGroupStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { notify } from '../../notifications/dispatcher/notify'
import { RedisService } from '../../redis/redis.service'

const LOCK_KEY = 'cron:lock:abandon-detection'
const LOCK_TTL_SECONDS = 300 // 5 min — comfortably longer than a worst-case batch
const BATCH_SIZE = 200

/**
 * Spec drivers (Parent sheet):
 *  - #38 Abandoned Checkout — 3h Nudge  (in-app only)
 *  - #39 Abandoned Checkout — 2 Day Reminder  (in-app + email)
 *  - #40 Abandoned Checkout — 4 Day Reminder  (in-app + email)
 *  - #41 Abandoned Checkout — Final Reminder  (in-app + email)
 *
 * A draft is "abandoned" once `BookingGroup.checkoutStarted === true` (parent
 * has filled at least one participant or payment field — pure cart-bounces
 * are excluded per the spec qualification) AND `lastActivityAt < now - 3h`
 * AND `abandonedNotifiedAt` is unset.
 *
 * This file runs hourly, identifies candidates,
 * and LOGS them — no DB write, no notification. Lets ops observe volume
 * before the catalog entries land.
 *
 * Wiring (TODO):
 *  1. Add `NotificationType.ParentCheckoutAbandoned3h/2d/4d/6d` enum values
 *     + catalog entries + React Email templates.
 *  2. Replace the diagnostic log below with:
 *     ```
 *     notify(events, NotificationType.ParentCheckoutAbandoned3h, { bookingGroupId })
 *     // Fan out the 2d/4d/6d follow-ups as delayed jobs:
 *     notify(events, NotificationType.ParentCheckoutAbandoned2d, { bookingGroupId },
 *            new Date(Date.now() + 2*24*3600_000))
 *     // ... 4d, 6d ...
 *     ```
 *  3. Stamp `abandonedNotifiedAt: new Date()` so this cron is idempotent.
 *  4. The `NotificationsCancelService` helper `cancelForCheckout(id)`
 *     removes the delayed jobs when the parent submits / completes / abandons
 *     for real.
 */
@Injectable()
export class AbandonDetectionCron {
  private readonly logger = new Logger(AbandonDetectionCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async detect(): Promise<void> {
    // Single-leader lock — multiple replicas should not double-detect.
    if (!(await this.acquireLock())) {
      this.logger.debug('abandon-detection: another instance holds the lock — skipping')
      return
    }

    try {
      const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000)

      const candidates = await this.prisma.bookingGroup.findMany({
        where: {
          status: BookingGroupStatus.draft,
          checkoutStarted: true,
          abandonedNotifiedAt: null,
          lastActivityAt: { lt: cutoff },
        },
        select: {
          id: true,
          bookingGroupNumber: true,
          parentId: true,
          lastActivityAt: true,
        },
        take: BATCH_SIZE,
      })

      if (candidates.length === 0) {
        this.logger.debug('abandon-detection: no candidates this tick')
        return
      }

      // Fire the 3h nudge live, fan out
      // 2d / 4d / 6d follow-ups as scheduled (delayed) jobs, and stamp
      // `abandonedNotifiedAt` so the next cron tick doesn't re-emit. Cancel
      // helpers in `NotificationsCancelService` remove the delayed jobs
      // when the parent submits / completes / abandons for real.
      const now = new Date()
      const stampIds = candidates.map(c => c.id)
      await this.prisma.bookingGroup.updateMany({
        where: { id: { in: stampIds }, abandonedNotifiedAt: null },
        data: { abandonedNotifiedAt: now },
      })
      const DAY_MS = 24 * 60 * 60 * 1000
      for (const c of candidates) {
        notify(this.eventEmitter, NotificationType.ParentCheckoutAbandoned3h, {
          bookingGroupId: c.id,
        })
        notify(
          this.eventEmitter,
          NotificationType.ParentCheckoutAbandoned2d,
          { bookingGroupId: c.id },
          new Date(now.getTime() + 2 * DAY_MS)
        )
        notify(
          this.eventEmitter,
          NotificationType.ParentCheckoutAbandoned4d,
          { bookingGroupId: c.id },
          new Date(now.getTime() + 4 * DAY_MS)
        )
        notify(
          this.eventEmitter,
          NotificationType.ParentCheckoutAbandoned6d,
          { bookingGroupId: c.id },
          new Date(now.getTime() + 6 * DAY_MS)
        )
      }
      this.logger.log(
        `abandon-detection: enqueued 3h+2d+4d+6d notifications for ${candidates.length} drafts ` +
          `(IDs: ${candidates.map(c => c.bookingGroupNumber).join(', ')})`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`abandon-detection failed: ${msg}`)
    } finally {
      await this.releaseLock()
    }
  }

  private async acquireLock(): Promise<boolean> {
    if (!this.redis.isReady()) {
      // Without Redis we'd race across replicas. Skip rather than risk
      // double-notifying parents.
      return false
    }
    const client = this.redis.getClient()
    const acquired = await client.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    return acquired === 'OK'
  }

  private async releaseLock(): Promise<void> {
    if (!this.redis.isReady()) return
    await this.redis.del(LOCK_KEY)
  }
}
