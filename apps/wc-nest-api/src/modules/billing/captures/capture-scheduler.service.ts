import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { Prisma } from '../../../generated/client/client'
import { ScheduledCaptureStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  buildCaptureSchedule,
  type CaptureSchedule,
  type CaptureScheduleEvent,
  resolveProgrammeLocationTimezone,
} from '../shared/capture-schedule.util'
import { readBookingPolicySnapshot } from '../shared/cancellation-policy.util'
import { CancelCaptureService } from './cancel-capture.service'
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
    private readonly enqueue: EnqueueCaptureService,
    private readonly cancelCapture: CancelCaptureService
  ) {}

  /**
   * @returns `syncFailures` — how many captures that were due AT/BEFORE
   * acceptance (deposit-if-grace-expired + near-term balance) fired synchronously
   * and FAILED. The caller uses this to avoid confirming a slot on an unsecured
   * card (Spec v2.3 §5 / near-term no-deposit gating).
   */
  async materializeForBooking(
    bookingGroupId: string,
    now: Date = new Date()
  ): Promise<{ syncFailures: number }> {
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
      return { syncFailures: 0 }
    }

    // Idempotency: never re-materialise (a second acceptance / retry must not
    // duplicate rows or re-fire captures).
    const existing = await this.prisma.bookingScheduledCapture.count({
      where: { bookingGroupId },
    })
    if (existing > 0) return { syncFailures: 0 }

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

    if (schedule.events.length === 0) return { syncFailures: 0 }

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
    // so a row that isn't actually eligible is skipped harmlessly. A synchronous
    // failure is counted so the caller can avoid confirming a slot on an
    // unsecured card.
    let syncFailures = 0
    for (const e of schedule.events) {
      if (e.effectiveCaptureDate.getTime() <= now.getTime()) {
        const outcome = await this.engine.executeCapture(bookingGroupId, e.sequence, now)
        if (outcome.status === 'failed') syncFailures++
      } else {
        await this.enqueue.enqueue(bookingGroupId, e.sequence, e.effectiveCaptureDate, now)
      }
    }
    return { syncFailures }
  }

  /**
   * Plan a reschedule recompute against a NEW programme start (Spec v2.5 §9.7) —
   * PURE: loads state, guards, derives the new schedule, but writes nothing. The
   * returned plan carries everything needed to BOTH write the rows and build the
   * re-consent snapshot from the same source.
   *
   * Already-captured (`completed`) rows are preserved and excluded from the
   * recomputed remaining balance; the deposit is re-scheduled only if not yet
   * captured. New rows are remapped to sequences strictly ABOVE the current max,
   * which sidesteps the `@@unique([bookingGroupId, sequence])` constraint and any
   * BullMQ jobId reuse (a stale job for an old sequence hits the engine's
   * "row cancelled" guard). The acceptance guard + `effectiveCaptureDate=max(...)`
   * invariant are preserved via the same pure engine.
   *
   * Guarded: rejects if any capture is `processing` or `failed` (in-flight or
   * un-collected) — those must resolve first, so we never race a live charge or
   * orphan an amount.
   */
  async planReschedule(
    bookingGroupId: string,
    newStart: Date,
    now: Date = new Date()
  ): Promise<ReschedulePlan> {
    const booking = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      select: {
        id: true,
        totalAmount: true,
        depositAmount: true,
        depositCapturedAt: true,
        graceDeadline: true,
        respondedAt: true,
        appFeePercentageSnapshot: true,
        cancellationPolicySnapshot: true,
        provider: { select: { settings: { select: { timezone: true, currency: true } } } },
      },
    })
    if (!booking) throw new BadRequestException(`Booking ${bookingGroupId} not found`)

    const captures = await this.prisma.bookingScheduledCapture.findMany({
      where: { bookingGroupId },
      select: { sequence: true, status: true, amount: true },
    })
    if (
      captures.some(
        c =>
          c.status === ScheduledCaptureStatus.processing ||
          c.status === ScheduledCaptureStatus.failed
      )
    ) {
      throw new BadRequestException(
        'Cannot reschedule while a capture is in-flight or failed; resolve it before rescheduling.'
      )
    }

    const depositCaptured =
      booking.depositCapturedAt != null ||
      captures.some(c => c.sequence === 0 && c.status === ScheduledCaptureStatus.completed)
    const capturedBalanceMajor = captures
      .filter(c => c.sequence >= 1 && c.status === ScheduledCaptureStatus.completed)
      .reduce((s, c) => s + c.amount.toNumber(), 0)
    const maxSeq = captures.reduce((m, c) => Math.max(m, c.sequence), -1)

    const depositMajor = booking.depositAmount ? booking.depositAmount.toNumber() : 0
    const remainingBalanceMajor = Math.max(
      0,
      booking.totalAmount.toNumber() - depositMajor - capturedBalanceMajor
    )
    const acceptanceTime = booking.respondedAt ?? now
    const graceDeadline = booking.graceDeadline ?? acceptanceTime
    const tiers = readBookingPolicySnapshot(booking.cancellationPolicySnapshot)?.tiers ?? []
    const timezone = resolveProgrammeLocationTimezone({
      providerTimezone: booking.provider?.settings?.timezone,
    })
    const currency = (booking.provider?.settings?.currency ?? 'usd').toLowerCase()
    const appFeePct = booking.appFeePercentageSnapshot ?? new Prisma.Decimal(0)

    const schedule = buildCaptureSchedule({
      tiers,
      // A deposit already captured is never re-scheduled; otherwise it recaptures
      // at its (request-anchored, reschedule-invariant) grace deadline.
      depositAmount: depositCaptured ? 0 : depositMajor,
      balanceAmount: remainingBalanceMajor,
      sessionStart: newStart,
      timezone,
      graceDeadline,
      acceptanceTime,
    })

    return {
      bookingGroupId,
      graceDeadline,
      currency,
      captureMode: schedule.captureMode,
      schedule,
      // Remap to sequences above the current max (collision/jobId-reuse safe).
      events: schedule.events.map((e, i) => ({ ...e, sequence: maxSeq + 1 + i })),
      appFeePct,
      depositForConsentMajor: depositCaptured ? null : (booking.depositAmount?.toNumber() ?? null),
    }
  }

  /**
   * Apply a {@link ReschedulePlan}'s capture rows inside the caller's transaction:
   * cancel the not-yet-fired rows (jobs removed) and insert the regenerated ones.
   * The caller drives the single transaction (consent snapshot + proposal +
   * rescheduledStartDate live in the same tx); dispatch happens after commit via
   * {@link dispatchRescheduleRows}.
   */
  async writeRescheduleRows(tx: Prisma.TransactionClient, plan: ReschedulePlan): Promise<void> {
    await this.cancelCapture.cancelForBooking(plan.bookingGroupId, 'rescheduled', tx)
    if (plan.events.length > 0) {
      await tx.bookingScheduledCapture.createMany({
        data: plan.events.map(e => ({
          bookingGroupId: plan.bookingGroupId,
          sequence: e.sequence,
          amount: new Prisma.Decimal(e.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          applicationFeeAmount: new Prisma.Decimal(e.amount)
            .mul(plan.appFeePct)
            .div(100)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          currency: plan.currency,
          captureDate: e.captureDate,
          effectiveCaptureDate: e.effectiveCaptureDate,
        })),
      })
    }
    await tx.bookingGroup.update({
      where: { id: plan.bookingGroupId },
      data: { captureMode: plan.captureMode },
    })
  }

  /** Dispatch a plan's regenerated rows AFTER the tx commits (fire due / enqueue future). */
  async dispatchRescheduleRows(plan: ReschedulePlan, now: Date = new Date()): Promise<number> {
    let syncFailures = 0
    for (const e of plan.events) {
      if (e.effectiveCaptureDate.getTime() <= now.getTime()) {
        const outcome = await this.engine.executeCapture(plan.bookingGroupId, e.sequence, now)
        if (outcome.status === 'failed') syncFailures++
      } else {
        await this.enqueue.enqueue(plan.bookingGroupId, e.sequence, e.effectiveCaptureDate, now)
      }
    }
    return syncFailures
  }

  /** Standalone re-materialise (own tx + dispatch). Used in tests / direct callers. */
  async rematerializeForBooking(
    bookingGroupId: string,
    newStart: Date,
    now: Date = new Date()
  ): Promise<{ syncFailures: number }> {
    const plan = await this.planReschedule(bookingGroupId, newStart, now)
    await this.prisma.$transaction(tx => this.writeRescheduleRows(tx, plan))
    const syncFailures = await this.dispatchRescheduleRows(plan, now)
    return { syncFailures }
  }
}

/** Output of {@link CaptureSchedulerService.planReschedule}. */
export interface ReschedulePlan {
  bookingGroupId: string
  graceDeadline: Date
  currency: string
  captureMode: CaptureSchedule['captureMode']
  schedule: CaptureSchedule
  /** Schedule events remapped to sequences above the booking's current max. */
  events: CaptureScheduleEvent[]
  appFeePct: Prisma.Decimal
  /** Deposit (major units) for the re-consent snapshot; null when no/already-captured deposit. */
  depositForConsentMajor: number | null
}
