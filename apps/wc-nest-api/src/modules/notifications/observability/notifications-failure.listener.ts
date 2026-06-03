import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { type Queue, QueueEvents } from 'bullmq'
import { PrismaService } from '../../../prisma/prisma.service'
import { QUEUE_NAMES } from '../queue/queue.constants'
import type { NotificationJobData } from '../queue/queue.types'
import { NotificationsMetricsService } from './notifications-metrics.service'

/**
 * Global `failed` event listener for both notifications queues.
 *
 * Two responsibilities, both narrow:
 *  1. Detect **terminal** failures — when BullMQ exhausts a job's retry
 *     budget — and surface them so ops can alert (counter bump + ERROR log
 *     that calls out the templateKey, recipient, and exhausted attempt).
 *  2. Backstop the worker's in-loop `NotificationDelivery` upsert by writing
 *     a `failed` audit row when the job throws **before** the per-channel
 *     try/catch lands (e.g. catalog entry missing → `throw` before the loop
 *     runs). Without this, those failures only show up in BullMQ; not in
 *     the DB-queryable audit log.
 *
 * Uses BullMQ's `QueueEvents` (not `@nestjs/bullmq`'s `@OnWorkerEvent`)
 * because the latter binds to a single Processor; the dedicated
 * `QueueEvents` class is the canonical pattern for queue-wide observers.
 */
@Injectable()
export class NotificationsFailureListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsFailureListener.name)
  private readonly listeners: QueueEvents[] = []

  constructor(
    @InjectQueue(QUEUE_NAMES.Notifications) private readonly liveQueue: Queue<NotificationJobData>,
    @InjectQueue(QUEUE_NAMES.NotificationsScheduled)
    private readonly scheduledQueue: Queue<NotificationJobData>,
    private readonly prisma: PrismaService,
    private readonly metrics: NotificationsMetricsService
  ) {}

  onModuleInit(): void {
    this.attach(QUEUE_NAMES.Notifications, this.liveQueue)
    this.attach(QUEUE_NAMES.NotificationsScheduled, this.scheduledQueue)
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.listeners.map(l => l.close().catch(() => undefined)))
  }

  private attach(queueName: string, queue: Queue<NotificationJobData>): void {
    const opts = queue.opts as { connection?: unknown }
    const connection = opts.connection
    if (!connection) {
      this.logger.warn(
        `Cannot attach QueueEvents to ${queueName}: queue has no connection options — skipping`
      )
      return
    }
    const events = new QueueEvents(queueName, { connection: connection as never })
    events.on('failed', ({ jobId, failedReason }) => {
      void this.handleFailed(queueName, queue, jobId, failedReason)
    })
    this.listeners.push(events)
    this.logger.log(`Attached failed-event listener to ${queueName}`)
  }

  private async handleFailed(
    queueName: string,
    queue: Queue<NotificationJobData>,
    jobId: string,
    failedReason: string
  ): Promise<void> {
    try {
      const job = await queue.getJob(jobId)
      if (!job) return
      const attemptsMade = job.attemptsMade ?? 0
      const maxAttempts = (job.opts?.attempts as number | undefined) ?? 1
      const terminal = attemptsMade >= maxAttempts
      const data = job.data
      const payloadChannels = data?.channels ?? []
      // Bump the per-channel failure metrics. For a permanent failure we
      // mark every channel terminal so the counter matches the audit row.
      for (const channel of payloadChannels) {
        this.metrics.recordFailed(channel, terminal)
      }
      if (terminal) {
        this.logger.error(
          `[ctx tpl=${data?.type} user=${data?.recipientUserId} job=${jobId} chan=${payloadChannels.join(',')} attempt=${attemptsMade}] TERMINAL failure: ${failedReason}`
        )
        await this.recordTerminalDelivery(data, failedReason, attemptsMade)
      }
    } catch (err) {
      // Never let the listener crash the worker. Log + move on.
      this.logger.error(
        `Failure listener (${queueName}) threw while handling job ${jobId}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  /**
   * Defensive write of a `failed` NotificationDelivery row for catastrophic
   * paths that throw before the worker's in-loop catch can persist a row
   * (e.g. catalog entry missing — the worker throws before iterating
   * `channels`). Idempotent via the unique index; if the worker already
   * wrote a row, the upsert is a no-op update to the same status.
   */
  private async recordTerminalDelivery(
    data: NotificationJobData,
    failedReason: string,
    attemptsMade: number
  ): Promise<void> {
    if (!data?.channels?.length || !data.dedupeKey) return
    const sanitized = sanitizeErrorMessage(failedReason)
    await Promise.all(
      data.channels.map(channel =>
        this.prisma.notificationDelivery
          .upsert({
            where: {
              templateKey_channel_dedupeKey: {
                templateKey: data.type,
                channel,
                dedupeKey: data.dedupeKey,
              },
            },
            create: {
              templateKey: data.type,
              type: data.type,
              recipientUserId: data.recipientUserId,
              channel,
              dedupeKey: data.dedupeKey,
              status: 'failed',
              attempt: attemptsMade,
              errorMessage: sanitized,
            },
            update: {
              status: 'failed',
              attempt: attemptsMade,
              errorMessage: sanitized,
            },
          })
          .catch(err => {
            this.logger.error(
              `recordTerminalDelivery upsert failed for ${data.type}/${channel}: ${err instanceof Error ? err.message : String(err)}`
            )
          })
      )
    )
  }
}

/**
 * Single-line sanitisation: strip stack traces / multi-line provider
 * messages so the DB column doesn't leak secrets or unbounded text.
 * Phase 14c tightens this further in the worker's in-loop catch.
 */
function sanitizeErrorMessage(raw: string): string {
  return raw.split('\n')[0]?.slice(0, 500) ?? ''
}
