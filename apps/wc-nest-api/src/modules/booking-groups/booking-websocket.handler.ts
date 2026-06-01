import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../prisma/prisma.service'
import { WebSocketService } from '../websocket/websocket.service'
import { NotificationsService } from '../notifications/notifications.service'
import { BookingNotificationService } from '../common/email-templates/booking-notification.service'
import {
  BOOKING_DECLINE_REASON_LABELS,
  BookingDeclineReason,
  NotificationEntityType,
  NotificationType,
  type WsBookingRequestReceivedPayload,
  type WsBookingStatusPayload,
  WsServerEvent,
} from '@world-schools/wc-types'
import { formatCurrency } from '@world-schools/wc-utils'
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
    private readonly notificationsService: NotificationsService,
    private readonly bookingNotificationService: BookingNotificationService
  ) {}

  /**
   * Booking status changed (accepted / declined).
   * Notifies:
   *  - The parent (booker) via their user room
   *  - All provider staff users via their individual user rooms
   *  - The parent again via email (best-effort)
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

      const isAccepted = payload.newStatus === 'accepted'
      const isDeclined = payload.newStatus === 'declined'
      const notificationType = isAccepted
        ? NotificationType.BookingAccepted
        : NotificationType.BookingDeclined

      const chargedAmountFormatted =
        isAccepted && payload.chargedAmount != null
          ? formatCurrency(payload.chargedAmount, payload.currency)
          : null

      const sessionRange = formatSessionRange(payload.sessionStartDate, payload.sessionEndDate)
      const reasonLabel =
        isDeclined && payload.declineReason
          ? BOOKING_DECLINE_REASON_LABELS[payload.declineReason as BookingDeclineReason]
          : undefined

      const parentBody = isAccepted
        ? chargedAmountFormatted
          ? `Your booking at ${payload.campName} has been confirmed and your card has been charged ${chargedAmountFormatted}. Check your booking for full details.`
          : `Your booking at ${payload.campName} has been confirmed. Check your booking for full details.`
        : isDeclined
          ? sessionRange
            ? `Your booking request for ${payload.campName} on ${sessionRange} was declined. No charge has been made.${
                reasonLabel ? ` Reason: ${reasonLabel}.` : ''
              }`
            : `Your booking request for ${payload.campName} was declined. No charge has been made.${
                reasonLabel ? ` Reason: ${reasonLabel}.` : ''
              }`
          : `Your booking status has changed to ${payload.newStatus}.`

      const notificationBase = {
        type: notificationType,
        entityType: NotificationEntityType.BookingGroup,
        entityId: payload.bookingGroupId,
        metadata: {
          bookingGroupNumber: payload.bookingGroupNumber,
          campName: payload.campName,
        },
      }

      // Persist in-app notifications and (best-effort) dispatch the parent
      // email in the same allSettled batch — email failures must not break
      // the WS/notification flow.
      const parentEmailTask =
        isAccepted || isDeclined
          ? this.dispatchParentEmail({
              parentUserId: payload.parentUserId,
              bookingGroupId: payload.bookingGroupId,
              campName: payload.campName,
              sessionRange,
              isAccepted,
              chargedAmount: payload.chargedAmount,
              currency: payload.currency,
              reasonLabel,
            })
          : Promise.resolve()

      await Promise.allSettled([
        // Parent: actionable message reflecting the actual booking state
        this.notificationsService.create({
          userId: payload.parentUserId,
          ...notificationBase,
          title: isAccepted
            ? `Booking confirmed — ${payload.campName}`
            : isDeclined
              ? `Booking declined — ${payload.campName}`
              : `Booking update — ${payload.campName}`,
          body: parentBody,
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
            title: isAccepted
              ? `You accepted booking ${payload.bookingGroupNumber}`
              : `You declined booking ${payload.bookingGroupNumber}`,
            body: `Camp: ${payload.campName}`,
            metadata: {
              ...notificationBase.metadata,
              redirectUrl: `/provider/bookings/${payload.bookingGroupId}`,
            },
          }
        ),

        parentEmailTask,
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
   * Look up parent contact details and dispatch the matching email.
   * Failures are swallowed inside `BookingNotificationService` — this
   * wrapper exists so we can keep the orchestration above readable.
   */
  private async dispatchParentEmail(args: {
    parentUserId: string
    bookingGroupId: string
    campName: string
    sessionRange: string
    isAccepted: boolean
    chargedAmount?: number
    currency?: string
    reasonLabel?: string
  }): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: args.parentUserId },
      select: { email: true, firstName: true },
    })
    if (!user?.email) {
      this.logger.warn(
        `Skipping booking email — no email on user ${args.parentUserId} for booking ${args.bookingGroupId}`
      )
      return
    }

    if (args.isAccepted) {
      // Without an amount we cannot send a truthful "charged X" email —
      // fall back to the in-app notification only rather than send a
      // misleading "your card has been charged" with no value.
      if (args.chargedAmount == null || !args.currency) {
        this.logger.warn(
          `Skipping booking-accepted email for ${args.bookingGroupId} — missing chargedAmount or currency`
        )
        return
      }
      await this.bookingNotificationService.sendBookingAcceptedEmail({
        parentEmail: user.email,
        parentFirstName: user.firstName ?? 'there',
        bookingGroupId: args.bookingGroupId,
        campName: args.campName,
        sessionRange: args.sessionRange,
        chargedAmount: args.chargedAmount,
        currency: args.currency,
      })
      return
    }

    await this.bookingNotificationService.sendBookingDeclinedEmail({
      parentEmail: user.email,
      parentFirstName: user.firstName ?? 'there',
      bookingGroupId: args.bookingGroupId,
      campName: args.campName,
      sessionRange: args.sessionRange,
      reasonLabel: args.reasonLabel,
    })
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

/**
 * Renders the ISO date pair on the payload as a compact human range, e.g.
 * "10–17 Aug 2026" or "29 Jul – 4 Aug 2026". Used by both the in-app body
 * and the email template so the wording stays consistent.
 */
function formatSessionRange(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return ''
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''

  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()

  const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric' })
  const dayMonthFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
  const fullFmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  if (sameMonth) {
    return `${dayFmt.format(start)}–${fullFmt.format(end)}`
  }
  if (sameYear) {
    return `${dayMonthFmt.format(start)} – ${fullFmt.format(end)}`
  }
  return `${fullFmt.format(start)} – ${fullFmt.format(end)}`
}
