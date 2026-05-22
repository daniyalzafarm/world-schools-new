import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../../redis/redis.service'

/**
 * Read-through Redis cache helper for dashboard endpoints. When Redis is
 * unavailable (RedisService.isReady() returns false), it transparently falls
 * back to executing the compute function — dashboards stay live even if cache
 * is down, they just lose acceleration.
 */
@Injectable()
export class DashboardCacheService {
  private readonly logger = new Logger(DashboardCacheService.name)

  constructor(private readonly redis: RedisService) {}

  async withCache<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(key)
    if (cached) {
      try {
        return JSON.parse(cached) as T
      } catch (error) {
        this.logger.warn(`Failed to parse cache for ${key}, recomputing`, error as Error)
      }
    }

    const value = await compute()
    await this.redis.set(key, JSON.stringify(value), ttlSeconds)
    return value
  }

  buildKey(
    scope: 'analytics' | 'financial',
    endpoint: string,
    params: Record<string, unknown>
  ): string {
    const serialized = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${String(v)}`)
      .join('&')
    return `dashboard:${scope}:${endpoint}:${serialized}`
  }
}
