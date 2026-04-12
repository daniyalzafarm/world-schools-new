import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'

const LOCK_TTL_SECONDS = 240 // 4 minutes — less than the 5-minute cron interval

@Injectable()
export class SlaBreachMonitorService {
  private readonly logger = new Logger(SlaBreachMonitorService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  /**
   * Every 5 minutes: mark tickets whose SLA deadlines have passed.
   * Uses a Redis distributed lock so only one container runs per cycle.
   * The updateMany WHERE clause is naturally idempotent — rows already
   * stamped are excluded by the `null` filter, so double-runs are harmless.
   */
  @Cron('*/5 * * * *')
  async checkSlaBreaches(): Promise<void> {
    const lockKey = 'cron:lock:sla-breach-monitor'
    const redis = this.redis.getClient()

    const acquired = await redis.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX')
    if (!acquired) {
      this.logger.debug('SLA breach monitor already running on another instance, skipping')
      return
    }

    try {
      await this.runBreachCheck()
    } finally {
      await redis.del(lockKey)
    }
  }

  private async runBreachCheck(): Promise<void> {
    const now = new Date()

    // First-response SLA breach: ticket is open/in-progress, deadline has passed,
    // and no one has responded yet, and the breach hasn't been stamped yet.
    const { count: firstResponseBreached } = await this.prisma.supportTicket.updateMany({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        firstResponseDueAt: { lte: now },
        firstRespondedAt: null,
        slaFirstResponseBreachedAt: null,
      },
      data: { slaFirstResponseBreachedAt: now },
    })

    // Resolution SLA breach: ticket is not yet resolved/closed, deadline has passed,
    // and the breach hasn't been stamped yet.
    const { count: resolutionBreached } = await this.prisma.supportTicket.updateMany({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING_REQUESTER'] },
        resolutionDueAt: { lte: now },
        resolvedAt: null,
        slaResolutionBreachedAt: null,
      },
      data: { slaResolutionBreachedAt: now },
    })

    if (firstResponseBreached > 0 || resolutionBreached > 0) {
      this.logger.warn(
        `SLA breaches stamped — first-response: ${firstResponseBreached}, resolution: ${resolutionBreached}`
      )
    } else {
      this.logger.debug('SLA breach check complete — no new breaches')
    }
  }
}
