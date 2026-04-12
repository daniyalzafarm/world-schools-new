import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../prisma/prisma.service'
import { WebSocketService } from '../websocket/websocket.service'
import { NotificationsService } from '../notifications/notifications.service'
import {
  NotificationEntityType,
  NotificationType,
  type WsBookingRequestReceivedPayload,
  type WsBookingStatusPayload,
  WsServerEvent,
} from '@world-schools/wc-types'
import { WsInternalEvent } from '../websocket/ws-internal-events'

/**
 * Handles real-time WebSocket delivery for booking lifecycle events.
 *
 * Listens to EventEmitter2 events emitted by BookingGroupsService
 * and delivers them to the relevant users via their WebSocket rooms:
 *  - Parent user: notified when their booking is accepted or declined
 *  - Provider users: notified when a new booking request arrives
 *
 * Uses the same EventEmitter2 decoupling pattern as MessagingWebSocketHandler.
 */
@Injectable()
export class BookingWebSocketHandler {
  private readonly logger = new Logger(BookingWebSocketHandler.name)

  constructor(
    private readonly wsService: WebSocketService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  /**
   * Booking status changed (accepted / declined).
   * Notifies:
   *  - The parent (booker) via their user room
   *  - All provider staff users via their individual user rooms
   */
  @OnEvent(WsInternalEvent.BookingStatusChanged)
  async handleBookingStatusChanged(payload: WsBookingStatusPayload) {
    try {
      // Notify parent
      this.wsService.emitToUser(payload.parentUserId, WsServerEvent.BookingStatusChanged, payload)

      // Notify provider staff
      const providerUserIds = await this.getProviderUserIds(payload.providerId)
      for (const userId of providerUserIds) {
        if (userId !== payload.parentUserId) {
          this.wsService.emitToUser(userId, WsServerEvent.BookingStatusChanged, payload)
        }
      }

      // Persist notifications so offline users don't miss the event.
      // One row per user is created — each recipient has independent read state.
      const notificationType =
        payload.newStatus === 'accepted'
          ? NotificationType.BookingAccepted
          : NotificationType.BookingDeclined

      const notificationBase = {
        type: notificationType,
        entityType: NotificationEntityType.BookingGroup,
        entityId: payload.bookingGroupId,
        metadata: {
          bookingGroupNumber: payload.bookingGroupNumber,
          campName: payload.campName,
        },
      }

      await Promise.allSettled([
        // Parent: actionable message directing them to next step
        this.notificationsService.create({
          userId: payload.parentUserId,
          ...notificationBase,
          title:
            payload.newStatus === 'accepted'
              ? `Booking accepted — ${payload.campName}`
              : `Booking declined — ${payload.campName}`,
          body:
            payload.newStatus === 'accepted'
              ? 'Your booking request has been accepted. Proceed to payment to confirm your spot.'
              : 'Your booking request was declined. You can browse other camps or contact the provider.',
          metadata: {
            ...notificationBase.metadata,
            redirectUrl: `/bookings/${payload.bookingGroupId}`,
          },
        }),

        // Provider staff: one INSERT per staff member via createForMany
        this.notificationsService.createForMany(
          providerUserIds.filter(id => id !== payload.parentUserId),
          {
            ...notificationBase,
            title:
              payload.newStatus === 'accepted'
                ? `You accepted booking ${payload.bookingGroupNumber}`
                : `You declined booking ${payload.bookingGroupNumber}`,
            body: `Camp: ${payload.campName}`,
            metadata: {
              ...notificationBase.metadata,
              redirectUrl: `/provider/bookings/${payload.bookingGroupId}`,
            },
          }
        ),
      ])

      this.logger.log(
        `[Booking] status_changed ${payload.bookingGroupNumber} → ${payload.newStatus} ` +
          `delivered to parent ${payload.parentUserId} + ${providerUserIds.length} provider users`
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to deliver booking:status_changed: ${msg}`)
    }
  }

  /**
   * New booking request submitted by a parent.
   * Notifies all provider staff so they can review and respond.
   */
  @OnEvent(WsInternalEvent.BookingRequestSubmitted)
  async handleBookingRequestSubmitted(payload: WsBookingRequestReceivedPayload) {
    try {
      const providerUserIds = await this.getProviderUserIds(payload.providerId)

      // Real-time delivery to connected provider staff
      for (const userId of providerUserIds) {
        this.wsService.emitToUser(userId, WsServerEvent.BookingRequestReceived, payload)
      }

      // Persistent notification — one row per provider staff member via createForMany
      await this.notificationsService
        .createForMany(providerUserIds, {
          type: NotificationType.BookingRequestReceived,
          title: `New booking request — ${payload.campName}`,
          body: `Booking ${payload.bookingGroupNumber} requires your response.`,
          entityType: NotificationEntityType.BookingGroup,
          entityId: payload.bookingGroupId,
          metadata: {
            redirectUrl: `/provider/bookings/${payload.bookingGroupId}`,
            bookingGroupNumber: payload.bookingGroupNumber,
            campName: payload.campName,
            requestExpiresAt: payload.requestExpiresAt,
          },
        })
        .catch(err => this.logger.error('Failed to create booking request notifications:', err))

      this.logger.log(
        `[Booking] request_received ${payload.bookingGroupNumber} ` +
          `delivered to ${providerUserIds.length} provider users`
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to deliver booking:request_received: ${msg}`)
    }
  }

  /**
   * Returns all user IDs associated with a provider (staff + owner).
   * Mirrors the logic in RedisPubSubService.getProviderUsers() to avoid
   * a cross-module dependency. Can be extracted to a shared util if a
   * third consumer appears.
   */
  private async getProviderUserIds(providerId: string): Promise<string[]> {
    const [users, provider] = await Promise.all([
      this.prisma.user.findMany({
        where: { roles: { some: { role: { providerId } } } },
        select: { id: true },
      }),
      this.prisma.provider.findUnique({
        where: { id: providerId },
        select: { ownerId: true },
      }),
    ])

    const ids = new Set(users.map(u => u.id))
    if (provider?.ownerId) ids.add(provider.ownerId)
    return Array.from(ids)
  }
}
