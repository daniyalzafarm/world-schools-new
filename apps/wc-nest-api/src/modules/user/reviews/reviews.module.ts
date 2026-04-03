import { Module } from '@nestjs/common'
import { UserReviewsController } from './reviews.controller'
import { UserReviewsService } from './reviews.service'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ConfigModule } from '../../../config/config.module'

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [UserReviewsController],
  providers: [UserReviewsService],
})
export class UserReviewsModule {}
