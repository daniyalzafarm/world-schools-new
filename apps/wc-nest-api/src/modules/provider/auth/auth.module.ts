import { Module } from '@nestjs/common'
import { ProviderAuthController } from './auth.controller'
import { AuthModule } from '../../core/auth/auth.module'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { PasswordResetService } from '../../core/auth/services/password-reset.service'
import { ProfilePhotoService } from '../../user/auth/services/profile-photo.service'

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule],
  controllers: [ProviderAuthController],
  providers: [PasswordResetService, ProfilePhotoService],
})
export class ProviderAuthModule {}
