import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { BookingGroupsService } from './booking-groups.service'

@Module({
  imports: [PrismaModule],
  providers: [BookingGroupsService],
  exports: [BookingGroupsService],
})
export class BookingGroupsModule {}
