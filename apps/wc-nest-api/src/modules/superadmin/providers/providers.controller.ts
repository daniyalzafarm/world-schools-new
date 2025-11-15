import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SuperAdminProvidersService } from './providers.service'
import { CreateProviderDto } from './dto/create-provider.dto'
import { UpdateProviderDto } from './dto/update-provider.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

@ApiTags('SuperAdmin Providers')
@ApiBearerAuth()
@Controller('superadmin/providers')
@UseGuards(RolesOrPermissionsGuard)
@Roles('Super Admin')
export class SuperAdminProvidersController {
  constructor(private readonly providersService: SuperAdminProvidersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new provider',
    description: 'Create a new provider (school/organization) with an owner',
  })
  async create(@Body() createProviderDto: CreateProviderDto) {
    const provider = await this.providersService.create(createProviderDto)
    return ResponseUtil.success(provider, 'Provider created successfully')
  }

  @Get()
  @ApiOperation({
    summary: 'Get all providers',
    description: 'Retrieve all providers with their owners and counts',
  })
  async findAll() {
    const providers = await this.providersService.findAll()
    return ResponseUtil.success(providers, 'Providers retrieved successfully')
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a provider by ID',
    description: 'Retrieve a specific provider with details',
  })
  async findOne(@Param('id') id: string) {
    const provider = await this.providersService.findOne(id)
    return ResponseUtil.success(provider, 'Provider retrieved successfully')
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a provider',
    description: 'Update provider information',
  })
  async update(@Param('id') id: string, @Body() updateProviderDto: UpdateProviderDto) {
    const provider = await this.providersService.update(id, updateProviderDto)
    return ResponseUtil.success(provider, 'Provider updated successfully')
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a provider',
    description: 'Delete a provider if it has no parents or children enrolled',
  })
  async remove(@Param('id') id: string) {
    const result = await this.providersService.remove(id)
    return ResponseUtil.success(result, result.message)
  }
}
