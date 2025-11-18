import { Module } from '@nestjs/common'
import { ProviderAuthController } from './auth.controller'
import { AuthModule } from '../../core/auth/auth.module'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { ConfigService } from '../../../config/config.service'
import { EmailVerificationService } from './services/email-verification.service'
import { PasswordResetService } from '../../core/auth/services/password-reset.service'
import { EmailService } from '@world-schools/global-utils'

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule],
  controllers: [ProviderAuthController],
  providers: [
    EmailVerificationService,
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
export class ProviderAuthModule {}
