import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { providerContext } from '../../../config/permissions'

@ApiTags('Provider Permissions')
@ApiBearerAuth()
@Controller('provider/permissions')
@UseGuards(RolesOrPermissionsGuard)
export class ProviderPermissionsController {
  @Get()
  @Permissions('roles.read')
  @ApiOperation({
    summary: 'Get all permissions grouped by resource',
    description:
      'Retrieve all permissions available in the provider context, organized by resource groups',
  })
  getPermissions() {
    return ResponseUtil.success(providerContext.groups)
  }
}
