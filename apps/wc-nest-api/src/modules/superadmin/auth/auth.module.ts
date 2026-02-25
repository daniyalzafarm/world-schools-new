import { Module } from '@nestjs/common'
import { SuperAdminAuthController } from './auth.controller'
import { AuthModule } from '../../core/auth/auth.module'
import { ConfigModule } from '../../../config/config.module'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigService } from '../../../config/config.service'
import { PasswordResetService } from '../../core/auth/services/password-reset.service'
import { TwoFactorAuthService } from './services/two-factor-auth.service'
import { SessionManagementService } from './services/session-management.service'
import { EmailService } from '@world-schools/global-utils'
import { EmailTemplatesModule } from '../../common/email-templates/email-templates.module'

@Module({
  imports: [AuthModule, ConfigModule, PrismaModule, EmailTemplatesModule],
  controllers: [SuperAdminAuthController],
  providers: [
    TwoFactorAuthService,
    SessionManagementService,
    PasswordResetService,
    {
      provide: EmailService,
      useFactory: (configService: ConfigService) => {
        return new EmailService(configService.emailConfig)
      },
      inject: [ConfigService],
    },
  ],
})
export class SuperAdminAuthModule {}
