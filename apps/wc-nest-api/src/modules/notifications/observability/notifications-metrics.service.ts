import { Injectable } from '@nestjs/common'
import type { NotificationChannel } from '../queue/queue.types'

/**
 * In-process metrics for the notifications subsystem.
 *
 * Deliberately lightweight — no Prometheus / StatsD dependency, just counters
 * + last-event timestamps held in memory. Exposed via
 * `/health/notifications` for ops dashboards + alerting; consumed by the
 * worker, dispatcher, crons, and the BullMQ failed-event listener to record
 * what's happening across the pipeline.
 *
 * Process-local — these counters reset on restart and are NOT aggregated
 * across multiple `wc-nest-api` instances. They're a triage signal ("is the
 * queue moving?", "are failures spiking?"), not a long-term metrics store.
 * When the org adopts Prometheus / OpenTelemetry, this service is the single
 * place to wire those exporters.
 */
@Injectable()
export class NotificationsMetricsService {
  /** Total enqueue calls (one per (recipient × channel) job). */
  private enqueuedTotal = 0
  /** Successful dispatches per channel. */
  private readonly sentByChannel: Record<NotificationChannel, number> = {
    in_app: 0,
    email: 0,
  }
  /** Transient (retry-able) failures per channel. */
  private readonly failedByChannel: Record<NotificationChannel, number> = {
    in_app: 0,
    email: 0,
  }
  /** Permanent failures (BullMQ retry budget exhausted) per channel. */
  private readonly terminalFailedByChannel: Record<NotificationChannel, number> = {
    in_app: 0,
    email: 0,
  }
  /** Channels skipped because the loader returned null OR the recipient had no email. */
  private readonly skippedByChannel: Record<NotificationChannel, number> = {
    in_app: 0,
    email: 0,
  }
  /** Dispatcher signal: resolver yielded zero recipients for a transactional
   * notification — always a bug, worth alerting on. */
  private zeroRecipientTransactional = 0
  /** Last-event timestamps for liveness checks. */
  private lastEnqueuedAt: string | null = null
  private lastSentAt: string | null = null
  private lastFailedAt: string | null = null
  /** Cron heartbeat — when each cron last completed successfully. */
  private readonly lastCronRunAt: Record<string, string> = {}

  recordEnqueued(channelCount: number): void {
    this.enqueuedTotal += channelCount
    this.lastEnqueuedAt = new Date().toISOString()
  }

  recordSent(channel: NotificationChannel): void {
    this.sentByChannel[channel] = (this.sentByChannel[channel] ?? 0) + 1
    this.lastSentAt = new Date().toISOString()
  }

  recordFailed(channel: NotificationChannel, terminal = false): void {
    this.failedByChannel[channel] = (this.failedByChannel[channel] ?? 0) + 1
    if (terminal) {
      this.terminalFailedByChannel[channel] = (this.terminalFailedByChannel[channel] ?? 0) + 1
    }
    this.lastFailedAt = new Date().toISOString()
  }

  recordSkipped(channel: NotificationChannel): void {
    this.skippedByChannel[channel] = (this.skippedByChannel[channel] ?? 0) + 1
  }

  recordZeroRecipientTransactional(): void {
    this.zeroRecipientTransactional += 1
  }

  recordCronRun(name: string): void {
    this.lastCronRunAt[name] = new Date().toISOString()
  }

  snapshot(): MetricsSnapshot {
    return {
      enqueuedTotal: this.enqueuedTotal,
      sent: { ...this.sentByChannel },
      failed: { ...this.failedByChannel },
      terminalFailed: { ...this.terminalFailedByChannel },
      skipped: { ...this.skippedByChannel },
      zeroRecipientTransactional: this.zeroRecipientTransactional,
      lastEnqueuedAt: this.lastEnqueuedAt,
      lastSentAt: this.lastSentAt,
      lastFailedAt: this.lastFailedAt,
      lastCronRunAt: { ...this.lastCronRunAt },
    }
  }
}

export interface MetricsSnapshot {
  enqueuedTotal: number
  sent: Record<NotificationChannel, number>
  failed: Record<NotificationChannel, number>
  terminalFailed: Record<NotificationChannel, number>
  skipped: Record<NotificationChannel, number>
  zeroRecipientTransactional: number
  lastEnqueuedAt: string | null
  lastSentAt: string | null
  lastFailedAt: string | null
  lastCronRunAt: Record<string, string>
}
