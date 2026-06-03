import { InjectQueue } from '@nestjs/bullmq'
import { Controller, Get, Logger } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Queue } from 'bullmq'
import { Public } from '../../core/auth/decorators/public.decorator'
import { QUEUE_NAMES } from '../queue/queue.constants'
import type { NotificationJobData } from '../queue/queue.types'
import { type MetricsSnapshot, NotificationsMetricsService } from './notifications-metrics.service'

interface QueueDepth {
  waiting: number
  active: number
  delayed: number
  failed: number
  completed: number
}

export interface NotificationsHealthResponse {
  status: 'ok' | 'degraded'
  timestamp: string
  queues: {
    live: QueueDepth | { error: string }
    scheduled: QueueDepth | { error: string }
  }
  metrics: MetricsSnapshot
}

/**
 * Ops dashboard at `GET /health/notifications`. Surfaces live + scheduled
 * queue depths from BullMQ plus the in-memory metrics counters. Marked
 * `@Public()` to match the existing `/health` endpoint convention; the data
 * is non-sensitive (job counts + counters, no PII).
 *
 * Returns `status: 'degraded'` when BullMQ's `getJobCounts` throws on either
 * queue (Redis unreachable / connection churn) so monitoring can alert on it.
 */
@ApiTags('Health')
@Controller('health/notifications')
export class NotificationsHealthController {
  private readonly logger = new Logger(NotificationsHealthController.name)

  constructor(
    @InjectQueue(QUEUE_NAMES.Notifications) private readonly liveQueue: Queue<NotificationJobData>,
    @InjectQueue(QUEUE_NAMES.NotificationsScheduled)
    private readonly scheduledQueue: Queue<NotificationJobData>,
    private readonly metrics: NotificationsMetricsService
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Notification queue + metrics health check' })
  @ApiResponse({ status: 200, description: 'Queue depths + in-process metrics counters' })
  async check(): Promise<NotificationsHealthResponse> {
    const [live, scheduled] = await Promise.all([
      this.readQueueDepth(this.liveQueue, 'live'),
      this.readQueueDepth(this.scheduledQueue, 'scheduled'),
    ])
    const degraded = 'error' in live || 'error' in scheduled
    return {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      queues: { live, scheduled },
      metrics: this.metrics.snapshot(),
    }
  }

  private async readQueueDepth(
    queue: Queue<NotificationJobData>,
    label: string
  ): Promise<QueueDepth | { error: string }> {
    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed')
      return {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        completed: counts.completed ?? 0,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`getJobCounts(${label}) failed: ${message}`)
      return { error: message }
    }
  }
}
