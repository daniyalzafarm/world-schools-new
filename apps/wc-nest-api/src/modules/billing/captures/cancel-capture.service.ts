import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import { ScheduledCaptureStatus } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import type { Prisma } from '../../../generated/client/client'
import { buildCaptureJobId } from './capture-job-id.util'
import { SCHEDULED_CAPTURES_QUEUE_NAME } from './scheduled-captures.queue'
import type { CaptureJobData } from './enqueue-capture.service'

const NON_TERMINAL_STATUSES: ScheduledCaptureStatus[] = [
  ScheduledCaptureStatus.scheduled,
  ScheduledCaptureStatus.processing,
]

/**
 * Cancels a booking's scheduled captures (Payments revamp, Spec v2.3). Removes
 * the delayed BullMQ jobs AND marks every non-terminal `booking_scheduled_captures`
 * row `cancelled` in the same transaction.
 *
 * This is wired into the SHARED cancellation sink (`refunds.markGroupCancelled`)
 * so it covers EVERY cancel path (customer grace/post-grace, camp-cancel,
 * provider-declined, fraud, expiry, Force Majeure) — the contractual invariant
 * that no capture fires on a cancelled booking (Spec v2.3 §Capture Safety Rules).
 * The engine's "PaymentIntent canceled = no-op" guard is the second line of
 * defence against a job that fires in the race window.
 */
@Injectable()
export class CancelCaptureService {
  private readonly logger = new Logger(CancelCaptureService.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SCHEDULED_CAPTURES_QUEUE_NAME) private readonly queue: Queue<CaptureJobData>
  ) {}

  /**
   * Cancel all non-terminal scheduled captures for a booking. Pass a Prisma
   * transaction client (`tx`) to mark the rows atomically with the caller's
   * cancellation write; job removal is best-effort and happens after.
   */
  async cancelForBooking(
    bookingGroupId: string,
    reason: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const db = tx ?? this.prisma
    const rows = await db.bookingScheduledCapture.findMany({
      where: { bookingGroupId, status: { in: NON_TERMINAL_STATUSES } },
      select: { sequence: true },
    })
    if (rows.length === 0) return

    await db.bookingScheduledCapture.updateMany({
      where: { bookingGroupId, status: { in: NON_TERMINAL_STATUSES } },
      data: { status: ScheduledCaptureStatus.cancelled, cancelledReason: reason },
    })

    // Remove the delayed jobs (best-effort; a job that survives still hits the
    // engine's "booking not capture-eligible / row cancelled" guard).
    await Promise.all(
      rows.map(r =>
        this.queue.remove(buildCaptureJobId(bookingGroupId, r.sequence)).catch(err => {
          this.logger.warn(
            `remove capture job ${bookingGroupId}/${r.sequence} failed: ${
              err instanceof Error ? err.message : String(err)
            }`
          )
        })
      )
    )
  }
}
