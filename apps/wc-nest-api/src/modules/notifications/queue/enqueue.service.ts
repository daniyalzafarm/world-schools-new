import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { type JobsOptions, Queue } from 'bullmq'
import { NotificationsMetricsService } from '../observability/notifications-metrics.service'
import { JOB_NAMES, QUEUE_NAMES } from './queue.constants'
import type { NotificationChannel, NotificationContext, NotificationJobData } from './queue.types'

export interface EnqueueOptions {
  type: string
  recipientUserId: string
  channels: NotificationChannel[]
  context: NotificationContext
  dedupeKey: string
  /** ms from now to delay execution; 0 (default) routes to the live queue. */
  delay?: number
  source?: NotificationJobData['source']
}

/**
 * Per-channel retry overrides (Phase 14d).
 *
 * A jobs's `channels` array can be `['in_app']`, `['email']`, or both. The
 * queue's `defaultJobOptions` are tuned for email (`attempts: 5, backoff:
 * exp 30s`) because external SMTP failures genuinely benefit from
 * aggressive retry. In-app notifications are just a Prisma write — five
 * retries over ~7 minutes is overkill for what is almost always a Prisma
 * transient that recovers in seconds. We therefore override the job's
 * retry config when it targets `['in_app']` exclusively (the common
 * "no-email-channel" case).
 *
 * Mixed-channel jobs (`['in_app', 'email']`) keep the email-style retry
 * config — the worker iterates channels inside the job, so the budget has
 * to be sized for the worst-case channel.
 */
const IN_APP_ONLY_RETRY: Pick<JobsOptions, 'attempts' | 'backoff'> = {
  attempts: 3,
  backoff: { type: 'fixed', delay: 5_000 },
}

/**
 * Façade injected by the NotificationDispatcher. Routes to the live or
 * scheduled queue based on `delay`, sets a deterministic `jobId` so
 * BullMQ rejects duplicates, and never throws — enqueue failures are
 * logged so they don't bring down the calling domain service. The
 * `NotificationDelivery` unique index is the load-bearing dedupe guard;
 * `jobId` is the cheap first line of defence.
 */
@Injectable()
export class NotificationsEnqueueService {
  private readonly logger = new Logger(NotificationsEnqueueService.name)

  constructor(
    @InjectQueue(QUEUE_NAMES.Notifications) private readonly liveQueue: Queue<NotificationJobData>,
    @InjectQueue(QUEUE_NAMES.NotificationsScheduled)
    private readonly scheduledQueue: Queue<NotificationJobData>,
    private readonly metrics: NotificationsMetricsService
  ) {}

  async enqueue(options: EnqueueOptions): Promise<void> {
    const delay = Math.max(0, options.delay ?? 0)
    const queue = delay > 0 ? this.scheduledQueue : this.liveQueue
    const source: NotificationJobData['source'] =
      options.source ?? (delay > 0 ? 'scheduled' : 'live')

    const payload: NotificationJobData = {
      type: options.type,
      recipientUserId: options.recipientUserId,
      channels: options.channels,
      context: options.context,
      enqueuedAt: new Date().toISOString(),
      dedupeKey: options.dedupeKey,
      source,
    }

    // Deterministic jobId: `<type>_<recipientUserId>_<dedupeKey>`. BullMQ
    // silently no-ops when this id already exists, so re-emitting the same
    // domain event is safe. BullMQ forbids ':' in custom ids (it throws
    // "Custom Id cannot contain :"); our type/dedupeKey use ':' as a field
    // separator — and dedupeKey itself embeds one — so swap every ':' for
    // '_'. Cancel (cancel.service.ts) must apply the identical transform.
    const jobId = `${options.type}:${options.recipientUserId}:${options.dedupeKey}`.replace(
      /:/g,
      '_'
    )

    const jobOptions: JobsOptions = { jobId, delay }
    // Per-channel retry override: in-app-only jobs use a tighter budget
    // (3 attempts, 5s fixed backoff) since they're just Prisma writes.
    // Mixed in-app + email jobs keep the queue defaults (5 attempts,
    // exponential 30s) because the email leg dominates the failure modes.
    const inAppOnly = options.channels.length === 1 && options.channels[0] === 'in_app'
    if (inAppOnly) {
      jobOptions.attempts = IN_APP_ONLY_RETRY.attempts
      jobOptions.backoff = IN_APP_ONLY_RETRY.backoff
    }

    try {
      await queue.add(JOB_NAMES.DispatchNotification, payload, jobOptions)
      this.metrics.recordEnqueued(options.channels.length)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `Failed to enqueue notification ${options.type} for user ${options.recipientUserId}: ${message}`
      )
    }
  }
}
