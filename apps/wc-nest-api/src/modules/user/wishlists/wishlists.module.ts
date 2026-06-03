import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { RedisModule } from '../../redis/redis.module'
import { WishlistEngagementCron } from './crons/wishlist-engagement.cron'
import { UserWishlistsController } from './wishlists.controller'
import { UserWishlistsService } from './wishlists.service'

@Module({
  imports: [PrismaModule, ConfigModule, RedisModule],
  controllers: [UserWishlistsController],
  providers: [UserWishlistsService, WishlistEngagementCron],
})
export class UserWishlistsModule {}
