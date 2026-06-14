import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import IORedis, { type RedisOptions } from 'ioredis'

/**
 * Dedicated BullMQ queue for scheduled capture firing (Payments revamp, Spec
 * v2.3). A delayed job is enqueued per `booking_scheduled_captures` row at
 * provider acceptance with `delay = effectiveCaptureDate - now`; the job fires
 * once at the boundary and asks the capture engine to execute that capture.
 *
 * Deterministic `jobId: capture_<bookingGroupId>_<sequence>` (one per capture
 * row, matching the `@@unique([bookingGroupId, sequence])` anchor) so the job is
 * addressable for removal on cancellation, and a duplicate enqueue collapses.
 *
 * Correctness is owned by the engine's status-guarded claim + the Stripe
 * idempotency key, NOT by BullMQ retries — so `attempts: 1`. The hourly
 * reconciliation cron is the recovery path for a lost/never-fired job.
 *
 * Same dedicated-Redis pattern as `profile-completion.queue.ts` /
 * `notifications-queue.module.ts` (BullMQ requires `maxRetriesPerRequest: null`).
 */
export const SCHEDULED_CAPTURES_QUEUE_NAME = 'scheduled-captures'
export const SCHEDULED_CAPTURE_JOB_NAME = 'fire-capture'

function buildConnection(): IORedis {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  }
  return new IORedis(url, options)
}

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({ connection: buildConnection() }),
    }),
    BullModule.registerQueue({
      name: SCHEDULED_CAPTURES_QUEUE_NAME,
      defaultJobOptions: {
        // Idempotency (unique row claim + Stripe key) owns correctness; the
        // reconciliation cron recovers anything the job misses. So a single
        // attempt — no BullMQ-level retry storms against Stripe.
        attempts: 1,
        removeOnComplete: { age: 604_800, count: 5_000 }, // keep 7d for debugging
        removeOnFail: false,
      },
    }),
  ],
  exports: [BullModule],
})
export class ScheduledCapturesQueueModule {}
