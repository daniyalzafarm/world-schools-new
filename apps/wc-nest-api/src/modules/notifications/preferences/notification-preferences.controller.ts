import { Body, Controller, Get, HttpException, HttpStatus, Logger, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  registerDecorator,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator'
import { Type } from 'class-transformer'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { RedisService } from '../../redis/redis.service'
import { listCatalogEntries } from '../catalog/notification-catalog'
import { NotificationPreferencesService } from './notification-preferences.service'

/**
 * Class-validator decorator that asserts a string is a registered
 * `templateKey` in the catalog. Replaces the previous `@IsString()` which
 * silently accepted arbitrary strings and let the service-side filter drop
 * them with no client feedback. Phase 14c — now returns 400 with a clear
 * message so the frontend can surface "stale catalog, please reload" if a
 * user toggles a removed entry.
 *
 * The allowed-set is computed once on first validation call (catalog is
 * static after module init) — no per-request grep.
 */
let CACHED_TEMPLATE_KEYS: Set<string> | null = null
function getAllowedTemplateKeys(): Set<string> {
  CACHED_TEMPLATE_KEYS ??= new Set(listCatalogEntries().map(e => e.templateKey))
  return CACHED_TEMPLATE_KEYS
}
function IsCatalogTemplateKey(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCatalogTemplateKey',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && getAllowedTemplateKeys().has(value),
        defaultMessage: () => 'templateKey is not a registered notification catalog entry',
      },
    })
  }
}

/** Exported for unit tests of the catalog-key allow-list validator. */
export class BulkPreferenceItemDto {
  @IsString()
  @IsCatalogTemplateKey()
  templateKey!: string

  @IsIn(['in_app', 'email'])
  channel!: 'in_app' | 'email'

  @IsBoolean()
  enabled!: boolean
}

/** Exported alongside the item DTO for test compositions. */
export class BulkUpdatePreferencesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkPreferenceItemDto)
  items!: BulkPreferenceItemDto[]
}

/** Exported for tests to invalidate the cached allow-list between runs. */
export function _resetTemplateKeyCacheForTests(): void {
  CACHED_TEMPLATE_KEYS = null
}

/**
 * Phase 12 — Notification preferences controller.
 *
 * Single endpoint pair, audience derived from the authenticated user:
 *  - GET  /notification-preferences   → flat list of (templateKey, channel)
 *                                       rows for the user's audience, with
 *                                       transactional entries locked.
 *  - PATCH /notification-preferences  → bulk-upsert opt-outs / opt-ins.
 *
 * Phase 14c — PATCH is rate-limited per-user via Redis (30 requests / 60s)
 * and templateKey is allow-listed against the live catalog so garbage
 * input is rejected with 400 instead of silently dropped server-side.
 */
/**
 * Shared base for the app-specific notification-preferences controllers.
 * Subclasses add `@Controller('<app>/notification-preferences')` + `@ApiTags`.
 * App-prefixed (rather than a shared `/notification-preferences` route) for the
 * same cookie-scoping reason as the notification list controllers — see
 * `BaseNotificationsController`.
 */
@ApiBearerAuth()
export abstract class BaseNotificationPreferencesController {
  private readonly logger = new Logger(BaseNotificationPreferencesController.name)

  constructor(
    protected readonly service: NotificationPreferencesService,
    protected readonly redis: RedisService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notification preferences for current user' })
  async list(@CurrentUser('id') userId: string) {
    const items = await this.service.listForUser(userId)
    return { items }
  }

  @Patch()
  @ApiOperation({ summary: 'Bulk-upsert notification preferences for current user' })
  async update(@CurrentUser('id') userId: string, @Body() dto: BulkUpdatePreferencesDto) {
    await this.assertRateLimit(userId)
    const updated = await this.service.bulkSetPreferences(userId, dto.items)
    return { success: true, updated }
  }

  /**
   * 30 PATCH requests per 60s per user. Implemented as `INCR + EXPIRE` on
   * a Redis key; distributed across multiple wc-nest-api instances. Soft-fails
   * to "allow" if Redis is unreachable (we'd rather serve traffic than
   * 503 a settings page); when Redis is healthy, the limit is enforced.
   */
  private async assertRateLimit(userId: string): Promise<void> {
    if (!this.redis.isReady()) return
    const key = `rate:notif-prefs:${userId}`
    try {
      const client = this.redis.getClient()
      const results = await client.multi().incr(key).expire(key, 60).exec()
      const incrResult = results?.[0]
      const count = Array.isArray(incrResult) ? Number(incrResult[1]) : 0
      if (count > 30) {
        throw new HttpException(
          'Too many preference updates — please wait a minute',
          HttpStatus.TOO_MANY_REQUESTS
        )
      }
    } catch (err) {
      if (err instanceof HttpException) throw err
      // Redis throw: log + allow. Don't fail the user's save because the
      // limiter is down.
      this.logger.warn(
        `Rate-limit check failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }
}

@ApiTags('User Notification Preferences')
@Controller('user/notification-preferences')
export class UserNotificationPreferencesController extends BaseNotificationPreferencesController {
  constructor(service: NotificationPreferencesService, redis: RedisService) {
    super(service, redis)
  }
}

@ApiTags('Provider Notification Preferences')
@Controller('provider/notification-preferences')
export class ProviderNotificationPreferencesController extends BaseNotificationPreferencesController {
  constructor(service: NotificationPreferencesService, redis: RedisService) {
    super(service, redis)
  }
}

@ApiTags('Superadmin Notification Preferences')
@Controller('superadmin/notification-preferences')
export class SuperadminNotificationPreferencesController extends BaseNotificationPreferencesController {
  constructor(service: NotificationPreferencesService, redis: RedisService) {
    super(service, redis)
  }
}
