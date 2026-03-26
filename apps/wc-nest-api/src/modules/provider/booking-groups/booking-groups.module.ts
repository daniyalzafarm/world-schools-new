import { Module } from '@nestjs/common'
import { BookingGroupsModule } from '../../booking-groups/booking-groups.module'
import { ProviderBookingGroupsController } from './booking-groups.controller'

@Module({
  imports: [BookingGroupsModule],
  controllers: [ProviderBookingGroupsController],
})
export class ProviderBookingGroupsModule {}
