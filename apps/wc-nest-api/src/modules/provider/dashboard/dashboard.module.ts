import { Module } from '@nestjs/common'
import { CampsModule } from '../camps/camps.module'
import { SessionsModule } from '../sessions/sessions.module'
import { OnboardingModule } from '../onboarding/onboarding.module'
import { ProviderReviewsModule } from '../reviews/provider-reviews.module'
import { BookingGroupsModule } from '../../booking-groups/booking-groups.module'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

@Module({
  imports: [
    CampsModule,
    SessionsModule,
    OnboardingModule,
    ProviderReviewsModule,
    BookingGroupsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class ProviderDashboardModule {}
