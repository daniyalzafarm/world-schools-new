import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { ProviderUsersService } from './users.service'
import { CreateUserDto } from '../../common/users/dto/create-user.dto'
import { UpdateUserDto } from '../../common/users/dto/update-user.dto'
import { CommonUsersService } from '../../common/users/users.service'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { PrismaService } from '../../../prisma/prisma.service'

@ApiTags('Provider Users')
@ApiBearerAuth()
@Controller('provider/users')
@UseGuards(RolesOrPermissionsGuard)
export class ProviderUsersController {
  constructor(
    private readonly usersService: CommonUsersService,
    private readonly providerUsersService: ProviderUsersService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  @Permissions('users.create')
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Create a new user for your provider organization',
  })
  async create(@CurrentUser() user: any, @Body() createUserDto: CreateUserDto) {
    const providerId = await this.getProviderIdForUser(user)
    // Validate that all roleIds belong to this provider
    await this.validateRolesBelongToProvider(providerId, createUserDto.roleIds)
    const newUser = await this.usersService.create(createUserDto)
    return ResponseUtil.success(newUser)
  }

  @Get()
  @Permissions('users.read')
  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieve all users in your provider organization with pagination and filtering',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by email, first name, or last name',
  })
  @ApiQuery({ name: 'roleId', required: false, type: String, description: 'Filter by role ID' })
  @ApiQuery({
    name: 'emailVerified',
    required: false,
    type: Boolean,
    description: 'Filter by email verification status',
  })
  @ApiQuery({
    name: 'createdAfter',
    required: false,
    type: String,
    description: 'Filter by creation date (ISO 8601)',
  })
  @ApiQuery({
    name: 'createdBefore',
    required: false,
    type: String,
    description: 'Filter by creation date (ISO 8601)',
  })
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('roleId') roleId?: string,
    @Query('emailVerified') emailVerified?: string,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const result = await this.providerUsersService.findAll(providerId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      roleId,
      emailVerified:
        emailVerified === 'true' ? true : emailVerified === 'false' ? false : undefined,
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
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    const providerId = await this.getProviderIdForUser(user)
    const foundUser = await this.providerUsersService.findOne(providerId, id)
    return ResponseUtil.success(foundUser)
  }

  @Patch(':id')
  @Permissions('users.update')
  @ApiOperation({
    summary: 'Update a user',
    description: 'Update user information and/or role assignments',
  })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    // Verify user belongs to this provider
    await this.providerUsersService.findOne(providerId, id)
    // Validate that all roleIds belong to this provider
    await this.validateRolesBelongToProvider(providerId, updateUserDto.roleIds)
    const updatedUser = await this.usersService.update(id, updateUserDto)
    return ResponseUtil.success(updatedUser)
  }

  @Delete(':id')
  @Permissions('users.delete')
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Delete a user from your provider organization',
  })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    const providerId = await this.getProviderIdForUser(user)
    // Verify user belongs to this provider
    await this.providerUsersService.findOne(providerId, id)
    const result = await this.usersService.remove(id)
    return ResponseUtil.success(result)
  }

  /**
   * Get the provider ID for a user
   * Checks if user is a provider owner OR has a provider-scoped role
   *
   * Note: Provider owners are assigned the "Provider Admin" system role (providerId: null)
   * Regular provider users have provider-scoped roles (providerId: <provider-id>)
   */
  private async getProviderIdForUser(user: any): Promise<string> {
    // User object from @CurrentUser() has this structure:
    // {
    //   id: string,
    //   email: string,
    //   roles: [{ id: string, name: string, providerId: string | null, isSystemRole: boolean }],
    //   permissions: string[]
    // }

    if (!user?.id) {
      throw new NotFoundException('User not found')
    }

    // First, try to find a provider-scoped role (for regular provider users)
    const providerRole = user.roles?.find((role: any) => role.providerId !== null)

    if (providerRole?.providerId) {
      return providerRole.providerId
    }

    // If no provider-scoped role, check if user is a provider owner
    const ownedProvider = await this.prisma.provider.findUnique({
      where: { ownerId: user.id },
      select: { id: true },
    })

    if (ownedProvider) {
      return ownedProvider.id
    }

    // User is neither a provider owner nor has a provider-scoped role
    throw new NotFoundException(
      'Provider not found for this user. User must be a provider owner or have a provider-scoped role to access provider endpoints.'
    )
  }

  private async validateRolesBelongToProvider(providerId: string, roleIds?: string[]) {
    if (!roleIds || roleIds.length === 0) {
      return
    }

    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
      },
      select: {
        id: true,
        providerId: true,
        name: true,
      },
    })

    const invalidRoles = roles.filter(role => role.providerId !== providerId)
    if (invalidRoles.length > 0) {
      throw new NotFoundException(
        `The following roles do not belong to your provider: ${invalidRoles.map(r => r.name).join(', ')}`
      )
    }
  }
}
