import { Module } from '@nestjs/common'
import { ProviderAuthController } from './auth.controller'
import { AuthModule } from '../../core/auth/auth.module'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { ConfigService } from '../../../config/config.service'
import { EmailVerificationService } from './services/email-verification.service'
import { TwoFactorAuthService } from './services/two-factor-auth.service'
import { SessionManagementService } from './services/session-management.service'
import { PasswordResetService } from '../../core/auth/services/password-reset.service'
import { ProfilePhotoService } from '../../user/auth/services/profile-photo.service'
import { EmailService } from '@world-schools/global-utils'
import { EmailTemplatesModule } from '../../common/email-templates/email-templates.module'

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule, EmailTemplatesModule],
  controllers: [ProviderAuthController],
  providers: [
    EmailVerificationService,
    TwoFactorAuthService,
    SessionManagementService,
    PasswordResetService,
    ProfilePhotoService,
    {
      provide: EmailService,
      useFactory: (configService: ConfigService) => {
        return new EmailService(configService.emailConfig)
      },
      inject: [ConfigService],
    },
  ],
})
export class ProviderAuthModule {}
