import { Module } from '@nestjs/common'
import { ProviderAuthController } from './auth.controller'
import { AuthModule } from '../../core/auth/auth.module'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule],
  controllers: [ProviderAuthController],
})
export class ProviderAuthModule {}
