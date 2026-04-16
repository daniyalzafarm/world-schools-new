import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { APP_GUARD } from '@nestjs/core'

import { AuthService } from './auth.service'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { ConfigService } from '../../../config/config.service'
import { EmailTemplatesModule } from '../../common/email-templates/email-templates.module'
import { EmailService } from '@world-schools/global-utils'

// Strategies
import { LocalStrategy } from './strategies/local.strategy'
import { JwtStrategy } from './strategies/jwt.strategy'

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RolesOrPermissionsGuard } from './guards/roles-or-permissions.guard'

// Shared services (previously triplicated across user/provider/superadmin auth modules)
import { TwoFactorAuthService } from './services/two-factor-auth.service'
import { SessionManagementService } from './services/session-management.service'
import { EmailVerificationService } from './services/email-verification.service'

@Module({
  imports: [
    PrismaModule,
    PassportModule,
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
  controllers: [],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    JwtAuthGuard,
    RolesOrPermissionsGuard,
    TwoFactorAuthService,
    SessionManagementService,
    EmailVerificationService,
    // Apply JWT guard globally
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: EmailService,
      useFactory: (configService: ConfigService) => {
        return new EmailService(configService.emailConfig)
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesOrPermissionsGuard,
    TwoFactorAuthService,
    SessionManagementService,
    EmailVerificationService,
    EmailService,
  ],
})
export class AuthModule {}
