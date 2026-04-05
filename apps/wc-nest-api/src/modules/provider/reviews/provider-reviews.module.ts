import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { ProviderReviewsController } from './provider-reviews.controller'
import { ProviderReviewsService } from './provider-reviews.service'

@Module({
  imports: [PrismaModule],
  controllers: [ProviderReviewsController],
  providers: [ProviderReviewsService],
})
export class ProviderReviewsModule {}
