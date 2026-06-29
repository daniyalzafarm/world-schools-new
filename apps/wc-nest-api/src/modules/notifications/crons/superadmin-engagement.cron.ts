import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { notify } from '../dispatcher/notify'
import { RedisService } from '../../redis/redis.service'
import { ProfileCompletionService } from '../../common/profile-completion/profile-completion.service'

const BATCH_SIZE = 500
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Superadmin engagement crons.
 *
 * Mirrors the `ProviderEngagementCron` structure: one injectable, one
 * `@Cron` method per cadence, dispatch helpers per catalog entry. Redis
 * lock per cadence keys off `cron:lock:superadmin-engagement:<suffix>`.
 *
 * Crons covered here:
 *  - verification-docs-not-uploaded (daily — approved 5+ days ago with no
 *    verification documents)
 *  - profile-incomplete-14d (daily — approved 14+ days ago, profile < 50%)
 *  - profile-needs-attention-60d (daily — no published session ended within
 *    the last 60 days but provider still approved)
 *  - profile-deactivated (daily — same condition extended to 90 days; pure
 *    notification, the actual deactivation is a separate domain concern)
 *  - payout-recovery-needed (daily — pending reimbursements past dueDate)
 *  - unresponsive-expired-requests (weekly — 3+ expired booking-requests in
 *    the past 7 days for the same provider)
 */
@Injectable()
export class SuperadminEngagementCron {
  private readonly logger = new Logger(SuperadminEngagementCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  // ---------- Daily ----------

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async runDaily(): Promise<void> {
    if (!(await this.lock('daily'))) return
    try {
      const noDocs = await this.dispatchVerificationDocsNotUploaded()
      const incomplete14 = await this.dispatchCampProfileIncomplete14d()
      const attn60 = await this.dispatchProfileNeedsAttention60d()
      const deact = await this.dispatchProfileDeactivated()
      const payoutRec = await this.dispatchPayoutRecoveryNeeded()
      if (noDocs || incomplete14 || attn60 || deact || payoutRec) {
        this.logger.log(
          `superadmin-engagement daily: noDocs=${noDocs} incomplete14=${incomplete14} attn60=${attn60} deact=${deact} payoutRec=${payoutRec}`
        )
      }
    } catch (err) {
      this.logger.error(
        `superadmin-engagement daily failed: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      await this.unlock('daily')
    }
  }

  // ---------- Weekly ----------

  @Cron(CronExpression.EVERY_WEEK)
  async runWeekly(): Promise<void> {
    if (!(await this.lock('weekly'))) return
    try {
      const unresponsive = await this.dispatchUnresponsiveExpiredRequests()
      if (unresponsive) {
        this.logger.log(`superadmin-engagement weekly: unresponsive=${unresponsive}`)
      }
    } catch (err) {
      this.logger.error(
        `superadmin-engagement weekly failed: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      await this.unlock('weekly')
    }
  }

  // ---------- Dispatch helpers ----------

  private async dispatchVerificationDocsNotUploaded(): Promise<number> {
    // Approved 5+ days ago, no verification documents on file.
    const fiveDaysAgo = new Date(Date.now() - 5 * DAY_MS)
    const providers = await this.prisma.provider.findMany({
      where: {
        approvalStatus: 'approved',
        applicationReviewedAt: { lt: fiveDaysAgo },
        verificationDocuments: { none: {} },
      },
      select: { id: true, applicationReviewedAt: true },
      take: BATCH_SIZE,
    })
    for (const p of providers) {
      const days = p.applicationReviewedAt
        ? Math.floor((Date.now() - p.applicationReviewedAt.getTime()) / DAY_MS)
        : 5
      notify(this.eventEmitter, NotificationType.SuperadminVerificationDocsNotUploaded, {
        providerId: p.id,
        extra: { daysSinceApproval: days },
      })
    }
    return providers.length
  }

  private async dispatchCampProfileIncomplete14d(): Promise<number> {
    // Approved 14+ days ago, profile completion still below threshold.
    const fourteenDaysAgo = new Date(Date.now() - 14 * DAY_MS)
    const providers = await this.prisma.provider.findMany({
      where: {
        approvalStatus: 'approved',
        applicationReviewedAt: { lt: fourteenDaysAgo },
        profileCompletion: { lt: ProfileCompletionService.INCOMPLETE_THRESHOLD },
      },
      select: { id: true, applicationReviewedAt: true },
      take: BATCH_SIZE,
    })
    for (const p of providers) {
      const days = p.applicationReviewedAt
        ? Math.floor((Date.now() - p.applicationReviewedAt.getTime()) / DAY_MS)
        : 14
      notify(this.eventEmitter, NotificationType.SuperadminCampProfileIncomplete14d, {
        providerId: p.id,
        extra: { daysSinceApproval: days },
      })
    }
    return providers.length
  }

  private async dispatchProfileNeedsAttention60d(): Promise<number> {
    return this.dispatchSeasonalAttention(
      60,
      90,
      NotificationType.SuperadminCampProfileNeedsAttention60d
    )
  }

  private async dispatchProfileDeactivated(): Promise<number> {
    return this.dispatchSeasonalAttention(
      90,
      // No upper bound — once past 90d the provider is effectively
      // "deactivated" from a notifications POV until they post new
      // sessions; deliver one row, the unique-index dedupes daily re-runs.
      Number.MAX_SAFE_INTEGER,
      NotificationType.SuperadminCampProfileDeactivated
    )
  }

  private async dispatchSeasonalAttention(
    minDaysSince: number,
    maxDaysSince: number,
    type: NotificationType
  ): Promise<number> {
    // Cohort: providers whose newest published session.endDate is between
    // [now - maxDaysSince, now - minDaysSince]. We don't have a denormalized
    // "lastSessionEndAt" — derive via `Camp.sessions` max(endDate).
    const now = Date.now()
    const olderThan = new Date(now - minDaysSince * DAY_MS)
    const newerThan =
      maxDaysSince === Number.MAX_SAFE_INTEGER ? new Date(0) : new Date(now - maxDaysSince * DAY_MS)
    const providers = await this.prisma.provider.findMany({
      where: {
        approvalStatus: 'approved',
        camps: {
          some: {
            sessions: {
              some: { endDate: { gte: newerThan, lt: olderThan } },
            },
          },
        },
      },
      select: { id: true },
      take: BATCH_SIZE,
    })
    for (const p of providers) {
      notify(this.eventEmitter, type, {
        providerId: p.id,
        extra: { daysSinceLastSession: minDaysSince },
      })
    }
    return providers.length
  }

  private async dispatchPayoutRecoveryNeeded(): Promise<number> {
    // Pending reimbursements past their dueDate. Implies the clawback could
    // not be deducted from any upcoming payout (otherwise reimbursement
    // status would have transitioned).
    const now = new Date()
    const items = await this.prisma.reimbursement.findMany({
      where: {
        status: 'pending',
        dueDate: { lt: now },
      },
      select: { id: true, bookingGroupId: true, refundId: true },
      take: BATCH_SIZE,
    })
    for (const r of items) {
      notify(this.eventEmitter, NotificationType.SuperadminPayoutRecoveryNeeded, {
        bookingGroupId: r.bookingGroupId,
        refundId: r.refundId,
      })
    }
    return items.length
  }

  private async dispatchUnresponsiveExpiredRequests(): Promise<number> {
    // Cohort: providers with 3+ booking-groups in `expired` status whose
    // expiresAt fell within the past 7 days. Prisma's `groupBy({ having })`
    // returns strict-typed rows that fight us here — a lightweight findMany
    // + in-memory tally keeps the helper readable without paging concerns
    // (BATCH_SIZE caps the row count).
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)
    const expiredGroups = await this.prisma.bookingGroup.findMany({
      where: {
        status: 'expired',
        expiresAt: { gte: sevenDaysAgo, lt: now },
      },
      select: { providerId: true },
      take: BATCH_SIZE,
    })
    const counts = new Map<string, number>()
    for (const g of expiredGroups) {
      counts.set(g.providerId, (counts.get(g.providerId) ?? 0) + 1)
    }
    let dispatched = 0
    for (const [providerId, count] of counts) {
      if (count < 3) continue
      notify(this.eventEmitter, NotificationType.SuperadminCampUnresponsiveExpiredRequests, {
        providerId,
        extra: { expiredRequestCount: count },
      })
      dispatched++
    }
    return dispatched
  }

  // ---------- Lock helpers ----------

  private async lock(suffix: string): Promise<boolean> {
    if (!this.redis.isReady()) return false
    const client = this.redis.getClient()
    const acquired = await client.set(
      `cron:lock:superadmin-engagement:${suffix}`,
      '1',
      'EX',
      600,
      'NX'
    )
    return acquired === 'OK'
  }

  private async unlock(suffix: string): Promise<void> {
    if (!this.redis.isReady()) return
    await this.redis.del(`cron:lock:superadmin-engagement:${suffix}`)
  }
}
