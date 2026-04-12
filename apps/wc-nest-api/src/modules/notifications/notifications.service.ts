import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/client/client'
import { PrismaService } from '../../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { WebSocketService } from '../websocket/websocket.service'
import { CreateNotificationDto } from './dto/create-notification.dto'
import { type WsNotificationPayload, WsServerEvent } from '@world-schools/wc-types'

const NOTIFICATIONS_PAGE_SIZE = 20
const UNREAD_COUNT_TTL = 60 // seconds

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly wsService: WebSocketService
  ) {}

  private unreadCountKey(userId: string): string {
    return `notifications:unread:${userId}`
  }

  /**
   * Create a notification, persist it to the DB, and deliver it immediately
   * via WebSocket if the user is connected.
   */
  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body ?? null,
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
    })

    // Real-time delivery — no-op if user is not currently connected
    const payload: WsNotificationPayload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body ?? undefined,
      entityType: notification.entityType ?? undefined,
      entityId: notification.entityId ?? undefined,
      metadata: (notification.metadata as Record<string, unknown>) ?? undefined,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    }

    this.wsService.emitToUser(dto.userId, WsServerEvent.NotificationNew, payload)
    this.logger.debug(`Notification ${notification.id} created and delivered to user ${dto.userId}`)

    // Increment cached unread count if the key already exists (avoids cold-setting an arbitrary value)
    const redis = this.redis.getClient()
    const cacheKey = this.unreadCountKey(dto.userId)
    const exists = await redis.exists(cacheKey)
    if (exists) await redis.incr(cacheKey)

    return notification
  }

  /**
   * Create the same notification for multiple recipients in a single DB round-trip,
   * then deliver to each connected user via WebSocket.
   *
   * One row per user is correct here — each recipient has independent read state.
   * A shared notification record with a junction table would require a JOIN on every
   * read-status query and makes "mark all as read" scoped to one user more complex.
   *
   * Uses createMany for efficiency (one INSERT instead of N), then delivers via
   * individual user rooms (each user only gets their own row's ID).
   */
  async createForMany(
    userIds: string[],
    dto: Omit<CreateNotificationDto, 'userId'>
  ): Promise<void> {
    if (userIds.length === 0) return

    const now = new Date()
    const rows = userIds.map(userId => ({
      userId,
      type: dto.type,
      title: dto.title,
      body: dto.body ?? null,
      entityType: dto.entityType ?? null,
      entityId: dto.entityId ?? null,
      metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      createdAt: now,
    }))

    // createMany does not return the created records in Prisma, so we batch-insert
    // and then fetch back the IDs to build the WebSocket payloads.
    await this.prisma.notification.createMany({ data: rows })

    // Fetch back the rows we just inserted (by userId + createdAt, bounded to this instant)
    const created = await this.prisma.notification.findMany({
      where: {
        userId: { in: userIds },
        type: dto.type,
        entityId: dto.entityId ?? null,
        createdAt: now,
      },
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        body: true,
        entityType: true,
        entityId: true,
        metadata: true,
        isRead: true,
        createdAt: true,
      },
    })

    // Deliver each row to its recipient via their user room
    for (const notification of created) {
      const wsPayload: WsNotificationPayload = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body ?? undefined,
        entityType: notification.entityType ?? undefined,
        entityId: notification.entityId ?? undefined,
        metadata: (notification.metadata as Record<string, unknown>) ?? undefined,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString(),
      }
      this.wsService.emitToUser(notification.userId, WsServerEvent.NotificationNew, wsPayload)
    }

    this.logger.debug(
      `Bulk notification "${dto.title}" created for ${userIds.length} users (${dto.type})`
    )

    // Increment cached unread count for each recipient that already has a cached value
    const redis = this.redis.getClient()
    await Promise.all(
      userIds.map(async uid => {
        const key = this.unreadCountKey(uid)
        const exists = await redis.exists(key)
        if (exists) await redis.incr(key)
      })
    )
  }

  /**
   * Mark a single notification as read.
   * Validates ownership so users can only mark their own notifications.
   */
  async markAsRead(notificationId: string, userId: string) {
    const existing = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, userId: true, isRead: true },
    })

    if (!existing) throw new NotFoundException('Notification not found')
    if (existing.userId !== userId) throw new NotFoundException('Notification not found')
    if (existing.isRead) return // Already read — idempotent

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    })

    // Invalidate cached count — simpler than a DECR since we don't want to go negative
    await this.redis.del(this.unreadCountKey(userId))
  }

  /**
   * Mark all unread notifications for a user as read in a single DB update.
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })

    // Invalidate cached count
    await this.redis.del(this.unreadCountKey(userId))
  }

  /**
   * Get all unread notifications for a user (no pagination — badge count use case).
   */
  async getUnread(userId: string) {
    return await this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get paginated notifications for a user (cursor-based, newest first).
   */
  async getAll(userId: string, cursor?: string) {
    const items = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: NOTIFICATIONS_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = items.length > NOTIFICATIONS_PAGE_SIZE
    const data = hasMore ? items.slice(0, NOTIFICATIONS_PAGE_SIZE) : items
    const nextCursor = hasMore ? data[data.length - 1]?.id : null

    return { data, nextCursor, hasMore }
  }

  /**
   * Get count of unread notifications (for badge display).
   * Cached in Redis for 60 s to avoid a DB hit on every page load/render.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = this.unreadCountKey(userId)
    const cached = await this.redis.get(cacheKey)
    if (cached !== null) return parseInt(cached, 10)

    const count = await this.prisma.notification.count({ where: { userId, isRead: false } })
    await this.redis.setex(cacheKey, UNREAD_COUNT_TTL, String(count))
    return count
  }

  /**
   * Get all notifications related to a specific entity (e.g. all for a booking).
   */
  async getByEntity(userId: string, entityType: string, entityId: string) {
    return await this.prisma.notification.findMany({
      where: { userId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Mark all notifications for a given entity as read.
   * Useful when user navigates to the booking/conversation detail page.
   */
  async markEntityRead(userId: string, entityType: string, entityId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, entityType, entityId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })

    // Invalidate cached count
    await this.redis.del(this.unreadCountKey(userId))
  }
}
