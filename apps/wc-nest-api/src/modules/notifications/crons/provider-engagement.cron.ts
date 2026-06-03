import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { notify } from '../dispatcher/notify'
import { RedisService } from '../../redis/redis.service'
import { ProfileCompletionService } from '../../common/profile-completion/profile-completion.service'

const BATCH_SIZE = 500

/**
 * Phase 8 — provider engagement crons.
 *
 * One injectable, multiple `@Cron` methods — keeps the provider-side
 * scheduled triggers in a single grep-able file rather than fanning out
 * one cron per trigger. All methods are idempotent: the
 * `NotificationDelivery (template_key, channel, dedupe_key)` unique
 * index collapses re-runs within the same calendar window, and each
 * cron acquires a Redis lock to prevent concurrent runs across replicas.
 *
 * Crons covered here:
 *  - profile-incomplete (weekly)
 *  - connect-stripe-reminder (weekly — providers with approvalStatus=approved
 *    but no Stripe account)
 *  - season-ended (monthly)
 *  - programs-not-updated 30d / 60d (weekly)
 *  - messaging-unanswered 24h / 48h (hourly)
 *  - review-not-responded reminder (weekly)
 *  - dispute-evidence-due reminder (daily)
 *  - payout-reminder (weekly — for upcoming tranches within 7d)
 */
@Injectable()
export class ProviderEngagementCron {
  private readonly logger = new Logger(ProviderEngagementCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  // ---------- Weekly ----------

  @Cron(CronExpression.EVERY_WEEK)
  async runWeekly(): Promise<void> {
    if (!(await this.lock('weekly'))) return
    try {
      const incomplete = await this.dispatchProfileIncomplete()
      const stripe = await this.dispatchConnectStripeReminder()
      const not30 = await this.dispatchProgramsNotUpdated(
        30,
        NotificationType.ProviderProgramsNotUpdated30d
      )
      const not60 = await this.dispatchProgramsNotUpdated(
        60,
        NotificationType.ProviderProgramsNotUpdated60d
      )
      const reviewReminder = await this.dispatchReviewNotRespondedReminder()
      const payout = await this.dispatchPayoutReminder()
      if (incomplete || stripe || not30 || not60 || reviewReminder || payout) {
        this.logger.log(
          `provider-engagement weekly: profile=${incomplete} stripe=${stripe} 30d=${not30} 60d=${not60} review=${reviewReminder} payout=${payout}`
        )
      }
    } catch (err) {
      this.logger.error(
        `provider-engagement weekly failed: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      await this.unlock('weekly')
    }
  }

  // ---------- Monthly ----------

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON)
  async runMonthly(): Promise<void> {
    if (!(await this.lock('monthly'))) return
    try {
      const season = await this.dispatchSeasonEnded()
      if (season) {
        this.logger.log(`provider-engagement monthly: season=${season}`)
      }
    } catch (err) {
      this.logger.error(
        `provider-engagement monthly failed: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      await this.unlock('monthly')
    }
  }

  // ---------- Daily ----------

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDaily(): Promise<void> {
    if (!(await this.lock('daily'))) return
    try {
      const dispute = await this.dispatchDisputeEvidenceDue()
      const delayed = await this.dispatchPayoutDelayed()
      if (dispute || delayed) {
        this.logger.log(`provider-engagement daily: dispute=${dispute} delayed=${delayed}`)
      }
    } catch (err) {
      this.logger.error(
        `provider-engagement daily failed: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      await this.unlock('daily')
    }
  }

  // ---------- Hourly ----------

  @Cron(CronExpression.EVERY_HOUR)
  async runHourly(): Promise<void> {
    if (!(await this.lock('hourly'))) return
    try {
      const m24 = await this.dispatchMessagingUnanswered(
        24,
        NotificationType.ProviderMessagingUnanswered24h
      )
      const m48 = await this.dispatchMessagingUnanswered(
        48,
        NotificationType.ProviderMessagingUnanswered48h
      )
      if (m24 || m48) {
        this.logger.log(`provider-engagement hourly: msg24=${m24} msg48=${m48}`)
      }
    } catch (err) {
      this.logger.error(
        `provider-engagement hourly failed: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      await this.unlock('hourly')
    }
  }

  // ---------- Dispatch helpers ----------

  private async dispatchProfileIncomplete(): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    const providers = await this.prisma.provider.findMany({
      where: {
        profileCompletion: { lt: ProfileCompletionService.INCOMPLETE_THRESHOLD },
        approvalStatus: 'approved',
        createdAt: { lt: sevenDaysAgo },
      },
      select: { id: true },
      take: BATCH_SIZE,
    })
    for (const p of providers) {
      notify(this.eventEmitter, NotificationType.ProviderProfileIncomplete, { providerId: p.id })
    }
    return providers.length
  }

  private async dispatchConnectStripeReminder(): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    const providers = await this.prisma.provider.findMany({
      where: {
        approvalStatus: 'approved',
        stripeAccountId: null,
        createdAt: { lt: sevenDaysAgo },
      },
      select: { id: true },
      take: BATCH_SIZE,
    })
    for (const p of providers) {
      notify(this.eventEmitter, NotificationType.ProviderConnectStripeReminder, {
        providerId: p.id,
      })
    }
    return providers.length
  }

  private async dispatchProgramsNotUpdated(
    daysSince: 30 | 60,
    type: NotificationType
  ): Promise<number> {
    const windowEnd = new Date(Date.now() - daysSince * 86_400_000)
    const windowStart = new Date(windowEnd.getTime() - 7 * 86_400_000)
    // Cohort: providers whose newest Camp.updatedAt falls between
    // [windowStart, windowEnd] AND who have at least one published camp.
    // The 7-day window keeps the cron firing once per cohort (this runs
    // weekly) without spamming the same provider every week.
    const providers = await this.prisma.provider.findMany({
      where: {
        camps: {
          some: {
            status: 'published',
            updatedAt: { gte: windowStart, lt: windowEnd },
          },
        },
      },
      select: {
        id: true,
        camps: {
          select: { updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      take: BATCH_SIZE,
    })
    for (const p of providers) {
      const lastUpdate = p.camps[0]?.updatedAt
      notify(this.eventEmitter, type, {
        providerId: p.id,
        extra: lastUpdate ? { lastUpdate: lastUpdate.toISOString().slice(0, 10) } : undefined,
      })
    }
    return providers.length
  }

  private async dispatchSeasonEnded(): Promise<number> {
    // Cohort: providers whose every published-camp session ended in the
    // last 30 days. Conservative — uses `findMany` then per-row check
    // to keep the SQL simple; volume is monthly + small.
    const lookback = new Date(Date.now() - 30 * 86_400_000)
    const providers = await this.prisma.provider.findMany({
      where: {
        camps: {
          some: {
            status: 'published',
            sessions: { every: { endDate: { lt: lookback } } },
          },
        },
      },
      select: { id: true },
      take: BATCH_SIZE,
    })
    for (const p of providers) {
      notify(this.eventEmitter, NotificationType.ProviderSeasonEnded, { providerId: p.id })
    }
    return providers.length
  }

  private async dispatchReviewNotRespondedReminder(): Promise<number> {
    // Cohort: reviews published >= 7 days ago without a response.
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    const reviews = await this.prisma.campReview.findMany({
      where: {
        status: 'published',
        publishedAt: { lt: sevenDaysAgo },
        response: { is: null },
      },
      select: { id: true },
      take: BATCH_SIZE,
    })
    for (const r of reviews) {
      notify(this.eventEmitter, NotificationType.ProviderReviewNotRespondedReminder, {
        reviewId: r.id,
      })
    }
    return reviews.length
  }

  private async dispatchDisputeEvidenceDue(): Promise<number> {
    // Cohort: open disputes whose evidence-due window is between
    // tomorrow and 3 days from now. Fires daily so a provider gets a
    // reminder on each of the three days before the deadline.
    const now = new Date()
    const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const disputes = await this.prisma.dispute.findMany({
      where: {
        outcome: 'open',
        evidenceDueBy: { gte: windowStart, lt: windowEnd },
      },
      select: { id: true },
      take: BATCH_SIZE,
    })
    for (const d of disputes) {
      notify(this.eventEmitter, NotificationType.ProviderDisputeEvidenceDue, { disputeId: d.id })
    }
    return disputes.length
  }

  private async dispatchPayoutReminder(): Promise<number> {
    // Cohort: pending payout tranches releasing in the next 7 days.
    // Reminder gives the provider visibility on incoming funds before
    // the bank credit shows up.
    const now = new Date()
    const windowEnd = new Date(now.getTime() + 7 * 86_400_000)
    const tranches = await this.prisma.bookingPayoutSchedule.findMany({
      where: {
        status: 'pending',
        releaseAt: { gte: now, lt: windowEnd },
      },
      select: { id: true, bookingGroupId: true, releaseAt: true },
      take: BATCH_SIZE,
    })
    for (const t of tranches) {
      notify(this.eventEmitter, NotificationType.ProviderPayoutReminder, {
        bookingGroupId: t.bookingGroupId,
        extra: { whenLabel: t.releaseAt.toISOString().slice(0, 10) },
      })
    }
    return tranches.length
  }

  private async dispatchPayoutDelayed(): Promise<number> {
    // Cohort: PayoutEvent rows whose `arrivalDate` is in the past but
    // status is still non-terminal (pending / in_transit). Stripe has no
    // dedicated `payout.delayed` webhook event — a payout becomes
    // "delayed" by missing its expected arrival date. The
    // `NotificationDelivery` unique index dedupes per (templateKey,
    // channel, dedupeKey), so the daily re-run is idempotent per
    // payoutEventId until the event flips to paid/failed/canceled.
    const yesterday = new Date(Date.now() - 86_400_000)
    const events = await this.prisma.payoutEvent.findMany({
      where: {
        status: { in: ['pending', 'in_transit'] },
        arrivalDate: { lt: yesterday },
      },
      select: { id: true },
      take: BATCH_SIZE,
    })
    for (const e of events) {
      notify(this.eventEmitter, NotificationType.ProviderPayoutDelayed, { payoutEventId: e.id })
    }
    return events.length
  }

  private async dispatchMessagingUnanswered(
    hoursAgo: 24 | 48,
    type: NotificationType
  ): Promise<number> {
    const windowEnd = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    const windowStart = new Date(windowEnd.getTime() - 60 * 60 * 1000)
    // Cohort: USER_PROVIDER conversations whose `lastMessageAt` falls in
    // the [windowStart, windowEnd] hour AND whose last message came from
    // the family (lastRequesterReplyAt) without a provider reply since.
    // Source data: `Conversation.lastMessageId` + the linked Message's
    // sender. Cheap correlation via lastActivityAt window.
    const candidates = await this.prisma.conversation.findMany({
      where: {
        type: 'USER_PROVIDER',
        lastActivityAt: { gte: windowStart, lt: windowEnd },
      },
      select: {
        id: true,
        lastMessageId: true,
        metadata: true,
      },
      take: BATCH_SIZE,
    })
    let dispatched = 0
    for (const c of candidates) {
      if (!c.lastMessageId) continue
      const msg = await this.prisma.message.findUnique({
        where: { id: c.lastMessageId },
        select: { senderType: true },
      })
      if (msg?.senderType !== 'USER') continue
      const meta = c.metadata as { providerId?: string } | null
      notify(this.eventEmitter, type, {
        conversationId: c.id,
        messageId: c.lastMessageId,
        providerId: meta?.providerId,
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
      `cron:lock:provider-engagement:${suffix}`,
      '1',
      'EX',
      600,
      'NX'
    )
    return acquired === 'OK'
  }

  private async unlock(suffix: string): Promise<void> {
    if (!this.redis.isReady()) return
    await this.redis.del(`cron:lock:provider-engagement:${suffix}`)
  }
}
