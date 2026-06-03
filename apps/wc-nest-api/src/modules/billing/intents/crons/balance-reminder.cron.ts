import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationType } from '@world-schools/wc-types'
import { PaymentKind, PaymentStatus } from '../../../../generated/client/enums'
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
 * Daily cron that nudges parents 14d / 7d / 3d before their balance
 * payment is auto-charged. v28 spec (Parent #10).
 *
 * Idempotency: each candidate Payment is matched to exactly one tier per
 * day via a date-window query (`dueAt BETWEEN now+Xd AND now+Xd+1d`). The
 * downstream `NotificationDelivery(template_key, channel, dedupe_key)`
 * unique index is the second line of defence — a duplicate run on the
 * same calendar day collapses there.
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
    const candidates = await this.prisma.payment.findMany({
      where: {
        kind: PaymentKind.balance,
        status: PaymentStatus.processing,
        dueAt: { gte: windowStart, lt: windowEnd },
      },
      select: { id: true, bookingGroupId: true },
      take: BATCH_SIZE,
    })
    for (const p of candidates) {
      notify(this.eventEmitter, tier.type, {
        paymentId: p.id,
        bookingGroupId: p.bookingGroupId,
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
