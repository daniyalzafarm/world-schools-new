import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ProviderRolesService } from './roles.service'
import { CreateProviderRoleDto } from './dto/create-role.dto'
import { UpdateProviderRoleDto } from './dto/update-role.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { PrismaService } from '../../../prisma/prisma.service'

@ApiTags('Provider Roles')
@ApiBearerAuth()
@Controller('provider/roles')
@UseGuards(RolesOrPermissionsGuard)
@Roles('Provider Admin')
export class ProviderRolesController {
  constructor(
    private readonly rolesService: ProviderRolesService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new provider-specific role',
    description: 'Create a custom role for your provider with optional permissions',
  })
  async create(@CurrentUser() user: any, @Body() createRoleDto: CreateProviderRoleDto) {
    const providerId = await this.getProviderIdForUser(user.id)
    const role = await this.rolesService.create(providerId, createRoleDto)
    return ResponseUtil.success(role, 'Role created successfully')
  }

  @Get()
  @ApiOperation({
    summary: 'Get all provider-specific roles',
    description: 'Retrieve all custom roles for your provider',
  })
  async findAll(@CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user.id)
    const roles = await this.rolesService.findAll(providerId)
    return ResponseUtil.success(roles, 'Roles retrieved successfully')
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a role by ID',
    description: 'Retrieve a specific role with its permissions',
  })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    const providerId = await this.getProviderIdForUser(user.id)
    const role = await this.rolesService.findOne(providerId, id)
    return ResponseUtil.success(role, 'Role retrieved successfully')
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a role',
    description: 'Update role name and/or permissions',
  })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateProviderRoleDto
  ) {
    const providerId = await this.getProviderIdForUser(user.id)
    const role = await this.rolesService.update(providerId, id, updateRoleDto)
    return ResponseUtil.success(role, 'Role updated successfully')
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a role',
    description: 'Delete a role if it is not assigned to any users',
  })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    const providerId = await this.getProviderIdForUser(user.id)
    const result = await this.rolesService.remove(providerId, id)
    return ResponseUtil.success(result, result.message)
  }

  private async getProviderIdForUser(userId: string): Promise<string> {
    const provider = await this.prisma.provider.findUnique({
      where: { owner_id: userId },
      select: { id: true },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found for this user')
    }

    return provider.id
  }
}
