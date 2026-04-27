import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { AdminSettingsService } from './admin-settings.service'
import { UpdateSystemSettingsDto } from './dto/admin-settings.dto'

@ApiTags('Superadmin - System Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesOrPermissionsGuard)
@Roles('Super Admin')
@Controller('superadmin/settings')
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get system-level settings (e.g. default commission)' })
  async getSettings() {
    const data = await this.adminSettingsService.getSettings()
    return ResponseUtil.success(data)
  }

  @Put()
  @ApiOperation({ summary: 'Update system-level settings' })
  async updateSettings(
    @Body() dto: UpdateSystemSettingsDto,
    @Request() req: { user: { id: string } }
  ) {
    const data = await this.adminSettingsService.updateSettings(dto, req.user.id)
    return ResponseUtil.success(data)
  }
}
