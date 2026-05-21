import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ConfigModule } from '../../config/config.module'
import { WebSocketModule } from '../websocket/websocket.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ProfilePhotoService } from '../user/auth/services/profile-photo.service'
import { BillingModule } from '../billing/billing.module'
import { RedisModule } from '../redis/redis.module'
import { EmailTemplatesModule } from '../common/email-templates/email-templates.module'
import { BookingGroupsService } from './booking-groups.service'
import { BookingWebSocketHandler } from './booking-websocket.handler'

/**
 * BookingGroupsModule depends on BillingModule for the
 * `submitForParent → authorize` and `acceptForProvider → capture` /
 * `declineForProvider → cancel` flows added in Phase 2. There is no
 * back-edge from billing → booking-groups (the webhook handlers do not
 * call into BookingGroupsService), so this is a clean one-way dependency.
 *
 * RedisModule is needed for the C5 submit-lock that serializes concurrent
 * submit attempts against the same (user, bookingGroup) pair.
 */
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    WebSocketModule,
    NotificationsModule,
    BillingModule,
    RedisModule,
    EmailTemplatesModule,
  ],
  providers: [BookingGroupsService, ProfilePhotoService, BookingWebSocketHandler],
  exports: [BookingGroupsService],
})
export class BookingGroupsModule {}
