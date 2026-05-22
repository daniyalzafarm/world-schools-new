import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ResponseUtil } from '../../../common/utils/response.util'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { AnalyticsService } from './analytics.service'
import { AnalyticsRangeDto } from './dto/analytics-range.dto'

class TopProvidersQueryDto extends AnalyticsRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

class GeographicQueryDto extends AnalyticsRangeDto {
  @IsOptional()
  @IsIn(['gmv', 'bookings', 'parents'])
  metric?: 'gmv' | 'bookings' | 'parents'
}

@ApiTags('SuperAdmin Analytics')
@ApiBearerAuth()
@Controller('superadmin/analytics')
@UseGuards(RolesOrPermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('currencies')
  @Permissions('analytics.read')
  @ApiOperation({ summary: 'List currencies present in BookingGroups (for dashboard selector)' })
  async getCurrencies() {
    return ResponseUtil.success(await this.analytics.getCurrencies())
  }

  @Get('overview')
  @Permissions('analytics.read')
  @ApiOperation({
    summary: 'KPI overview (GMV, Platform Revenue, Bookings, Parents, Conversion Rate)',
  })
  async getOverview(@Query() query: AnalyticsRangeDto) {
    return ResponseUtil.success(await this.analytics.getOverview(query))
  }

  @Get('timeseries/revenue')
  @Permissions('analytics.read')
  @ApiOperation({ summary: 'Bucketed GMV + platform revenue time series' })
  async getRevenueTimeseries(@Query() query: AnalyticsRangeDto) {
    return ResponseUtil.success(await this.analytics.getRevenueTimeseries(query))
  }

  @Get('booking-status-distribution')
  @Permissions('analytics.read')
  @ApiOperation({ summary: 'Booking distribution by lifecycle status' })
  async getBookingStatusDistribution(@Query() query: AnalyticsRangeDto) {
    return ResponseUtil.success(await this.analytics.getBookingStatusDistribution(query))
  }

  @Get('top-providers')
  @Permissions('analytics.read')
  @ApiOperation({ summary: 'Top performing providers by GMV in window' })
  @ApiQuery({ name: 'limit', required: false, schema: { default: 10, minimum: 1, maximum: 50 } })
  async getTopProviders(@Query() query: TopProvidersQueryDto) {
    return ResponseUtil.success(await this.analytics.getTopProviders(query))
  }

  @Get('geographic')
  @Permissions('analytics.read')
  @ApiOperation({ summary: 'Country distribution by provider location' })
  async getGeographic(@Query() query: GeographicQueryDto) {
    return ResponseUtil.success(await this.analytics.getGeographicDistribution(query))
  }

  @Get('funnel')
  @Permissions('analytics.read')
  @ApiOperation({ summary: 'Bookings conversion funnel (created → completed)' })
  async getFunnel(@Query() query: AnalyticsRangeDto) {
    return ResponseUtil.success(await this.analytics.getFunnel(query))
  }

  @Get('camps-health')
  @Permissions('analytics.read')
  @ApiOperation({ summary: 'Active camps + upcoming sessions + top booked camps' })
  async getCampsHealth(@Query() query: AnalyticsRangeDto) {
    return ResponseUtil.success(await this.analytics.getCampsHealth(query))
  }
}
