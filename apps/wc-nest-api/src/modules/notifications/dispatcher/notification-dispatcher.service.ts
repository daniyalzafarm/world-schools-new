import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../prisma/prisma.service'
import { getCatalogEntry } from '../catalog/notification-catalog'
import { NotificationsMetricsService } from '../observability/notifications-metrics.service'
import { NotificationsEnqueueService } from '../queue/enqueue.service'
import { NotificationPreferencesService } from '../preferences/notification-preferences.service'
import { getResolver } from '../resolvers/recipient-resolvers'
import type { NotificationContext } from '../queue/queue.types'
import { NOTIFICATION_DISPATCH_EVENT, type NotificationDispatchEvent } from './notify'

/**
 * Single catch-all dispatcher.
 *
 * One listener for every notification — the catalog drives all per-type
 * variation. Trade-off vs per-type listeners: stack traces and isolated
 * "disable this one trigger" toggles are slightly worse; cognitive load,
 * test boilerplate, and BullMQ coupling are dramatically better.
 * Per-trigger enabled/disabled lives on the catalog entry itself (not
 * implemented here yet — an `enabled: boolean` field can be added
 * if needed).
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly enqueueService: NotificationsEnqueueService,
    private readonly preferences: NotificationPreferencesService,
    private readonly metrics: NotificationsMetricsService
  ) {}

  @OnEvent(NOTIFICATION_DISPATCH_EVENT, { async: true })
  async dispatch(event: NotificationDispatchEvent): Promise<void> {
    const entry = getCatalogEntry(event.type)
    if (!entry) {
      this.logger.error(`No catalog entry for notification type ${event.type}`)
      return
    }

    const resolver = getResolver(entry.resolver)
    if (!resolver) return

    const rawRecipients = await resolver({ prisma: this.prisma }, event.context)
    const recipients = [...new Set(rawRecipients)]
    if (recipients.length < rawRecipients.length) {
      this.logger.warn(
        `Resolver ${entry.resolver} returned ${rawRecipients.length} recipients, de-duplicated to ${recipients.length} — likely a resolver bug worth investigating`
      )
    }
    if (recipients.length === 0) {
      this.logger.warn(
        `No recipients resolved for ${event.type} (resolver=${entry.resolver}) — skipping dispatch`
      )
      if (entry.transactional) {
        // Transactional notifications with zero recipients = always a bug
        // (a refund / payment / dispute is being silently dropped). Bump a
        // dedicated counter so ops can alert on it.
        this.metrics.recordZeroRecipientTransactional()
        this.logger.error(
          `Transactional notification ${event.type} resolved 0 recipients — investigate ${entry.resolver}`
        )
      }
      return
    }

    const delay = event.runAt ? Math.max(0, event.runAt.getTime() - Date.now()) : 0

    await Promise.all(
      recipients.map(async userId => {
        const channels = entry.transactional
          ? entry.channels
          : await this.preferences.filterChannels(userId, entry.templateKey, entry.channels)
        if (channels.length === 0) return

        await this.enqueueService.enqueue({
          type: event.type,
          recipientUserId: userId,
          channels,
          context: event.context,
          dedupeKey: (entry.dedupeKey ?? defaultDedupeKey)(userId, event.context),
          delay,
        })
      })
    )
  }
}

/**
 * Default dedupe key: `${type}:${recipientUserId}:${entityId}`. Catalog
 * entries override via `entry.dedupeKey` for non-entity-bound notifications
 * (e.g. seasonal reminders) or for finer granularity (e.g. per-day caps).
 */
function defaultDedupeKey(recipientUserId: string, ctx: NotificationContext): string {
  const entity =
    ctx.bookingGroupId ??
    ctx.bookingId ??
    ctx.paymentId ??
    ctx.refundId ??
    ctx.disputeId ??
    ctx.reviewId ??
    ctx.conversationId ??
    ctx.messageId ??
    ctx.supportTicketId ??
    ctx.payoutEventId ??
    ctx.reimbursementId ??
    ctx.wishlistItemId ??
    ctx.verificationDocumentId ??
    ctx.campId ??
    ctx.providerId ??
    'global'
  return `${recipientUserId}:${entity}`
}
