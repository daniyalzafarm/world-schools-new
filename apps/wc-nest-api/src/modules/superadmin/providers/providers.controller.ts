import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SuperAdminProvidersService } from './providers.service'
import { CreateProviderDto } from './dto/create-provider.dto'
import { UpdateProviderDto } from './dto/update-provider.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

@ApiTags('SuperAdmin Providers')
@ApiBearerAuth()
@Controller('superadmin/providers')
@UseGuards(RolesOrPermissionsGuard)
export class SuperAdminProvidersController {
  constructor(private readonly providersService: SuperAdminProvidersService) {}

  @Post()
  @Permissions('providers.create')
  @ApiOperation({
    summary: 'Create a new provider',
    description: 'Create a new provider (school/organization) with an owner',
  })
  async create(@Body() createProviderDto: CreateProviderDto) {
    const provider = await this.providersService.create(createProviderDto)
    return ResponseUtil.success(provider)
  }

  @Get()
  @Permissions('providers.read')
  @ApiOperation({
    summary: 'Get all providers',
    description: 'Retrieve all providers with their owners and counts',
  })
  async findAll() {
    const providers = await this.providersService.findAll()
    return ResponseUtil.success(providers)
  }

  @Get(':id')
  @Permissions('providers.read')
  @ApiOperation({
    summary: 'Get a provider by ID',
    description: 'Retrieve a specific provider with details',
  })
  async findOne(@Param('id') id: string) {
    const provider = await this.providersService.findOne(id)
    return ResponseUtil.success(provider)
  }

  @Patch(':id')
  @Permissions('providers.update')
  @ApiOperation({
    summary: 'Update a provider',
    description: 'Update provider information',
  })
  async update(@Param('id') id: string, @Body() updateProviderDto: UpdateProviderDto) {
    const provider = await this.providersService.update(id, updateProviderDto)
    return ResponseUtil.success(provider)
  }

  @Delete(':id')
  @Permissions('providers.delete')
  @ApiOperation({
    summary: 'Delete a provider',
    description: 'Delete a provider if it has no parents or children enrolled',
  })
  async remove(@Param('id') id: string) {
    const result = await this.providersService.remove(id)
    return ResponseUtil.success(result)
  }
}
