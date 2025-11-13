import { Module } from '@nestjs/common';
import { SuperAdminAuthController } from './auth.controller';
import { AuthModule } from '../../core/auth/auth.module';
import { ConfigModule } from '../../../config/config.module';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [SuperAdminAuthController],
})
export class SuperAdminAuthModule {}

