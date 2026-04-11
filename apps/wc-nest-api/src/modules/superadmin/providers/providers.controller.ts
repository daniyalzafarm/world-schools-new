import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SuperAdminProvidersService } from './providers.service'
import { CreateProviderDto } from './dto/create-provider.dto'
import { UpdateProviderDto } from './dto/update-provider.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
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

  @Get(':id/detail')
  @Permissions('providers.read')
  @ApiOperation({
    summary: 'Get provider detail with stats',
    description:
      'Retrieve a provider with operational stats, camps, recent bookings, and verification documents',
  })
  async getDetail(@Param('id') id: string) {
    const provider = await this.providersService.getDetail(id)
    return ResponseUtil.success(provider)
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

  @Post('import')
  @Permissions('providers.create')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import providers from CSV',
    description:
      'Upload a CSV file to create multiple provider accounts at once. Each row creates a user, provider, and sends a welcome email with temporary credentials. Max 500 rows, 5 MB.',
  })
  async importProviders(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded')
    }

    const isCsv =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv')

    if (!isCsv) {
      throw new BadRequestException('Only CSV files are accepted')
    }

    const maxBytes = 5 * 1024 * 1024 // 5 MB
    if (file.size > maxBytes) {
      throw new BadRequestException('File size exceeds the 5 MB limit')
    }

    const result = await this.providersService.importFromCsv(file.buffer, user)
    return ResponseUtil.success(result)
  }

  @Post(':id/impersonate')
  @Permissions('providers.read')
  @ApiOperation({
    summary: 'Generate impersonation token for provider',
    description:
      'Generate a short-lived single-use token that allows the superadmin to log into the provider app as the provider owner. Token expires in 60 seconds.',
  })
  async impersonate(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.providersService.generateImpersonationToken(id, user)
    return ResponseUtil.success(result)
  }
}
