import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from '../../../common/utils/response.util'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { DashboardService } from './dashboard.service'

@ApiTags('Provider Dashboard')
@ApiBearerAuth()
@Controller('provider/dashboard')
@UseGuards(RolesOrPermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Permissions('provider_dashboard.read')
  @ApiOperation({ summary: 'Get the aggregated provider dashboard snapshot' })
  async getDashboard(@CurrentUser() user: any) {
    const snapshot = await this.dashboardService.getSnapshot(user.providerId)
    return ResponseUtil.success(snapshot)
  }
}
