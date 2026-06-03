import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import { QUEUE_NAMES } from './queue.constants'
import type { NotificationJobData } from './queue.types'

/**
 * Cancels future-scheduled notification jobs for an entity whose state
 * change makes the original reminder irrelevant. Example: when a parent
 * pays the balance, the 7-day / 3-day balance reminder jobs should be
 * removed.
 *
 * Implementation note: cancellation operates on **deterministic jobIds**
 * produced by `NotificationsEnqueueService.enqueue()`. Callers pass the
 * `(type, recipientUserId, dedupeKey)` tuple OR — for the common
 * per-entity case — call one of the entity helpers which enumerate the
 * full set of trigger types scoped to that entity.
 *
 * Entity helpers are populated as catalog entries land — keeping them in
 * one place prevents the cancel call sites from drifting out of sync
 * with the dispatch call sites.
 */
@Injectable()
export class NotificationsCancelService {
  private readonly logger = new Logger(NotificationsCancelService.name)

  constructor(
    @InjectQueue(QUEUE_NAMES.Notifications) private readonly liveQueue: Queue<NotificationJobData>,
    @InjectQueue(QUEUE_NAMES.NotificationsScheduled)
    private readonly scheduledQueue: Queue<NotificationJobData>
  ) {}

  /**
   * Remove a single scheduled job by its deterministic id. Safe to call
   * on a missing id (BullMQ no-ops).
   */
  async cancelByJobId(jobId: string): Promise<void> {
    try {
      // Try both queues; only one will hold the id.
      await Promise.all([this.scheduledQueue.remove(jobId), this.liveQueue.remove(jobId)])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`cancelByJobId(${jobId}) failed: ${message}`)
    }
  }

  /**
   * Cancel a (type, recipientUserId, dedupeKey) tuple. Wraps `cancelByJobId`
   * with the same jobId convention used by the enqueue service.
   */
  async cancel(type: string, recipientUserId: string, dedupeKey: string): Promise<void> {
    // Mirror the `:` → `_` sanitization the enqueue service applies (BullMQ
    // rejects custom ids containing ':'); the ids must match for remove() to
    // find the scheduled job.
    return this.cancelByJobId(`${type}:${recipientUserId}:${dedupeKey}`.replace(/:/g, '_'))
  }
}
