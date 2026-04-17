import { Module } from '@nestjs/common'
import { SuperAdminParentsController } from './parents.controller'
import { SuperAdminParentsService } from './parents.service'
import { PrismaModule } from '../../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [SuperAdminParentsController],
  providers: [SuperAdminParentsService],
})
export class SuperAdminParentsModule {}
