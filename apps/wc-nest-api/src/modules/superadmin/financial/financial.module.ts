import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { SuperAdminAnalyticsModule } from '../analytics/analytics.module'
import { FinancialController } from './financial.controller'
import { FinancialService } from './financial.service'
import { FinancialStripeService } from './financial-stripe.service'

@Module({
  imports: [PrismaModule, SuperAdminAnalyticsModule],
  controllers: [FinancialController],
  providers: [FinancialService, FinancialStripeService],
})
export class SuperAdminFinancialModule {}
