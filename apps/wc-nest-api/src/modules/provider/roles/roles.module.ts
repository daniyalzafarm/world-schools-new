import { Module } from '@nestjs/common'
import { ProviderRolesService } from './roles.service'
import { ProviderRolesController } from './roles.controller'
import { PrismaModule } from '../../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [ProviderRolesController],
  providers: [ProviderRolesService],
})
export class ProviderRolesModule {}
