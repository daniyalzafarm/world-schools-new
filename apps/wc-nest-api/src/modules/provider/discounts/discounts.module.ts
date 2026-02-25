import { Module } from '@nestjs/common'
import { DiscountsController } from './discounts.controller'
import { DiscountsService } from './discounts.service'
import { PrismaModule } from '../../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [DiscountsController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
