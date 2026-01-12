import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { CampsController } from './camps.controller'
import { CampsService } from './camps.service'
import { PhotoUploadService } from './services/photo-upload.service'

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [CampsController],
  providers: [CampsService, PhotoUploadService],
  exports: [CampsService],
})
export class CampsModule {}
