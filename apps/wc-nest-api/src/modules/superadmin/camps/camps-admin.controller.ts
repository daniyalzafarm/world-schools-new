import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SuperAdminCampsService } from './camps.service'
import { GetCampsQueryDto } from './dto/get-camps-query.dto'
import { GetCampSessionsQueryDto } from './dto/get-camp-sessions-query.dto'
import { GetCampBookingsQueryDto } from './dto/get-camp-bookings-query.dto'
import { GetCampReviewsQueryDto } from './dto/get-camp-reviews-query.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

@ApiTags('SuperAdmin Camps')
@ApiBearerAuth()
@Controller('superadmin/camps')
@UseGuards(RolesOrPermissionsGuard)
export class SuperAdminCampsAdminController {
  constructor(private readonly campsService: SuperAdminCampsService) {}

  @Get('stats')
  @Permissions('camps.read')
  @ApiOperation({ summary: 'Get camp counts by status' })
  async getStats() {
    const stats = await this.campsService.getStats()
    return ResponseUtil.success(stats)
  }

  @Get()
  @Permissions('camps.read')
  @ApiOperation({ summary: 'List all camps with pagination and filters' })
  async findAll(@Query() query: GetCampsQueryDto) {
    const result = await this.campsService.findAll(query)
    return ResponseUtil.success(result)
  }

  @Get(':id')
  @Permissions('camps.read')
  @ApiOperation({ summary: 'Get full camp detail' })
  async getDetail(@Param('id') id: string) {
    const detail = await this.campsService.getDetail(id)
    return ResponseUtil.success(detail)
  }

  @Get(':id/sessions')
  @Permissions('camps.read')
  @ApiOperation({ summary: 'List sessions for a specific camp' })
  async getCampSessions(@Param('id') id: string, @Query() query: GetCampSessionsQueryDto) {
    const result = await this.campsService.getCampSessions(id, query)
    return ResponseUtil.success(result)
  }

  @Get(':id/bookings')
  @Permissions('camps.read')
  @ApiOperation({ summary: 'List booking groups for a specific camp' })
  async getCampBookings(@Param('id') id: string, @Query() query: GetCampBookingsQueryDto) {
    const result = await this.campsService.getCampBookings(id, query)
    return ResponseUtil.success(result)
  }

  @Get(':id/reviews')
  @Permissions('camps.read')
  @ApiOperation({ summary: 'List reviews for a specific camp' })
  async getCampReviews(@Param('id') id: string, @Query() query: GetCampReviewsQueryDto) {
    const result = await this.campsService.getCampReviews(id, query)
    return ResponseUtil.success(result)
  }
}
