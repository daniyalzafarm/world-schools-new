import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { DashboardCacheService } from './dashboard-cache.util'

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, DashboardCacheService],
  exports: [DashboardCacheService],
})
export class SuperAdminAnalyticsModule {}
