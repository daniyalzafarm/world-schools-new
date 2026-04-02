import { Module } from '@nestjs/common'
import { UserReviewsController } from './reviews.controller'
import { UserReviewsService } from './reviews.service'
import { PrismaModule } from '../../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [UserReviewsController],
  providers: [UserReviewsService],
})
export class UserReviewsModule {}
