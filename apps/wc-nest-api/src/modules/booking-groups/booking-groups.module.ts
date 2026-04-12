import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ConfigModule } from '../../config/config.module'
import { WebSocketModule } from '../websocket/websocket.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ProfilePhotoService } from '../user/auth/services/profile-photo.service'
import { BookingGroupsService } from './booking-groups.service'
import { BookingWebSocketHandler } from './booking-websocket.handler'

@Module({
  imports: [PrismaModule, ConfigModule, WebSocketModule, NotificationsModule],
  providers: [BookingGroupsService, ProfilePhotoService, BookingWebSocketHandler],
  exports: [BookingGroupsService],
})
export class BookingGroupsModule {}
