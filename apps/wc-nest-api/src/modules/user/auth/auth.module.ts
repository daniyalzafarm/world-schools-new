import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { UserAuthController } from './auth.controller'
import { AuthModule } from '../../core/auth/auth.module'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { ConfigService } from '../../../config/config.service'
import { ProfilePhotoService } from './services/profile-photo.service'
import { GoogleTokenVerifierService } from './services/google-token-verifier.service'
import { PasswordResetService } from '../../core/auth/services/password-reset.service'

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ConfigModule,
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
  providers: [ProfilePhotoService, GoogleTokenVerifierService, PasswordResetService],
})
export class UserAuthModule {}
