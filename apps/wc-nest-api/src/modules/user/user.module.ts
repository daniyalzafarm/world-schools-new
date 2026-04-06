import { Module } from '@nestjs/common'
import { UserAuthModule } from './auth/auth.module'
import { UserChildrenModule } from './children/children.module'
import { UserCampsModule } from './camps/camps.module'
import { UserMessagingModule } from './messaging/user-messaging.module'
import { UserBookingGroupsModule } from './booking-groups/booking-groups.module'
import { UserReviewsModule } from './reviews/reviews.module'
import { UserWishlistsModule } from './wishlists/wishlists.module'

@Module({
  imports: [
    UserAuthModule,
    UserChildrenModule,
    UserCampsModule,
    UserBookingGroupsModule,
    UserMessagingModule,
    UserReviewsModule,
    UserWishlistsModule,
  ],
})
export class UserModule {}
