import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationType } from '@world-schools/wc-types'
import { ScheduledCaptureStatus } from '../../../../generated/client/enums'
import { PrismaService } from '../../../../prisma/prisma.service'
import { notify } from '../../../notifications/dispatcher/notify'
import { RedisService } from '../../../redis/redis.service'

const LOCK_KEY = 'cron:lock:balance-reminder'
const LOCK_TTL_SECONDS = 300
const BATCH_SIZE = 500

interface Tier {
  type: NotificationType
  days: number
}

const TIERS: Tier[] = [
  { type: NotificationType.ParentPaymentBalanceReminder14d, days: 14 },
  { type: NotificationType.ParentPaymentBalanceReminder7d, days: 7 },
  { type: NotificationType.ParentPaymentBalanceReminder3d, days: 3 },
]

/**
 * Daily cron that nudges parents 14d / 7d / 3d before a scheduled balance
 * capture fires. v28 spec (Parent #10).
 *
 * Payments revamp (Spec v2.3): the source of truth for capture timing is
 * `booking_scheduled_captures` (effectiveCaptureDate), NOT a `Payment.dueAt` —
 * the per-capture balance Payment row is only minted when the engine fires the
 * capture, so a forward-looking reminder must read the scheduled-capture rows.
 * Deposit captures (sequence 0) are excluded; only balance captures are nudged.
 *
 * Idempotency: each scheduled capture is matched to exactly one tier per day
 * via a date-window query (`effectiveCaptureDate BETWEEN now+Xd AND now+Xd+1d`).
 * The downstream `NotificationDelivery(template_key, channel, dedupe_key)`
 * unique index is the second line of defence — a duplicate run on the same
 * calendar day collapses there.
 */
@Injectable()
export class BalanceReminderCron {
  private readonly logger = new Logger(BalanceReminderCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async run(): Promise<void> {
    if (!(await this.acquireLock())) return
    try {
      let totalEnqueued = 0
      for (const tier of TIERS) {
        totalEnqueued += await this.processTier(tier)
      }
      if (totalEnqueued > 0) {
        this.logger.log(`balance-reminder: enqueued ${totalEnqueued} parent reminders`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`balance-reminder failed: ${msg}`)
    } finally {
      await this.releaseLock()
    }
  }

  private async processTier(tier: Tier): Promise<number> {
    const now = new Date()
    const windowStart = new Date(now.getTime() + tier.days * 86_400_000)
    const windowEnd = new Date(windowStart.getTime() + 86_400_000)
    const candidates = await this.prisma.bookingScheduledCapture.findMany({
      where: {
        status: ScheduledCaptureStatus.scheduled,
        sequence: { gt: 0 }, // balance captures only — deposit (seq 0) isn't reminded
        effectiveCaptureDate: { gte: windowStart, lt: windowEnd },
      },
      select: { bookingGroupId: true, amount: true, currency: true, effectiveCaptureDate: true },
      take: BATCH_SIZE,
    })
    for (const c of candidates) {
      notify(this.eventEmitter, tier.type, {
        bookingGroupId: c.bookingGroupId,
        // Carry the specific capture's amount + date so the reminder shows the
        // upcoming charge rather than the whole remaining balance.
        extra: {
          captureAmount: c.amount.toString(),
          captureCurrency: c.currency,
          captureDate: c.effectiveCaptureDate.toISOString(),
        },
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
