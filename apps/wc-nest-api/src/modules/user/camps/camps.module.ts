import { Module } from '@nestjs/common'
import { UserCampsService } from './camps.service'
import { UserCampsController } from './camps.controller'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [UserCampsController],
  providers: [UserCampsService],
})
export class UserCampsModule {}
