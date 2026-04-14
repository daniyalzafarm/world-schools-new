import { Module } from '@nestjs/common'
import { ApplicationReviewController } from './application-review.controller'
import { ApplicationReviewService } from './services/application-review.service'
import { DocumentReviewService } from './services/document-review.service'
import { ApplicationReviewWebSocketHandler } from './application-review-websocket.handler'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { AuthModule } from '../../core/auth/auth.module'
import { OnboardingModule } from '../../provider/onboarding/onboarding.module'
import { EmailTemplatesModule } from '../../common/email-templates/email-templates.module'
import { WebSocketModule } from '../../websocket/websocket.module'

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    AuthModule,
    OnboardingModule,
    EmailTemplatesModule,
    WebSocketModule,
  ],
  controllers: [ApplicationReviewController],
  providers: [ApplicationReviewService, DocumentReviewService, ApplicationReviewWebSocketHandler],
  exports: [ApplicationReviewService, DocumentReviewService],
})
export class ApplicationReviewModule {}
