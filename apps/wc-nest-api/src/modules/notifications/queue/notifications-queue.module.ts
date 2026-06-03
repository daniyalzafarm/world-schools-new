import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import IORedis, { type RedisOptions } from 'ioredis'
import { NotificationsMetricsService } from '../observability/notifications-metrics.service'
import { QUEUE_NAMES } from './queue.constants'
import { NotificationsEnqueueService } from './enqueue.service'
import { NotificationsCancelService } from './cancel.service'

/**
 * BullMQ connection token + factory.
 *
 * BullMQ requires `maxRetriesPerRequest: null` on its ioredis connection
 * (otherwise long-blocking commands like BRPOPLPUSH throw). The shared
 * `RedisService` keeps `maxRetriesPerRequest: 3` for cache use, so we open
 * a dedicated connection here instead of mutating global Redis semantics.
 */
export const NOTIFICATIONS_REDIS_CONNECTION = Symbol('NOTIFICATIONS_REDIS_CONNECTION')

function buildConnection(): IORedis {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  }
  return new IORedis(url, options)
}

/**
 * NotificationsQueueModule
 *
 * Owns two BullMQ queues (`notifications`, `notifications.scheduled`) and
 * the enqueue/cancel façades used by the dispatcher. The worker that
 * processes jobs lives in `notifications/workers/notification.worker.ts`
 * and is registered separately so this module can be imported without
 * also booting the worker (useful in test contexts).
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: buildConnection(),
      }),
    }),
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.Notifications,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: { age: 86_400, count: 5_000 },
          removeOnFail: false,
        },
      },
      {
        name: QUEUE_NAMES.NotificationsScheduled,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: { age: 86_400, count: 5_000 },
          removeOnFail: false,
        },
      }
    ),
  ],
  providers: [NotificationsEnqueueService, NotificationsCancelService, NotificationsMetricsService],
  exports: [
    BullModule,
    NotificationsEnqueueService,
    NotificationsCancelService,
    NotificationsMetricsService,
  ],
})
export class NotificationsQueueModule {}
