import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { superadminContext } from '../../../config/permissions'

@ApiTags('SuperAdmin Permissions')
@ApiBearerAuth()
@Controller('superadmin/permissions')
@UseGuards(RolesOrPermissionsGuard)
export class SuperAdminPermissionsController {
  @Get()
  @Permissions('roles.read')
  @ApiOperation({
    summary: 'Get all permissions grouped by resource',
    description:
      'Retrieve all permissions available in the superadmin context, organized by resource groups',
  })
  getPermissions() {
    return ResponseUtil.success(superadminContext.groups)
  }
}
