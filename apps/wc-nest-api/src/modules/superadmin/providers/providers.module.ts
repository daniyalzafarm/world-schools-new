import { Module } from '@nestjs/common';
import { SuperAdminProvidersService } from './providers.service';
import { SuperAdminProvidersController } from './providers.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SuperAdminProvidersController],
  providers: [SuperAdminProvidersService],
})
export class SuperAdminProvidersModule {}

