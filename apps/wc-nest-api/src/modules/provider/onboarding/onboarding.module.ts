import { Module } from '@nestjs/common'
import { OnboardingController } from './onboarding.controller'
import { OnboardingService } from './services/onboarding.service'
import { GoogleBusinessService } from './services/google-business.service'
import { ProviderSettingsService } from './services/provider-settings.service'
import { DocumentProcessingService } from './services/document-processing.service'
import { TrustScoreService } from './services/trust-score.service'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { AuthModule } from '../../core/auth/auth.module'

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    GoogleBusinessService,
    ProviderSettingsService,
    DocumentProcessingService,
    TrustScoreService,
  ],
  exports: [
    OnboardingService,
    GoogleBusinessService,
    ProviderSettingsService,
    DocumentProcessingService,
    TrustScoreService,
  ],
})
export class OnboardingModule {}
