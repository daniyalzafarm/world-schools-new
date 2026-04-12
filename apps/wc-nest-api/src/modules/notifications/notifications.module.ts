import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { WebSocketModule } from '../websocket/websocket.module'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'

/**
 * Notifications Module
 *
 * Provides persistent in-app notifications with real-time WebSocket delivery.
 *
 * Architecture:
 * - NotificationsService.create() → persists to DB → emits 'notification:new' via WebSocket
 * - REST endpoints for listing, read marking, and badge counts
 * - NotificationsService is exported so other modules (BookingWebSocketHandler,
 *   SupportTicketsService) can create notifications without circular imports
 *
 * Notification types are defined as a TypeScript enum in wc-types (NotificationType).
 * The DB column is a plain string — new types can be added without Prisma migrations.
 */
@Module({
  imports: [PrismaModule, WebSocketModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
