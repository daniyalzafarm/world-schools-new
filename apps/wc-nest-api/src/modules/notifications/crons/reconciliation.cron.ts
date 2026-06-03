import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Cron } from '@nestjs/schedule'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { notify } from '../dispatcher/notify'
import { NotificationsMetricsService } from '../observability/notifications-metrics.service'
import { RedisService } from '../../redis/redis.service'

/** Per-page size; cursor pagination drains all matching candidates. */
const PAGE_SIZE = 1000
/** Defensive cap on total pages per tier per run; logs a WARN at the cap so
 *  a degenerate query (e.g. millions of rows in one 25h window) doesn't run
 *  forever. Pick a value large enough that production never hits it; ~50
 *  pages × 1000 = 50k candidates per tier per cron run. */
const MAX_PAGES_PER_TIER = 50
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const WINDOW_HOURS = 25 // 24h coverage + 1h overlap for clock skew

/**
 * Phase 10 — Notification reconciliation cron.
 *
 * Daily sweep that catches scheduled BullMQ jobs which may have been lost
 * between enqueue (at a domain commit point) and their `runAt` firing time.
 * Belt + braces with two existing idempotency layers:
 *  1. BullMQ's deterministic `jobId` rejection (see `enqueue.service.ts`).
 *  2. `NotificationDelivery(template_key, channel, dedupe_key)` unique index.
 *
 * Both layers make re-emits safe — re-running `notify(type, ctx, runAt)`
 * is a no-op if the job is already in BullMQ OR already delivered. The
 * cron simply queries every scheduled entry's source entity in the next
 * 25h window and re-emits unconditionally; the dispatcher + worker handle
 * dedupe.
 *
 * Phase 14d — cursor pagination. Each tier drains its candidate set in
 * `PAGE_SIZE`-sized pages instead of capping at the first 1000 rows. The
 * load-bearing change vs. the v1 fixed-size `take` is that growth past
 * 1000 candidates per tier per cron no longer silently drops; the cron
 * keeps pulling pages until either an empty page or `MAX_PAGES_PER_TIER`
 * (a defensive cap with a WARN log). Composite indexes added in the same
 * phase make each page an index scan.
 *
 * Covered scheduled triggers (13 — every entity-bound `notify(..., runAt)`
 * call site across the catalog):
 *  - Booking-request 48h/60h/72h reminders & expiry (parent + provider; 5)
 *  - Pre-camp parent tiers (14d/7d/1d before start; 3)
 *  - Pre-camp provider tiers (14d/7d/1d before start; 3)
 *  - Provider post-camp wrap (+1d after end; 1)
 *  - Parent post-decline alternatives (+24h after decline; 1) — uses
 *    BookingGroup.updatedAt as an approximation of `declinedAt`
 *
 * Cron-spawned scheduled entries (post-camp review / abandoned checkout /
 * payment-balance reminders / superadmin & provider engagement) are NOT
 * covered here — their crons run daily and naturally self-heal.
 */
@Injectable()
export class NotificationReconciliationCron {
  private readonly logger = new Logger(NotificationReconciliationCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metrics: NotificationsMetricsService
  ) {}

  /** 02:00 UTC every day. Picks the quietest window across all regions. */
  @Cron('0 2 * * *')
  async run(): Promise<void> {
    if (!(await this.lock('daily'))) return
    try {
      const bookingRequests = await this.reconcileBookingRequestTiers()
      const preCamp = await this.reconcilePreCampTiers()
      const postCamp = await this.reconcileProviderPostCamp()
      const postDecline = await this.reconcilePostDeclineAlternatives()
      this.logger.log(
        `reconciliation daily: requestTiers=${bookingRequests} preCamp=${preCamp} postCamp=${postCamp} postDecline=${postDecline}`
      )
      this.metrics.recordCronRun('reconciliation')
    } catch (err) {
      this.logger.error(
        `reconciliation daily failed: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      await this.unlock('daily')
    }
  }

  // ---------- Reconciliation sources ----------

  /**
   * Parent + provider booking-request reminder + expiry tiers. Each fires
   * at submitTime + {48h, 60h, 72h}. Find groups whose `createdAt` puts
   * the next-25h window on any of those offsets AND that are still in
   * `request` state.
   */
  private async reconcileBookingRequestTiers(): Promise<number> {
    const now = Date.now()
    const tiers: { type: NotificationType; offsetHours: number }[] = [
      { type: NotificationType.ParentBookingRequestStillPending, offsetHours: 48 },
      { type: NotificationType.ParentBookingExpired, offsetHours: 72 },
      { type: NotificationType.ProviderBookingRequest48hReminder, offsetHours: 48 },
      { type: NotificationType.ProviderBookingRequestFinalReminder, offsetHours: 60 },
      { type: NotificationType.ProviderBookingRequestExpired, offsetHours: 72 },
    ]
    let total = 0
    for (const tier of tiers) {
      const earliestSubmit = new Date(now - tier.offsetHours * HOUR_MS)
      const latestSubmit = new Date(earliestSubmit.getTime() + WINDOW_HOURS * HOUR_MS)
      total += await this.paginate(`bookingRequest:${tier.offsetHours}h`, cursor =>
        this.prisma.bookingGroup
          .findMany({
            where: {
              status: 'request',
              createdAt: { gte: earliestSubmit, lt: latestSubmit },
            },
            select: { id: true, createdAt: true },
            orderBy: { id: 'asc' },
            take: PAGE_SIZE,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          })
          .then(page => ({
            page,
            nextCursor: page.length === PAGE_SIZE ? page[page.length - 1]!.id : null,
            dispatched: page.reduce((acc, g) => {
              const runAt = new Date(g.createdAt.getTime() + tier.offsetHours * HOUR_MS)
              if (runAt.getTime() <= now) return acc
              notify(this.eventEmitter, tier.type, { bookingGroupId: g.id }, runAt)
              return acc + 1
            }, 0),
          }))
      )
    }
    return total
  }

  /**
   * Pre-camp parent + provider tiers. Fire at session.startDate − {14d, 7d, 1d}.
   */
  private async reconcilePreCampTiers(): Promise<number> {
    const now = Date.now()
    const tiers: { type: NotificationType; offsetDays: number }[] = [
      { type: NotificationType.ParentPreCampChecklist14d, offsetDays: 14 },
      { type: NotificationType.ParentPreCampPackingReminder7d, offsetDays: 7 },
      { type: NotificationType.ParentPreCampDayBefore, offsetDays: 1 },
      { type: NotificationType.ProviderPreCampRosterReady, offsetDays: 14 },
      { type: NotificationType.ProviderPreCampChecklist, offsetDays: 7 },
      { type: NotificationType.ProviderPreCampDayBefore, offsetDays: 1 },
    ]
    let total = 0
    for (const tier of tiers) {
      const earliestStart = new Date(now + tier.offsetDays * DAY_MS)
      const latestStart = new Date(earliestStart.getTime() + WINDOW_HOURS * HOUR_MS)
      total += await this.paginate(`preCamp:${tier.offsetDays}d`, cursor =>
        this.prisma.bookingGroup
          .findMany({
            where: {
              status: { in: ['accepted', 'deposit_paid', 'fully_paid'] },
              session: { startDate: { gte: earliestStart, lt: latestStart } },
            },
            select: { id: true, session: { select: { startDate: true } } },
            orderBy: { id: 'asc' },
            take: PAGE_SIZE,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          })
          .then(page => ({
            page,
            nextCursor: page.length === PAGE_SIZE ? page[page.length - 1]!.id : null,
            dispatched: page.reduce((acc, g) => {
              const runAt = new Date(g.session.startDate.getTime() - tier.offsetDays * DAY_MS)
              if (runAt.getTime() <= now) return acc
              notify(this.eventEmitter, tier.type, { bookingGroupId: g.id }, runAt)
              return acc + 1
            }, 0),
          }))
      )
    }
    return total
  }

  /**
   * Provider post-camp wrap. Fires at session.endDate + 1d.
   */
  private async reconcileProviderPostCamp(): Promise<number> {
    const now = Date.now()
    const earliestEnd = new Date(now - DAY_MS)
    const latestEnd = new Date(earliestEnd.getTime() + WINDOW_HOURS * HOUR_MS)
    return this.paginate('postCamp', cursor =>
      this.prisma.bookingGroup
        .findMany({
          where: {
            status: { in: ['at_camp', 'completed', 'fully_paid'] },
            session: { endDate: { gte: earliestEnd, lt: latestEnd } },
          },
          select: { id: true, session: { select: { endDate: true } } },
          orderBy: { id: 'asc' },
          take: PAGE_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        })
        .then(page => ({
          page,
          nextCursor: page.length === PAGE_SIZE ? page[page.length - 1]!.id : null,
          dispatched: page.reduce((acc, g) => {
            const runAt = new Date(g.session.endDate.getTime() + DAY_MS)
            if (runAt.getTime() <= now) return acc
            notify(
              this.eventEmitter,
              NotificationType.ProviderPostCampWrap,
              { bookingGroupId: g.id },
              runAt
            )
            return acc + 1
          }, 0),
        }))
    )
  }

  /**
   * Parent post-decline alternatives. Fires at +24h after a provider
   * decline. We don't have a denormalised `declinedAt`; approximate via
   * BookingGroup.updatedAt while status='declined' (the most recent write
   * for a declined group is typically the decline transition itself).
   */
  private async reconcilePostDeclineAlternatives(): Promise<number> {
    const now = Date.now()
    const earliestDecline = new Date(now - DAY_MS)
    const latestDecline = new Date(earliestDecline.getTime() + WINDOW_HOURS * HOUR_MS)
    return this.paginate('postDecline', cursor =>
      this.prisma.bookingGroup
        .findMany({
          where: {
            status: 'declined',
            updatedAt: { gte: earliestDecline, lt: latestDecline },
          },
          select: { id: true, updatedAt: true },
          orderBy: { id: 'asc' },
          take: PAGE_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        })
        .then(page => ({
          page,
          nextCursor: page.length === PAGE_SIZE ? page[page.length - 1]!.id : null,
          dispatched: page.reduce((acc, g) => {
            const runAt = new Date(g.updatedAt.getTime() + DAY_MS)
            if (runAt.getTime() <= now) return acc
            notify(
              this.eventEmitter,
              NotificationType.ParentConversionPostDeclineAlternatives,
              { bookingGroupId: g.id },
              runAt
            )
            return acc + 1
          }, 0),
        }))
    )
  }

  // ---------- Cursor pagination ----------

  /**
   * Generic cursor-pagination driver. The caller supplies a function that,
   * given the current cursor (`null` on first page), returns `{ page,
   * nextCursor, dispatched }`. We loop until `nextCursor === null` or we hit
   * `MAX_PAGES_PER_TIER` (WARN-logged so a degenerate query is visible). The
   * caller does the dispatching and reports how many they emitted per page;
   * we sum the totals so the cron's log line reflects real fan-out.
   */
  private async paginate<T>(
    tierLabel: string,
    fetchPage: (cursor: string | null) => Promise<{
      page: T[]
      nextCursor: string | null
      dispatched: number
    }>
  ): Promise<number> {
    let cursor: string | null = null
    let total = 0
    for (let pageIdx = 0; pageIdx < MAX_PAGES_PER_TIER; pageIdx++) {
      const { nextCursor, dispatched } = await fetchPage(cursor)
      total += dispatched
      if (nextCursor === null) return total
      cursor = nextCursor
    }
    this.logger.warn(
      `reconciliation tier ${tierLabel} hit MAX_PAGES_PER_TIER=${MAX_PAGES_PER_TIER} ` +
        `(=${MAX_PAGES_PER_TIER * PAGE_SIZE} candidates). Investigate query selectivity or raise the cap.`
    )
    return total
  }

  // ---------- Lock helpers ----------

  private async lock(suffix: string): Promise<boolean> {
    if (!this.redis.isReady()) return false
    const client = this.redis.getClient()
    const acquired = await client.set(
      `cron:lock:notification-reconciliation:${suffix}`,
      '1',
      'EX',
      900,
      'NX'
    )
    return acquired === 'OK'
  }

  private async unlock(suffix: string): Promise<void> {
    if (!this.redis.isReady()) return
    await this.redis.del(`cron:lock:notification-reconciliation:${suffix}`)
  }
}
