import { Module } from '@nestjs/common'
import { SuperAdminAuthController } from './auth.controller'
import { AuthModule } from '../../core/auth/auth.module'
import { ConfigModule } from '../../../config/config.module'
import { PrismaModule } from '../../../prisma/prisma.module'
import { PasswordResetService } from '../../core/auth/services/password-reset.service'
import { ProfilePhotoService } from '../../user/auth/services/profile-photo.service'

@Module({
  imports: [AuthModule, ConfigModule, PrismaModule],
  controllers: [SuperAdminAuthController],
  providers: [PasswordResetService, ProfilePhotoService],
})
export class SuperAdminAuthModule {}
