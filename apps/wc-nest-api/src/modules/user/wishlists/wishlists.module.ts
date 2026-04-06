import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'
import { UserWishlistsController } from './wishlists.controller'
import { UserWishlistsService } from './wishlists.service'

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [UserWishlistsController],
  providers: [UserWishlistsService],
})
export class UserWishlistsModule {}
