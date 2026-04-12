import { Module } from '@nestjs/common'
import { SuperAdminSessionsService } from './sessions.service'
import { SuperAdminSessionsController } from './sessions.controller'
import { PrismaModule } from '../../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [SuperAdminSessionsController],
  providers: [SuperAdminSessionsService],
})
export class SuperAdminSessionsModule {}
