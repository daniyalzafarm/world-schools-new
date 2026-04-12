import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import Redis from 'ioredis'

/**
 * Centralised Redis connection manager for WebSocket infrastructure.
 *
 * Owns exactly TWO persistent Redis connections:
 *  - publisher  → used by Socket.io Redis adapter AND app-level pub/sub publish calls
 *  - subscriber → used by Socket.io Redis adapter AND app-level pub/sub subscribe calls
 *
 * All other services (GlobalWebSocketGateway, RedisPubSubService) inject this
 * service instead of creating their own ioredis clients.  This reduces the
 * per-instance connection count from 5 → 2 for WebSocket-related traffic.
 */
@Injectable()
export class WebSocketRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebSocketRedisService.name)

  private publisher: Redis | null = null
  private subscriber: Redis | null = null

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

    const retryStrategy = (label: string) => (times: number) => {
      const delay = Math.min(times * 50, 2000)
      this.logger.warn(`Redis WS ${label} retry #${times}, delay: ${delay}ms`)
      return delay
    }

    this.publisher = new Redis(redisUrl, {
      retryStrategy: retryStrategy('pub'),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    })

    this.subscriber = new Redis(redisUrl, {
      retryStrategy: retryStrategy('sub'),
      maxRetriesPerRequest: null, // Subscriber must never time out
      enableReadyCheck: true,
    })

    this.publisher.on('error', err => this.logger.error('WS Redis pub error:', err))
    this.subscriber.on('error', err => this.logger.error('WS Redis sub error:', err))

    this.publisher.on('connect', () => this.logger.log('WS Redis publisher connected'))
    this.subscriber.on('connect', () => this.logger.log('WS Redis subscriber connected'))

    this.logger.log('WebSocketRedisService initialised (2 dedicated connections)')
  }

  async onModuleDestroy() {
    this.logger.log('Closing WebSocket Redis connections...')
    await Promise.allSettled([this.publisher?.quit(), this.subscriber?.quit()])
    this.logger.log('WebSocket Redis connections closed')
  }

  getPublisher(): Redis {
    if (!this.publisher) throw new Error('WebSocketRedisService publisher not initialised')
    return this.publisher
  }

  getSubscriber(): Redis {
    if (!this.subscriber) throw new Error('WebSocketRedisService subscriber not initialised')
    return this.subscriber
  }

  /** Serialise and publish data to a Redis channel. Returns false on error. */
  async publishTo(channel: string, data: unknown): Promise<boolean> {
    if (!this.publisher) {
      this.logger.warn(`Cannot publish to ${channel}: publisher not ready`)
      return false
    }
    try {
      await this.publisher.publish(channel, JSON.stringify(data))
      return true
    } catch (err) {
      this.logger.error(`Failed to publish to ${channel}:`, err)
      return false
    }
  }
}
