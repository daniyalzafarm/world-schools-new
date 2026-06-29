import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../prisma/prisma.service'
import { WebSocketService } from '../websocket/websocket.service'
import {
  type WsBookingRequestReceivedPayload,
  type WsBookingStatusPayload,
  WsServerEvent,
} from '@world-schools/wc-types'
import { WsInternalEvent } from '../websocket/ws-internal-events'

/**
 * Live WebSocket fan-out for booking lifecycle events.
 *
 * Persistent in-app notification creation and
 * email dispatch moved out of this handler into the catalog dispatcher
 * (see `BookingGroupsService.acceptForProvider` / `declineForProvider` /
 * booking-submit, which call `notify(...)`). This handler is now ONLY
 * responsible for pushing the live UI nudge — the badge bump, the toast,
 * the inbox reorder. Anything that needs to survive a reload is owned by
 * the catalog worker writing to `notifications` + `notification_deliveries`.
 *
 * The recipient lookup (parent + all provider users) is still needed for
 * routing the WS broadcast — that's the only reason `PrismaService` stays
 * injected here.
 */
@Injectable()
export class BookingWebSocketHandler {
  private readonly logger = new Logger(BookingWebSocketHandler.name)

  constructor(
    private readonly wsService: WebSocketService,
    private readonly prisma: PrismaService
  ) {}

  @OnEvent(WsInternalEvent.BookingStatusChanged)
  async handleBookingStatusChanged(payload: WsBookingStatusPayload) {
    try {
      this.wsService.emitToUser(payload.parentUserId, WsServerEvent.BookingStatusChanged, payload)

      const providerUserIds = await this.getProviderUserIds(payload.providerId)
      for (const userId of providerUserIds) {
        if (userId !== payload.parentUserId) {
          this.wsService.emitToUser(userId, WsServerEvent.BookingStatusChanged, payload)
        }
      }

      this.logger.log(
        `[Booking] status_changed ${payload.bookingGroupNumber} → ${payload.newStatus} ` +
          `live-delivered to parent ${payload.parentUserId} + ${providerUserIds.length} provider users`
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to deliver booking:status_changed: ${msg}`)
    }
  }

  @OnEvent(WsInternalEvent.BookingRequestSubmitted)
  async handleBookingRequestSubmitted(payload: WsBookingRequestReceivedPayload) {
    try {
      const providerUserIds = await this.getProviderUserIds(payload.providerId)
      for (const userId of providerUserIds) {
        this.wsService.emitToUser(userId, WsServerEvent.BookingRequestReceived, payload)
      }
      this.logger.log(
        `[Booking] request_received ${payload.bookingGroupNumber} ` +
          `live-delivered to ${providerUserIds.length} provider users`
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to deliver booking:request_received: ${msg}`)
    }
  }

  /**
   * All user IDs associated with a provider (staff + owner). Identical to
   * the `allProviderUsers` recipient resolver — kept here so the WS fan-out
   * doesn't depend on the notifications module's internals. If a third
   * consumer of this lookup appears, extract to a shared util.
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
