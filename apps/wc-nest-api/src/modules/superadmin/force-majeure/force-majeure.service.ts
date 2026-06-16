import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '../../../generated/client/client'
import { BookingGroupStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { PaymentIntentsService } from '../../billing/intents/payment-intents.service'
import { RefundsService } from '../../billing/refunds/refunds.service'

const MAX_BULK = 1000

// Bookings that are already terminal can't be force-majeure cancelled.
const TERMINAL_STATUSES: BookingGroupStatus[] = [
  BookingGroupStatus.cancelled,
  BookingGroupStatus.completed,
  BookingGroupStatus.declined,
  BookingGroupStatus.expired,
  BookingGroupStatus.fully_refunded,
  BookingGroupStatus.disputed,
]

export interface ForceMajeureScope {
  dateFrom: Date
  dateTo: Date
  providerId?: string
  region?: string
}

/**
 * Force Majeure bulk cancellation (Payments revamp, Spec v2.3 §8). Selects
 * active bookings whose programme falls in a date window (optionally scoped to a
 * provider) and cancels each with a Force-Majeure cash refund — captured funds
 * back minus the platform fee — recording a `force_majeure_events` audit row.
 *
 * Runs the per-booking cancellations in a bounded synchronous loop (no
 * production scale yet; a BullMQ fan-out is the follow-up for large events).
 */
@Injectable()
export class ForceMajeureService {
  private readonly logger = new Logger(ForceMajeureService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly refunds: RefundsService,
    private readonly paymentIntents: PaymentIntentsService
  ) {}

  private affectedWhere(scope: Pick<ForceMajeureScope, 'dateFrom' | 'dateTo' | 'providerId'>) {
    return {
      status: { notIn: TERMINAL_STATUSES },
      session: { startDate: { gte: scope.dateFrom, lte: scope.dateTo } },
      ...(scope.providerId ? { providerId: scope.providerId } : {}),
    }
  }

  /** Dry-run: how many bookings the scope would affect. */
  async preview(scope: ForceMajeureScope): Promise<{ affectedBookingCount: number }> {
    const affectedBookingCount = await this.prisma.bookingGroup.count({
      where: this.affectedWhere(scope),
    })
    return { affectedBookingCount }
  }

  async execute(
    adminUserId: string,
    description: string,
    scope: ForceMajeureScope,
    refundPlatformFee = false
  ): Promise<{
    eventId: string
    cancelled: number
    failed: number
    totalRefunded: string
  }> {
    const affected = await this.prisma.bookingGroup.findMany({
      where: this.affectedWhere(scope),
      select: { id: true },
      take: MAX_BULK,
    })

    const event = await this.prisma.forceMajeureEvent.create({
      data: {
        administratorUserId: adminUserId,
        description,
        affectedProgrammeDateFrom: scope.dateFrom,
        affectedProgrammeDateTo: scope.dateTo,
        affectedProviderId: scope.providerId ?? null,
        affectedRegion: scope.region ?? null,
      },
    })

    let cancelled = 0
    let failed = 0
    let totalRefunded = new Prisma.Decimal(0)

    for (const bg of affected) {
      try {
        const result = await this.refunds.cancelByForceMajeure({
          bookingGroupId: bg.id,
          adminUserId,
          mode: 'cash',
          refundPlatformFee,
          voidAuthFn: id =>
            this.paymentIntents
              .cancelForBookingGroup(id, 'requested_by_customer')
              .then(() => undefined),
        })
        cancelled++
        for (const r of result.refunds ?? []) {
          if (r?.amount != null) totalRefunded = totalRefunded.add(new Prisma.Decimal(r.amount))
        }
      } catch (err) {
        failed++
        this.logger.warn(
          `force-majeure: booking ${bg.id} skipped: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    await this.prisma.forceMajeureEvent.update({
      where: { id: event.id },
      data: {
        affectedBookingCount: cancelled,
        totalRefundedAmount: totalRefunded,
        // FM retains the platform fee by default (Spec v2.3); the admin can opt
        // to also refund it per event via `refundPlatformFee`.
        platformFeeRefunded: refundPlatformFee,
      },
    })

    if (affected.length === MAX_BULK) {
      this.logger.warn(
        `force-majeure: hit the ${MAX_BULK}-booking cap — run again to process the remainder`
      )
    }

    return { eventId: event.id, cancelled, failed, totalRefunded: totalRefunded.toString() }
  }
}
