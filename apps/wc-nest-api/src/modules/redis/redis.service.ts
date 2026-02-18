import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '../../config/config.service'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client: Redis
  private isConnected = false

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      // Get Redis URL from environment or use default
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

      this.logger.log(`Connecting to Redis: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`)

      this.client = new Redis(redisUrl, {
        retryStrategy: times => {
          const delay = Math.min(times * 50, 2000)
          this.logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`)
          return delay
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      })

      this.client.on('connect', () => {
        this.logger.log('Redis client connected')
        this.isConnected = true
      })

      this.client.on('ready', () => {
        this.logger.log('Redis client ready')
      })

      this.client.on('error', err => {
        this.logger.error('Redis client error:', err)
        this.isConnected = false
      })

      this.client.on('close', () => {
        this.logger.warn('Redis connection closed')
        this.isConnected = false
      })

      this.client.on('reconnecting', () => {
        this.logger.log('Redis client reconnecting...')
      })

      // Wait for connection
      await this.client.ping()
      this.logger.log('✅ Redis connection successful')
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error)
      // Don't throw error - allow app to start without Redis
      // Services should handle Redis unavailability gracefully
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit()
      this.logger.log('Redis connection closed')
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client.status === 'ready'
  }

  /**
   * Get value from Redis
   */
  async get(key: string): Promise<string | null> {
    if (!this.isReady()) {
      this.logger.warn('Redis not ready, skipping GET operation')
      return null
    }
    try {
      return await this.client.get(key)
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}:`, error)
      return null
    }
  }

  /**
   * Set value in Redis with optional TTL
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isReady()) {
      this.logger.warn('Redis not ready, skipping SET operation')
      return false
    }
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value)
      } else {
        await this.client.set(key, value)
      }
      return true
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}:`, error)
      return false
    }
  }

  /**
   * Set value with expiration (alias for set with TTL)
   */
  async setex(key: string, seconds: number, value: string): Promise<boolean> {
    return this.set(key, value, seconds)
  }

  /**
   * Delete key from Redis
   */
  async del(key: string): Promise<boolean> {
    if (!this.isReady()) {
      this.logger.warn('Redis not ready, skipping DEL operation')
      return false
    }
    try {
      await this.client.del(key)
      return true
    } catch (error) {
      this.logger.error(`Redis DEL error for key ${key}:`, error)
      return false
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false
    }
    try {
      const result = await this.client.exists(key)
      return result === 1
    } catch (error) {
      this.logger.error(`Redis EXISTS error for key ${key}:`, error)
      return false
    }
  }

  /**
   * Get Redis client for advanced operations
   */
  getClient(): Redis {
    return this.client
  }
}
