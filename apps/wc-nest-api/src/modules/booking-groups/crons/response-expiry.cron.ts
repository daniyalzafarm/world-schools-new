import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { BookingGroupStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { PaymentIntentsService } from '../../billing/intents/payment-intents.service'
import { WsInternalEvent } from '../../websocket/ws-internal-events'

const LOCK_KEY = 'cron:lock:booking-response-expiry'
const LOCK_TTL_SECONDS = 600
const BATCH_SIZE = 200

/**
 * Provider-response-window enforcement.
 *
 * Submitting a booking sets `expiresAt = submit + PROVIDER_RESPONSE_WINDOW_HOURS`
 * (72h). Before this cron, that deadline was cosmetic — the only thing that
 * eventually expired a `request` was the ~6-day Stripe auth cliff in
 * `auth-expiry-monitor.cron.ts`. This cron makes the 72h window authoritative:
 * it finds `request` bookings past `expiresAt`, voids the card authorization
 * (so the parent's hold is released), flips the group to `expired`, and emits a
 * status-change event.
 *
 * Safety:
 *   - Status-guarded `updateMany` (request → expired) so a concurrent
 *     accept/decline that wins the race is never overwritten.
 *   - `cancelForBookingGroup` is idempotent on Stripe; a failed void leaves the
 *     booking in `request` for the next run to retry rather than expiring it
 *     with a live hold still on the card.
 *   - Redis lock prevents overlapping runs across instances.
 */
@Injectable()
export class BookingResponseExpiryCron {
  private readonly logger = new Logger(BookingResponseExpiryCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly paymentIntentsService: PaymentIntentsService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  // Every 15 minutes — tight enough that a 72h window expires within ~minutes
  // of the deadline without hammering Stripe.
  @Cron('*/15 * * * *')
  async run(): Promise<void> {
    const client = this.redis.getClient()
    const acquired = client ? await client.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX') : '1'
    if (!acquired) {
      this.logger.debug('booking-response-expiry cron already running elsewhere, skipping')
      return
    }
    try {
      await this.runBatch()
    } finally {
      if (client) await client.del(LOCK_KEY).catch(() => undefined)
    }
  }

  /** Visible for testing — runs the expiry sweep without the lock. */
  async runBatch(now: Date = new Date()): Promise<{ expired: number }> {
    const candidates = await this.prisma.bookingGroup.findMany({
      where: {
        status: BookingGroupStatus.request,
        expiresAt: { not: null, lt: now },
      },
      select: {
        id: true,
        bookingGroupNumber: true,
        providerId: true,
        parent: { select: { userId: true } },
        camp: { select: { name: true } },
        session: { select: { startDate: true, endDate: true } },
        provider: { select: { settings: { select: { currency: true } } } },
      },
      take: BATCH_SIZE,
    })

    let expired = 0
    for (const bg of candidates) {
      try {
        // Void any open authorization first; if this throws (transient Stripe
        // error) we skip the flip and let the next run retry.
        await this.paymentIntentsService.cancelForBookingGroup(bg.id, 'requested_by_customer')

        const res = await this.prisma.bookingGroup.updateMany({
          where: { id: bg.id, status: BookingGroupStatus.request },
          data: { status: BookingGroupStatus.expired, respondedAt: now },
        })
        if (res.count === 0) continue // raced by an accept/decline — fine.

        expired++
        this.eventEmitter.emit(WsInternalEvent.BookingStatusChanged, {
          bookingGroupId: bg.id,
          bookingGroupNumber: bg.bookingGroupNumber,
          newStatus: 'expired',
          previousStatus: 'request',
          parentUserId: bg.parent.userId,
          providerId: bg.providerId,
          campName: bg.camp.name,
          respondedAt: now.toISOString(),
          currency: bg.provider.settings?.currency?.toUpperCase(),
          sessionStartDate: bg.session.startDate.toISOString(),
          sessionEndDate: bg.session.endDate.toISOString(),
        })
      } catch (err) {
        this.logger.error(
          `booking-response-expiry: failed to expire ${bg.id}: ${(err as Error).message}`,
          (err as Error).stack
        )
      }
    }

    if (expired > 0) this.logger.log(`booking-response-expiry: expired ${expired} request(s)`)
    return { expired }
  }
}
