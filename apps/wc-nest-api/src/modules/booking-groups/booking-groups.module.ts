import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ConfigModule } from '../../config/config.module'
import { ProfilePhotoService } from '../user/auth/services/profile-photo.service'
import { BookingGroupsService } from './booking-groups.service'

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [BookingGroupsService, ProfilePhotoService],
  exports: [BookingGroupsService],
})
export class BookingGroupsModule {}
