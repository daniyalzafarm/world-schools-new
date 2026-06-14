import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { CaptureEngineService } from './capture-engine.service'
import type { CaptureJobData } from './enqueue-capture.service'
import {
  SCHEDULED_CAPTURE_JOB_NAME,
  SCHEDULED_CAPTURES_QUEUE_NAME,
} from './scheduled-captures.queue'

/**
 * Worker for the `scheduled-captures` queue. Each delayed job is a
 * `{ bookingGroupId, sequence }` pair that fires at the capture boundary; we
 * delegate to the engine, which owns the acceptance guard, the atomic claim,
 * and idempotency. The queue runs `attempts: 1` — recovery for a failed/lost
 * job is the hourly reconciliation cron, not BullMQ retries.
 */
@Processor(SCHEDULED_CAPTURES_QUEUE_NAME)
export class ScheduledCapturesWorker extends WorkerHost {
  private readonly logger = new Logger(ScheduledCapturesWorker.name)

  constructor(private readonly engine: CaptureEngineService) {
    super()
  }

  override async process(job: Job<CaptureJobData>): Promise<void> {
    if (job.name !== SCHEDULED_CAPTURE_JOB_NAME) return
    const { bookingGroupId, sequence } = job.data
    const outcome = await this.engine.executeCapture(bookingGroupId, sequence)
    if (outcome.status === 'failed') {
      // The engine already recorded `failed` + retryDeadline + audit; the
      // reconciliation cron / retry flow owns re-attempts. We log rather than
      // throw so the job isn't endlessly retried by BullMQ against Stripe.
      this.logger.warn(`capture job ${bookingGroupId}/${sequence}: ${outcome.reason}`)
    }
  }
}
