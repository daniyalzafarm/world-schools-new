import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuperAdminRolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { ResponseUtil } from '../../../common/utils/response.util';

@ApiTags('SuperAdmin Roles')
@ApiBearerAuth()
@Controller('superadmin/roles')
@UseGuards(RolesOrPermissionsGuard)
@Roles('Super Admin')
export class SuperAdminRolesController {
  constructor(private readonly rolesService: SuperAdminRolesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new system-wide role',
    description: 'Create a new system-wide role with optional permissions',
  })
  async create(@Body() createRoleDto: CreateRoleDto) {
    const role = await this.rolesService.create(createRoleDto);
    return ResponseUtil.success(role, 'Role created successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'Get all system-wide roles',
    description: 'Retrieve all system-wide roles with their permissions',
  })
  async findAll() {
    const roles = await this.rolesService.findAll();
    return ResponseUtil.success(roles, 'Roles retrieved successfully');
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a role by ID',
    description: 'Retrieve a specific role with its permissions',
  })
  async findOne(@Param('id') id: string) {
    const role = await this.rolesService.findOne(id);
    return ResponseUtil.success(role, 'Role retrieved successfully');
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a role',
    description: 'Update role name and/or permissions',
  })
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    const role = await this.rolesService.update(id, updateRoleDto);
    return ResponseUtil.success(role, 'Role updated successfully');
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a role',
    description: 'Delete a role if it is not assigned to any users',
  })
  async remove(@Param('id') id: string) {
    const result = await this.rolesService.remove(id);
    return ResponseUtil.success(result, result.message);
  }
}

