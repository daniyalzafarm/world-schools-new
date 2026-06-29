import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { RedisModule } from '../redis/redis.module'
import { WebSocketModule } from '../websocket/websocket.module'
import { EmailTemplatesModule } from '../common/email-templates/email-templates.module'
import { NotificationsService } from './notifications.service'
import {
  ProviderNotificationsController,
  SuperadminNotificationsController,
  UserNotificationsController,
} from './notifications.controller'
import { NotificationsQueueModule } from './queue/notifications-queue.module'
import { NotificationsBullBoardModule } from './queue/bull-board.module'
import { NotificationDispatcherService } from './dispatcher/notification-dispatcher.service'
import { NotificationPreferencesService } from './preferences/notification-preferences.service'
import {
  ProviderNotificationPreferencesController,
  SuperadminNotificationPreferencesController,
  UserNotificationPreferencesController,
} from './preferences/notification-preferences.controller'
import { NotificationLiveWorker, NotificationScheduledWorker } from './workers/notification.worker'
import { ProviderEngagementCron } from './crons/provider-engagement.cron'
import { SuperadminEngagementCron } from './crons/superadmin-engagement.cron'
import { NotificationReconciliationCron } from './crons/reconciliation.cron'
import { NotificationsHealthController } from './observability/notifications-health.controller'
import { NotificationsFailureListener } from './observability/notifications-failure.listener'

/**
 * Notifications Module
 *
 * Persistent in-app notifications with real-time WebSocket delivery, backed
 * by a BullMQ catalog-driven dispatcher. Architecture:
 *
 * - Domain services commit DB state and emit `notification.dispatch` via
 *   EventEmitter2 (helper: `notifications/dispatcher/notify.ts`).
 * - `NotificationDispatcher` looks up the catalog entry, resolves
 *   recipients, applies preferences, and enqueues one BullMQ job per
 *   (recipient × channel).
 * - `NotificationWorker` consumes jobs: re-hydrates props,
 *   renders React Email, calls `NotificationsService.create` for in-app,
 *   `EmailService.sendEmail` for email, and writes a `NotificationDelivery`
 *   audit row gated by a unique index for idempotency.
 * - Bull Board mounted at `/admin/queues` (basic-auth gated) for ops.
 *
 * NotificationsService remains the single in-app persistence entry point —
 * the worker calls into it. Pre-catalog callers (BookingWebSocketHandler,
 * SupportTicketsService) still inject it directly; a later migration moves
 * them to the catalog and removes the direct calls.
 */
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    WebSocketModule,
    EmailTemplatesModule,
    NotificationsQueueModule,
    NotificationsBullBoardModule,
  ],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationPreferencesService,
    NotificationLiveWorker,
    NotificationScheduledWorker,
    ProviderEngagementCron,
    SuperadminEngagementCron,
    NotificationReconciliationCron,
    NotificationsFailureListener,
  ],
  controllers: [
    UserNotificationsController,
    ProviderNotificationsController,
    SuperadminNotificationsController,
    UserNotificationPreferencesController,
    ProviderNotificationPreferencesController,
    SuperadminNotificationPreferencesController,
    NotificationsHealthController,
  ],
  exports: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationPreferencesService,
    NotificationsQueueModule,
  ],
})
export class NotificationsModule {}
