import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common'
import { RedisService } from '../../redis/redis.service'

/**
 * Rate Limiting Guard for Message Sending
 *
 * Prevents spam and flooding by limiting the number of messages a user can send
 * within a specific time window using Redis-based rate limiting.
 *
 * Default limits:
 * - 60 messages per minute (sliding window)
 * - Returns HTTP 429 (Too Many Requests) when limit is exceeded
 *
 * Redis key pattern: `rate-limit:messages:${userId}`
 *
 * @example
 * ```typescript
 * @UseGuards(RateLimitGuard)
 * @Post()
 * async sendMessage(@Body() dto: SendMessageDto) {
 *   // This endpoint is rate-limited
 * }
 * ```
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name)
  private readonly MAX_MESSAGES_PER_MINUTE = 60
  private readonly WINDOW_SECONDS = 60

  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user?.id) {
      // If no user is authenticated, let the JWT guard handle it
      return true
    }

    const userId = user.id
    const key = `rate-limit:messages:${userId}`

    try {
      const redis = this.redisService.getClient()

      // Increment the counter for this user
      const count = await redis.incr(key)

      // Set expiry on first request in the window
      if (count === 1) {
        await redis.expire(key, this.WINDOW_SECONDS)
      }

      // Check if limit exceeded
      if (count > this.MAX_MESSAGES_PER_MINUTE) {
        this.logger.warn(
          `Rate limit exceeded for user ${userId}: ${count} messages in ${this.WINDOW_SECONDS}s window`
        )

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Rate limit exceeded. You can send up to ${this.MAX_MESSAGES_PER_MINUTE} messages per minute. Please slow down.`,
            error: 'Too Many Requests',
            retryAfter: this.WINDOW_SECONDS,
          },
          HttpStatus.TOO_MANY_REQUESTS
        )
      }

      // Log when approaching limit (80% threshold)
      const threshold = Math.floor(this.MAX_MESSAGES_PER_MINUTE * 0.8)
      if (count === threshold) {
        this.logger.log(
          `User ${userId} approaching rate limit: ${count}/${this.MAX_MESSAGES_PER_MINUTE} messages`
        )
      }

      return true
    } catch (error) {
      // If it's our rate limit exception, re-throw it
      if (error instanceof HttpException) {
        throw error
      }

      // For Redis errors, log and allow the request (fail open)
      this.logger.error(`Rate limit check failed for user ${userId}:`, error)
      return true
    }
  }
}
