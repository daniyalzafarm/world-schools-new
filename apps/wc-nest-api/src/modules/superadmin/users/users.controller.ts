import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { CommonUsersService } from '../../common/users/users.service'
import { SuperAdminUsersService } from './users.service'
import { CreateUserDto } from '../../common/users/dto/create-user.dto'
import { UpdateUserDto } from '../../common/users/dto/update-user.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

@ApiTags('SuperAdmin Users')
@ApiBearerAuth()
@Controller('superadmin/users')
@UseGuards(RolesOrPermissionsGuard)
export class SuperAdminUsersController {
  constructor(
    private readonly usersService: CommonUsersService,
    private readonly superAdminUsersService: SuperAdminUsersService
  ) {}

  @Post()
  @Permissions('users.create')
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Create a new user with optional role assignments',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto)
    return ResponseUtil.success(user)
  }

  @Get()
  @Permissions('users.read')
  @ApiOperation({
    summary: 'Get all superadmin users',
    description:
      'Retrieve all users with SuperAdmin or custom superadmin roles (excludes Provider Admin and Parent users)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'roleId', required: false, type: String })
  @ApiQuery({ name: 'emailVerified', required: false, type: Boolean })
  @ApiQuery({ name: 'createdAfter', required: false, type: String })
  @ApiQuery({ name: 'createdBefore', required: false, type: String })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('roleId') roleId?: string,
    @Query('emailVerified') emailVerified?: string,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string
  ) {
    const result = await this.superAdminUsersService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      roleId,
      emailVerified: emailVerified !== undefined ? emailVerified === 'true' : undefined,
      createdAfter: createdAfter ? new Date(createdAfter) : undefined,
      createdBefore: createdBefore ? new Date(createdBefore) : undefined,
    })
    return ResponseUtil.success(result.data, result.meta)
  }

  @Get(':id')
  @Permissions('users.read')
  @ApiOperation({
    summary: 'Get a user by ID',
    description: 'Retrieve a specific user with their roles and permissions',
  })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id)
    return ResponseUtil.success(user)
  }

  @Patch(':id')
  @Permissions('users.update')
  @ApiOperation({
    summary: 'Update a user',
    description: 'Update user details and/or role assignments',
  })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.usersService.update(id, updateUserDto)
    return ResponseUtil.success(user)
  }

  @Delete(':id')
  @Permissions('users.delete')
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Delete a user from the system',
  })
  async remove(@Param('id') id: string) {
    const result = await this.usersService.remove(id)
    return ResponseUtil.success(result)
  }
}
