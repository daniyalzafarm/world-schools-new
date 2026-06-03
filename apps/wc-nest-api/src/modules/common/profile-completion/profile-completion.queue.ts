import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import IORedis, { type RedisOptions } from 'ioredis'

/**
 * Phase 14d — dedicated BullMQ queue for `ProfileCompletionService`
 * recompute jobs.
 *
 * Why a queue instead of synchronous calls: the recompute fires from ~8
 * domain endpoints (parent profile edit, photo upload, phone change,
 * provider company details, contact info, camp info, logo, camp publish,
 * Stripe onboarding). If a parent edits three fields in quick succession,
 * three concurrent recomputes race each other on the same parent row —
 * last-write-wins on the percentage, intermediate values can be wrong.
 *
 * The queue coalesces by `jobId: profile_<kind>_<id>`. BullMQ silently
 * rejects a duplicate jobId already in the queue, so a burst of recomputes
 * collapses to a single eventual job. The job itself reads fresh state and
 * writes the score; ordering is therefore "last enqueued, eventually
 * processed once."
 *
 * Same dedicated-Redis pattern as `notifications-queue.module.ts` —
 * BullMQ requires `maxRetriesPerRequest: null`; we open a separate ioredis
 * connection instead of mutating the global one.
 */
export const PROFILE_COMPLETION_QUEUE_NAME = 'profile-completion'
export const PROFILE_COMPLETION_JOB_NAME = 'recompute'

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
      name: PROFILE_COMPLETION_QUEUE_NAME,
      defaultJobOptions: {
        // Recompute is cheap (one SELECT + maybe one UPDATE). A single
        // retry on transient Prisma failure is enough; longer backoff is
        // wasteful because the next domain mutation will re-enqueue anyway.
        attempts: 2,
        backoff: { type: 'fixed', delay: 1_000 },
        removeOnComplete: { age: 3_600, count: 1_000 },
        removeOnFail: { age: 86_400, count: 500 },
      },
    }),
  ],
  exports: [BullModule],
})
export class ProfileCompletionQueueModule {}
