import { Module } from '@nestjs/common'
import { BookingGroupsModule } from '../../booking-groups/booking-groups.module'
import { UserBookingGroupsController } from './booking-groups.controller'

@Module({
  imports: [BookingGroupsModule],
  controllers: [UserBookingGroupsController],
})
export class UserBookingGroupsModule {}
