import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../../prisma/prisma.service'
import { notify } from '../../../notifications/dispatcher/notify'
import { RedisService } from '../../../redis/redis.service'
import { ProfileCompletionService } from '../profile-completion.service'

const LOCK_KEY = 'cron:lock:profile-incomplete'
const LOCK_TTL_SECONDS = 600
const BATCH_SIZE = 500

/**
 * Phase 7.5 — weekly nudge for parents whose profile is incomplete.
 *
 * Threshold lives on `ProfileCompletionService.INCOMPLETE_THRESHOLD` (50).
 * Only parents whose `User.createdAt` is >= 7 days ago are eligible, so
 * brand-new accounts aren't pestered before they've had time to fill
 * anything in. The `NotificationDelivery` unique index dedupes within a
 * week (default key = `<userId>:<entity>`; without a per-event entity
 * the worker falls back to `parent`, which lands one row per parent per
 * weekly run).
 *
 * Provider-side equivalent comes with Phase 8.
 */
@Injectable()
export class ProfileIncompleteCron {
  private readonly logger = new Logger(ProfileIncompleteCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async run(): Promise<void> {
    if (!(await this.acquireLock())) return
    try {
      const cutoff = new Date(Date.now() - 7 * 86_400_000)
      const candidates = await this.prisma.parent.findMany({
        where: {
          profileCompletion: { lt: ProfileCompletionService.INCOMPLETE_THRESHOLD },
          user: { createdAt: { lt: cutoff } },
        },
        select: { userId: true },
        take: BATCH_SIZE,
      })
      for (const c of candidates) {
        notify(this.eventEmitter, NotificationType.ParentProfileIncomplete, {
          parentUserId: c.userId,
        })
      }
      if (candidates.length > 0) {
        this.logger.log(`profile-incomplete: nudged ${candidates.length} parents`)
      }
    } catch (err) {
      this.logger.error(
        `profile-incomplete failed: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      await this.releaseLock()
    }
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
