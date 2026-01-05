import { Module } from '@nestjs/common'
import { ApplicationReviewController } from './application-review.controller'
import { ApplicationReviewService } from './services/application-review.service'
import { DocumentReviewService } from './services/document-review.service'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { AuthModule } from '../../core/auth/auth.module'
import { OnboardingModule } from '../../provider/onboarding/onboarding.module'
import { EmailTemplatesModule } from '../../common/email-templates/email-templates.module'

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule, OnboardingModule, EmailTemplatesModule],
  controllers: [ApplicationReviewController],
  providers: [ApplicationReviewService, DocumentReviewService],
  exports: [ApplicationReviewService, DocumentReviewService],
})
export class ApplicationReviewModule {}
