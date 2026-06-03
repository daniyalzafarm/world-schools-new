import { Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../core/auth/decorators/current-user.decorator'
import { NotificationsService } from './notifications.service'

/**
 * Shared base for the app-specific notification controllers (user, provider,
 * superadmin). Subclasses only add `@Controller('<app>/notifications')` and
 * `@ApiTags(...)`; every handler is identical and scoped to the authenticated
 * user via `@CurrentUser('id')`.
 *
 * Why per-app prefixes instead of one shared `/notifications` route: cookies
 * are scoped by host (not port), so on localhost the parent/provider/superadmin
 * apps share one cookie jar. The JWT strategy only reads the *correct*
 * app-specific cookie (and enforces the `payload.app` claim) for app-prefixed
 * paths; a shared route falls back to "wc_user_access_token first", which makes
 * every app resolve to the parent user. App-prefixing fixes that for both
 * localhost and a dual-role user in production. Mirrors the messaging module's
 * `BaseAppMessagesController` → `user/`/`provider/` split.
 */
@ApiBearerAuth()
export abstract class BaseNotificationsController {
  constructor(protected readonly notificationsService: NotificationsService) {}

  /**
   * GET /<app>/notifications
   * Paginated list of all notifications for the authenticated user.
   * Pass ?unread=true to filter unread only.
   * Pass ?cursor=<id> for subsequent pages.
   */
  @Get()
  @ApiOperation({ summary: 'List notifications' })
  @ApiQuery({ name: 'unread', required: false, type: Boolean })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query('unread') unread?: string,
    @Query('cursor') cursor?: string
  ) {
    if (unread === 'true') {
      const data = await this.notificationsService.getUnread(userId)
      return { data, hasMore: false, nextCursor: null }
    }
    return this.notificationsService.getAll(userId, cursor)
  }

  /**
   * GET /<app>/notifications/unread-count
   * Lightweight endpoint for badge counts — returns a single integer.
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId)
    return { count }
  }

  /**
   * PATCH /<app>/notifications/read-all
   * Mark every unread notification as read in a single bulk update.
   */
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationsService.markAllAsRead(userId)
    return { success: true }
  }

  /**
   * PATCH /<app>/notifications/:id/read
   * Mark a single notification as read. Validates ownership.
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.notificationsService.markAsRead(id, userId)
    return { success: true }
  }

  /**
   * PATCH /<app>/notifications/entity/:entityType/:entityId/read
   * Mark all notifications related to a specific entity as read.
   * Useful when a user navigates to a booking or conversation detail page.
   */
  @Patch('entity/:entityType/:entityId/read')
  @ApiOperation({ summary: 'Mark all notifications for an entity as read' })
  async markEntityRead(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @CurrentUser('id') userId: string
  ) {
    await this.notificationsService.markEntityRead(userId, entityType, entityId)
    return { success: true }
  }
}

@ApiTags('User Notifications')
@Controller('user/notifications')
export class UserNotificationsController extends BaseNotificationsController {
  constructor(notificationsService: NotificationsService) {
    super(notificationsService)
  }
}

@ApiTags('Provider Notifications')
@Controller('provider/notifications')
export class ProviderNotificationsController extends BaseNotificationsController {
  constructor(notificationsService: NotificationsService) {
    super(notificationsService)
  }
}

@ApiTags('Superadmin Notifications')
@Controller('superadmin/notifications')
export class SuperadminNotificationsController extends BaseNotificationsController {
  constructor(notificationsService: NotificationsService) {
    super(notificationsService)
  }
}
