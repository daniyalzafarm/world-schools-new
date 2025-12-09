import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { SuperAdminRolesService } from './roles.service'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRoleDto } from './dto/update-role.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

@ApiTags('SuperAdmin Roles')
@ApiBearerAuth()
@Controller('superadmin/roles')
@UseGuards(RolesOrPermissionsGuard)
export class SuperAdminRolesController {
  constructor(private readonly rolesService: SuperAdminRolesService) {}

  @Post()
  @Permissions('roles.create')
  @ApiOperation({
    summary: 'Create a new system-wide role',
    description: 'Create a new system-wide role with optional permissions',
  })
  async create(@Body() createRoleDto: CreateRoleDto) {
    const role = await this.rolesService.create(createRoleDto)
    return ResponseUtil.success(role)
  }

  @Get()
  @Permissions('roles.read', 'users.create', 'users.update')
  @ApiOperation({
    summary: 'Get all system-wide roles',
    description:
      'Retrieve all system-wide roles with their permissions (excludes Provider Admin and Parent roles). Accessible with roles.read OR users.create OR users.update permissions.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isSystemRole', required: false, type: Boolean })
  @ApiQuery({ name: 'createdAfter', required: false, type: String })
  @ApiQuery({ name: 'createdBefore', required: false, type: String })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isSystemRole') isSystemRole?: string,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string
  ) {
    const result = await this.rolesService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      isSystemRole: isSystemRole !== undefined ? isSystemRole === 'true' : undefined,
      createdAfter: createdAfter ? new Date(createdAfter) : undefined,
      createdBefore: createdBefore ? new Date(createdBefore) : undefined,
    })
    return ResponseUtil.success(result.data, result.meta)
  }

  @Get(':id')
  @Permissions('roles.read')
  @ApiOperation({
    summary: 'Get a role by ID',
    description: 'Retrieve a specific role with its permissions',
  })
  async findOne(@Param('id') id: string) {
    const role = await this.rolesService.findOne(id)
    return ResponseUtil.success(role)
  }

  @Patch(':id')
  @Permissions('roles.update')
  @ApiOperation({
    summary: 'Update a role',
    description: 'Update role name and/or permissions',
  })
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    const role = await this.rolesService.update(id, updateRoleDto)
    return ResponseUtil.success(role)
  }

  @Delete(':id')
  @Permissions('roles.delete')
  @ApiOperation({
    summary: 'Delete a role',
    description: 'Delete a role if it is not assigned to any users',
  })
  async remove(@Param('id') id: string) {
    const result = await this.rolesService.remove(id)
    return ResponseUtil.success(result)
  }
}
