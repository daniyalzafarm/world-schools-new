import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SuperAdminParentsService } from './parents.service'
import { GetParentsQueryDto } from './dto/get-parents-query.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

@ApiTags('SuperAdmin Parents')
@ApiBearerAuth()
@Controller('superadmin/parents')
@UseGuards(RolesOrPermissionsGuard)
export class SuperAdminParentsController {
  constructor(private readonly parentsService: SuperAdminParentsService) {}

  @Get('stats')
  @Permissions('parents.read')
  @ApiOperation({ summary: 'Get parent statistics' })
  async getStats() {
    const stats = await this.parentsService.getStats()
    return ResponseUtil.success(stats)
  }

  @Get()
  @Permissions('parents.read')
  @ApiOperation({ summary: 'Get paginated list of parents' })
  async findAll(@Query() query: GetParentsQueryDto) {
    const result = await this.parentsService.findAll(query)
    return ResponseUtil.success(result)
  }
}
