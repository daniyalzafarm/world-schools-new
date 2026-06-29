import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../../prisma/prisma.service'
import { notify } from '../../../notifications/dispatcher/notify'
import { RedisService } from '../../../redis/redis.service'

const LOCK_KEY = 'cron:lock:wishlist-engagement'
const LOCK_TTL_SECONDS = 600
const BATCH_SIZE = 500

/**
 * Weekly wishlist-engagement nudge.
 *
 * Drives three catalog entries:
 *  - `ParentWishlistEmpty` — parents who have a Parent row but no wishlist
 *    items at all (and signed up >= 7 days ago, so we don't pester a
 *    brand-new account before they've had a chance to browse).
 *  - `ParentWishlistItemsNoBooking7d` — wishlist >= 7 days old, has items,
 *    parent has zero BookingGroups outside `draft` status.
 *  - `ParentWishlistItemsNoBooking21d` — same as above but >= 21 days old.
 *
 * Idempotency: the `NotificationDelivery (template_key, channel, dedupe_key)`
 * unique index dedupes within the catalog's default key
 * (`<recipientUserId>:<entity>` — `entity` resolves to the parentUserId
 * here since no per-event entity exists). A weekly cadence collapses to a
 * single delivery row per (parent × tier) per week.
 *
 * Recommend pairing with a per-user weekly cooldown timestamp on Parent
 * once promotional volume warrants it. Out of scope for now.
 */
@Injectable()
export class WishlistEngagementCron {
  private readonly logger = new Logger(WishlistEngagementCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async run(): Promise<void> {
    if (!(await this.acquireLock())) return
    try {
      const emptyCount = await this.dispatchEmptyWishlists()
      const stale7 = await this.dispatchItemsNoBooking(
        7,
        NotificationType.ParentWishlistItemsNoBooking7d
      )
      const stale21 = await this.dispatchItemsNoBooking(
        21,
        NotificationType.ParentWishlistItemsNoBooking21d
      )
      if (emptyCount || stale7 || stale21) {
        this.logger.log(
          `wishlist-engagement: empty=${emptyCount} stale7=${stale7} stale21=${stale21}`
        )
      }
    } catch (err) {
      this.logger.error(
        `wishlist-engagement failed: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      await this.releaseLock()
    }
  }

  private async dispatchEmptyWishlists(): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    const candidates = await this.prisma.parent.findMany({
      where: {
        wishlists: { none: { items: { some: {} } } },
        user: { createdAt: { lt: sevenDaysAgo } },
      },
      select: { userId: true },
      take: BATCH_SIZE,
    })
    for (const c of candidates) {
      notify(this.eventEmitter, NotificationType.ParentWishlistEmpty, {
        parentUserId: c.userId,
      })
    }
    return candidates.length
  }

  private async dispatchItemsNoBooking(daysAgo: 7 | 21, type: NotificationType): Promise<number> {
    // Cohort: parents whose oldest non-empty wishlist was created exactly
    // `daysAgo` ± 1d (a 24h window so a weekly cron hits each cohort once),
    // AND who have no BookingGroup outside `draft`. Drafts are abandonments,
    // not active bookings — counting them would silence the cohort that
    // most needs the nudge.
    const windowStart = new Date(Date.now() - (daysAgo + 1) * 86_400_000)
    const windowEnd = new Date(Date.now() - daysAgo * 86_400_000)
    const candidates = await this.prisma.parent.findMany({
      where: {
        wishlists: {
          some: {
            createdAt: { gte: windowStart, lt: windowEnd },
            items: { some: {} },
          },
        },
        bookingGroups: { none: { status: { not: 'draft' } } },
      },
      select: { userId: true },
      take: BATCH_SIZE,
    })
    for (const c of candidates) {
      notify(this.eventEmitter, type, {
        parentUserId: c.userId,
      })
    }
    return candidates.length
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
