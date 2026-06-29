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
import { EligibilityModule } from './eligibility.module'
import { BookingResponseExpiryCron } from './crons/response-expiry.cron'
import { BookingDraftCleanupCron } from './crons/draft-cleanup.cron'
import { AbandonDetectionCron } from './crons/abandon-detection.cron'
import { PostCampReviewCron } from './crons/post-camp-review.cron'

/**
 * BookingGroupsModule depends on BillingModule for the
 * `submitForParent → authorize` and `acceptForProvider → capture` /
 * `declineForProvider → cancel` flows. There is no
 * back-edge from billing → booking-groups (the webhook handlers do not
 * call into BookingGroupsService), so this is a clean one-way dependency.
 *
 * RedisModule is needed for the C5 submit-lock that serializes concurrent
 * submit attempts against the same (user, bookingGroup) pair.
 *
 * NotificationsModule + EmailTemplatesModule
 * imports dropped. BookingGroupsService now dispatches notifications via the
 * EventEmitter2-based `notify()` helper; the catalog dispatcher (booted by
 * NotificationsModule from AppModule) picks them up. BookingWebSocketHandler
 * keeps only the live WS fan-out — no notification or email creation.
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
    EligibilityModule,
  ],
  providers: [
    BookingGroupsService,
    ProfilePhotoService,
    BookingWebSocketHandler,
    BookingResponseExpiryCron,
    BookingDraftCleanupCron,
    AbandonDetectionCron,
    PostCampReviewCron,
  ],
  exports: [BookingGroupsService],
})
export class BookingGroupsModule {}
