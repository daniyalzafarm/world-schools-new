import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '../../../generated/client/client'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  buildCaptureSchedule,
  resolveProgrammeLocationTimezone,
} from '../shared/capture-schedule.util'
import { readBookingPolicySnapshot } from '../shared/cancellation-policy.util'
import { CaptureEngineService } from './capture-engine.service'
import { EnqueueCaptureService } from './enqueue-capture.service'

/**
 * Materialises a booking's `booking_scheduled_captures` rows at provider
 * acceptance and dispatches them (Payments revamp, Spec v2.3): rows whose
 * `effectiveCaptureDate` is already due fire synchronously through the engine
 * (the deposit capture-or-defer + near-term captures); future rows get a delayed
 * BullMQ job.
 *
 * The acceptance guard is encoded in `effectiveCaptureDate = max(captureDate,
 * graceDeadline, acceptanceTime)` (computed by the pure engine) plus the
 * per-row guard inside `CaptureEngineService.executeCapture`.
 *
 * Idempotent: re-running for a booking that already has rows is a no-op (a
 * re-acceptance or retry won't double-insert or double-fire).
 */
@Injectable()
export class CaptureSchedulerService {
  private readonly logger = new Logger(CaptureSchedulerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: CaptureEngineService,
    private readonly enqueue: EnqueueCaptureService
  ) {}

  async materializeForBooking(bookingGroupId: string, now: Date = new Date()): Promise<void> {
    const booking = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: {
        id: true,
        totalAmount: true,
        depositAmount: true,
        graceDeadline: true,
        respondedAt: true,
        appFeePercentageSnapshot: true,
        cancellationPolicySnapshot: true,
        session: { select: { startDate: true } },
        provider: { select: { settings: { select: { timezone: true, currency: true } } } },
      },
    })
    if (!booking) {
      this.logger.warn(`materializeForBooking: booking ${bookingGroupId} not found`)
      return
    }

    // Idempotency: never re-materialise (a second acceptance / retry must not
    // duplicate rows or re-fire captures).
    const existing = await this.prisma.bookingScheduledCapture.count({
      where: { bookingGroupId },
    })
    if (existing > 0) return

    const acceptanceTime = booking.respondedAt ?? now
    const graceDeadline = booking.graceDeadline ?? acceptanceTime
    const tiers = readBookingPolicySnapshot(booking.cancellationPolicySnapshot)?.tiers ?? []
    const depositMajor = booking.depositAmount ? booking.depositAmount.toNumber() : 0
    const balanceMajor = booking.totalAmount.toNumber() - depositMajor
    const timezone = resolveProgrammeLocationTimezone({
      providerTimezone: booking.provider?.settings?.timezone,
    })
    const currency = (booking.provider?.settings?.currency ?? 'usd').toLowerCase()
    const appFeePct = booking.appFeePercentageSnapshot ?? new Prisma.Decimal(0)

    const schedule = buildCaptureSchedule({
      tiers,
      depositAmount: depositMajor,
      balanceAmount: balanceMajor,
      sessionStart: booking.session.startDate,
      timezone,
      graceDeadline,
      acceptanceTime,
    })

    if (schedule.events.length === 0) return

    // Insert all rows + stamp the (internal) capture mode in one transaction.
    await this.prisma.$transaction(async tx => {
      await tx.bookingScheduledCapture.createMany({
        data: schedule.events.map(e => ({
          bookingGroupId,
          sequence: e.sequence,
          amount: new Prisma.Decimal(e.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          applicationFeeAmount: new Prisma.Decimal(e.amount)
            .mul(appFeePct)
            .div(100)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          currency,
          captureDate: e.captureDate,
          effectiveCaptureDate: e.effectiveCaptureDate,
        })),
      })
      await tx.bookingGroup.update({
        where: { id: bookingGroupId },
        data: { captureMode: schedule.captureMode },
      })
    })

    // Dispatch: fire due captures synchronously (deposit-if-grace-expired +
    // near-term), enqueue delayed jobs for the rest. Firing is engine-guarded,
    // so a row that isn't actually eligible is skipped harmlessly.
    for (const e of schedule.events) {
      if (e.effectiveCaptureDate.getTime() <= now.getTime()) {
        await this.engine.executeCapture(bookingGroupId, e.sequence, now)
      } else {
        await this.enqueue.enqueue(bookingGroupId, e.sequence, e.effectiveCaptureDate, now)
      }
    }
  }
}
