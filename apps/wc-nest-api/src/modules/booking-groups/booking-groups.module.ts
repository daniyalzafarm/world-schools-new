import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ConfigModule } from '../../config/config.module'
import { BookingGroupsService } from './booking-groups.service'

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [BookingGroupsService],
  exports: [BookingGroupsService],
})
export class BookingGroupsModule {}
