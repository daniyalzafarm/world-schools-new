import { Module } from '@nestjs/common';
import { UserAuthController } from './auth.controller';
import { AuthModule } from '../../core/auth/auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ConfigModule } from '../../../config/config.module';

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule],
  controllers: [UserAuthController],
})
export class UserAuthModule {}

