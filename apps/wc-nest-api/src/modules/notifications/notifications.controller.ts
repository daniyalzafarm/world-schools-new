import { Controller, Get, Logger, Param, Patch, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../core/auth/decorators/current-user.decorator'
import { NotificationsService } from './notifications.service'

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name)

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
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
   * GET /notifications/unread-count
   * Lightweight endpoint for badge counts — returns a single integer.
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId)
    return { count }
  }

  /**
   * PATCH /notifications/read-all
   * Mark every unread notification as read in a single bulk update.
   */
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationsService.markAllAsRead(userId)
    return { success: true }
  }

  /**
   * PATCH /notifications/:id/read
   * Mark a single notification as read. Validates ownership.
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.notificationsService.markAsRead(id, userId)
    return { success: true }
  }

  /**
   * PATCH /notifications/entity/:entityType/:entityId/read
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
