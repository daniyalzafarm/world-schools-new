import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { UserAuthController } from './auth.controller'
import { AuthModule } from '../../core/auth/auth.module'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { ConfigService } from '../../../config/config.service'
import { EmailVerificationService } from './services/email-verification.service'
import { TwoFactorAuthService } from './services/two-factor-auth.service'
import { SessionManagementService } from './services/session-management.service'
import { ProfilePhotoService } from './services/profile-photo.service'
import { PasswordResetService } from '../../core/auth/services/password-reset.service'
import { EmailService } from '@world-schools/global-utils'
import { EmailTemplatesModule } from '../../common/email-templates/email-templates.module'

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ConfigModule,
    EmailTemplatesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.jwtConfig.secret,
        signOptions: {
          expiresIn: configService.jwtConfig.expiresIn as any,
        },
      }),
    }),
  ],
  controllers: [UserAuthController],
  providers: [
    EmailVerificationService,
    TwoFactorAuthService,
    SessionManagementService,
    ProfilePhotoService,
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
export class UserAuthModule {}
