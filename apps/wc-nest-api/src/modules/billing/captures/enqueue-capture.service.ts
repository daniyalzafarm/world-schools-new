import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import { buildCaptureJobId } from './capture-job-id.util'
import {
  SCHEDULED_CAPTURE_JOB_NAME,
  SCHEDULED_CAPTURES_QUEUE_NAME,
} from './scheduled-captures.queue'

export interface CaptureJobData {
  bookingGroupId: string
  sequence: number
}

/**
 * Enqueues delayed capture jobs (Payments revamp, Spec v2.3). Called from the
 * provider-acceptance flow once `effectiveCaptureDate` is resolved for each
 * scheduled capture. Never throws — a failed enqueue is recovered by the hourly
 * reconciliation cron, so it must not break acceptance.
 */
@Injectable()
export class EnqueueCaptureService {
  private readonly logger = new Logger(EnqueueCaptureService.name)

  constructor(
    @InjectQueue(SCHEDULED_CAPTURES_QUEUE_NAME) private readonly queue: Queue<CaptureJobData>
  ) {}

  /**
   * Schedule a single capture to fire at `effectiveCaptureDate`. `delay` is
   * clamped to >= 0 so an already-due capture fires immediately (the engine's
   * acceptance guard still gates it). Idempotent on the deterministic jobId.
   */
  async enqueue(
    bookingGroupId: string,
    sequence: number,
    effectiveCaptureDate: Date,
    now: Date = new Date()
  ): Promise<void> {
    const delay = Math.max(0, effectiveCaptureDate.getTime() - now.getTime())
    try {
      await this.queue.add(
        SCHEDULED_CAPTURE_JOB_NAME,
        { bookingGroupId, sequence },
        { jobId: buildCaptureJobId(bookingGroupId, sequence), delay }
      )
    } catch (err) {
      this.logger.warn(
        `enqueue capture ${bookingGroupId}/${sequence} failed (reconciliation cron will recover): ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }
}
