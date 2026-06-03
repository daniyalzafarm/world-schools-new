import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { notify } from '../../notifications/dispatcher/notify'
import { RedisService } from '../../redis/redis.service'

const LOCK_KEY = 'cron:lock:post-camp-review'
const LOCK_TTL_SECONDS = 600
const BATCH_SIZE = 500

interface Tier {
  type: NotificationType
  daysAfterEnd: number
}

const TIERS: Tier[] = [
  { type: NotificationType.ParentPostCampReviewRequest, daysAfterEnd: 1 },
  { type: NotificationType.ParentPostCampReviewReminder, daysAfterEnd: 7 },
  { type: NotificationType.ParentPostCampSurvey, daysAfterEnd: 14 },
]

/**
 * Phase 7.5 — daily post-camp review cron.
 *
 * For each tier, find BookingGroups whose `session.endDate` was exactly
 * `daysAfterEnd` ± 1d ago. Tiers run independently so a single cron pass
 * fires the right cadence for each cohort.
 *
 * Skipped when:
 *  - the parent has already submitted a published review for the camp
 *    (no point asking again);
 *  - the booking transitioned to `cancelled` / `disputed` / `payment_failed`
 *    (a sour ending — pulling for a review would be tone-deaf).
 *
 * Idempotency: BullMQ deterministic `jobId` + `NotificationDelivery` unique
 * index collapse re-runs of the same calendar day; the per-tier date window
 * keeps a booking from receiving the same tier twice across separate days.
 */
@Injectable()
export class PostCampReviewCron {
  private readonly logger = new Logger(PostCampReviewCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async run(): Promise<void> {
    if (!(await this.acquireLock())) return
    try {
      let total = 0
      for (const tier of TIERS) {
        total += await this.dispatchTier(tier)
      }
      if (total > 0) {
        this.logger.log(`post-camp-review: enqueued ${total} parent reviews`)
      }
    } catch (err) {
      this.logger.error(
        `post-camp-review failed: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      await this.releaseLock()
    }
  }

  private async dispatchTier(tier: Tier): Promise<number> {
    const now = Date.now()
    const windowEnd = new Date(now - tier.daysAfterEnd * 86_400_000)
    const windowStart = new Date(windowEnd.getTime() - 86_400_000)
    const candidates = await this.prisma.bookingGroup.findMany({
      where: {
        status: { in: ['fully_paid', 'at_camp', 'completed'] },
        session: { endDate: { gte: windowStart, lt: windowEnd } },
      },
      select: { id: true, parentId: true, campId: true },
      take: BATCH_SIZE,
    })

    let dispatched = 0
    for (const c of candidates) {
      // Skip bookings whose parent has already left a published review
      // for this camp (the request + reminder tiers are about THIS camp;
      // the survey tier is about overall experience so we always send).
      if (tier.type !== NotificationType.ParentPostCampSurvey) {
        const existing = await this.prisma.campReview.findFirst({
          where: { parentId: c.parentId, campId: c.campId, status: 'published' },
          select: { id: true },
        })
        if (existing) continue
      }
      notify(this.eventEmitter, tier.type, { bookingGroupId: c.id })
      dispatched++
    }
    return dispatched
  }

  private async acquireLock(): Promise<boolean> {
    if (!this.redis.isReady()) return false
    const client = this.redis.getClient()
    const acquired = await client.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    return acquired === 'OK'
  }

  private async releaseLock(): Promise<void> {
    if (!this.redis.isReady()) return
    await this.redis.del(LOCK_KEY)
  }
}
