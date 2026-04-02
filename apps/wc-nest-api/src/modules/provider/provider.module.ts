import { Module } from '@nestjs/common'
import { ProviderAuthModule } from './auth/auth.module'
import { ProviderRolesModule } from './roles/roles.module'
import { ProviderUsersModule } from './users/users.module'
import { ProviderPermissionsModule } from './permissions/permissions.module'
import { OnboardingModule } from './onboarding/onboarding.module'
import { CampsModule } from './camps/camps.module'
import { AddOnsModule } from './add-ons/add-ons.module'
import { SessionsModule } from './sessions/sessions.module'
import { DiscountsModule } from './discounts/discounts.module'
import { ProviderMessagingModule } from './messaging/provider-messaging.module'
import { ProviderBookingGroupsModule } from './booking-groups/booking-groups.module'
import { ProviderReviewsModule } from './reviews/provider-reviews.module'

@Module({
  imports: [
    ProviderAuthModule,
    ProviderRolesModule,
    ProviderUsersModule,
    ProviderPermissionsModule,
    OnboardingModule,
    CampsModule,
    AddOnsModule,
    SessionsModule,
    DiscountsModule,
    ProviderBookingGroupsModule,
    ProviderMessagingModule,
    ProviderReviewsModule,
  ],
})
export class ProviderModule {}
