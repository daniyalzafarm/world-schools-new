import { Module } from '@nestjs/common';
import { SuperAdminRolesService } from './roles.service';
import { SuperAdminRolesController } from './roles.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SuperAdminRolesController],
  providers: [SuperAdminRolesService],
})
export class SuperAdminRolesModule {}

