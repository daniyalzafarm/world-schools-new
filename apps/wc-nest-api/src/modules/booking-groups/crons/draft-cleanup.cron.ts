import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { BookingGroupStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'

const LOCK_KEY = 'cron:lock:booking-draft-cleanup'
const LOCK_TTL_SECONDS = 600
const BATCH_SIZE = 200
/** Drafts untouched for longer than this are considered abandoned. */
const DRAFT_TTL_HOURS = 48

/**
 * Cleans up abandoned draft booking groups.
 *
 * A `draft` booking group is created when a parent starts the booking flow but
 * has not yet submitted (no payment exists until submit). Stale drafts clutter
 * the parent's "continue your booking" surface and the per-camp draft-dedup
 * check, and they retain rows indefinitely. This cron deletes drafts untouched
 * for more than `DRAFT_TTL_HOURS`, mirroring `deleteDraftForParent` (delete the
 * child `Booking` rows, then the group — only ever for `draft` status, so no
 * payment/payout/refund rows are ever involved).
 */
@Injectable()
export class BookingDraftCleanupCron {
  private readonly logger = new Logger(BookingDraftCleanupCron.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  // 04:00 UTC daily — ops-quiet window, well clear of the response-expiry run.
  @Cron('0 4 * * *')
  async run(): Promise<void> {
    const client = this.redis.getClient()
    const acquired = client ? await client.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX') : '1'
    if (!acquired) {
      this.logger.debug('booking-draft-cleanup cron already running elsewhere, skipping')
      return
    }
    try {
      await this.runBatch()
    } finally {
      if (client) await client.del(LOCK_KEY).catch(() => undefined)
    }
  }

  /** Visible for testing — runs the sweep without the lock. */
  async runBatch(now: Date = new Date()): Promise<{ deleted: number }> {
    const cutoff = new Date(now.getTime() - DRAFT_TTL_HOURS * 60 * 60 * 1000)
    const stale = await this.prisma.bookingGroup.findMany({
      where: { status: BookingGroupStatus.draft, updatedAt: { lt: cutoff } },
      select: { id: true },
      take: BATCH_SIZE,
    })

    let deleted = 0
    for (const bg of stale) {
      try {
        const removed = await this.prisma.$transaction(async tx => {
          // Lock the group row and re-check status INSIDE the tx so a parent
          // submitting this draft concurrently (which transitions it to
          // `request`) can't have its bookings deleted out from under it.
          const locked = await tx.$queryRaw<
            { status: string }[]
          >`SELECT status FROM booking_groups WHERE id = ${bg.id} FOR UPDATE`
          if (locked[0]?.status !== BookingGroupStatus.draft) return false
          await tx.booking.deleteMany({ where: { bookingGroupId: bg.id } })
          await tx.bookingGroup.delete({ where: { id: bg.id } })
          return true
        })
        if (removed) deleted++
      } catch (err) {
        this.logger.error(
          `booking-draft-cleanup: failed to delete draft ${bg.id}: ${(err as Error).message}`,
          (err as Error).stack
        )
      }
    }

    if (deleted > 0) this.logger.log(`booking-draft-cleanup: removed ${deleted} abandoned draft(s)`)
    return { deleted }
  }
}
