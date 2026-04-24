import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { PrismaService } from '../../../prisma/prisma.service'
import { AddOnsService } from './add-ons.service'
import { CreateAddOnDto } from './dto/create-add-on.dto'
import { UpdateAddOnDto } from './dto/update-add-on.dto'
import { QueryAddOnsDto } from './dto/query-add-ons.dto'

@ApiTags('Provider Add-ons')
@ApiBearerAuth()
@Controller('provider/add-ons')
@UseGuards(RolesOrPermissionsGuard)
export class AddOnsController {
  constructor(
    private readonly addOnsService: AddOnsService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Create a new add-on
   */
  @Post()
  @Permissions('addons.create', 'camps.create', 'camps.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new add-on' })
  @ApiResponse({ status: 201, description: 'Add-on created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@CurrentUser() user: any, @Body() dto: CreateAddOnDto) {
    const providerId = await this.getProviderIdForUser(user)
    const addOn = await this.addOnsService.create(providerId, dto)
    return ResponseUtil.success({ addOn })
  }

  /**
   * Get all add-ons for the provider
   */
  @Get()
  @Permissions(
    'addons.read',
    'addons.create',
    'addons.update',
    'camps.read',
    'camps.create',
    'camps.update'
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all add-ons' })
  @ApiResponse({ status: 200, description: 'Add-ons retrieved successfully' })
  async findAll(@CurrentUser() user: any, @Query() query: QueryAddOnsDto) {
    const providerId = await this.getProviderIdForUser(user)
    const result = await this.addOnsService.findAll(providerId, query)
    return ResponseUtil.success({ addOns: result.data }, result.meta)
  }

  /**
   * Get a single add-on
   */
  @Get(':id')
  @Permissions(
    'addons.read',
    'addons.create',
    'addons.update',
    'camps.read',
    'camps.create',
    'camps.update'
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single add-on' })
  @ApiResponse({ status: 200, description: 'Add-on retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Add-on not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const addOn = await this.addOnsService.findOne(id, providerId)
    return ResponseUtil.success({ addOn })
  }

  /**
   * Update an add-on
   */
  @Patch(':id')
  @Permissions('addons.update', 'camps.create', 'camps.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an add-on' })
  @ApiResponse({ status: 200, description: 'Add-on updated successfully' })
  @ApiResponse({ status: 404, description: 'Add-on not found' })
  async update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateAddOnDto) {
    const providerId = await this.getProviderIdForUser(user)
    const addOn = await this.addOnsService.update(id, providerId, dto)
    return ResponseUtil.success({ addOn })
  }

  /**
   * Delete an add-on
   */
  @Delete(':id')
  @Permissions('addons.delete', 'camps.create', 'camps.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an add-on' })
  @ApiResponse({ status: 200, description: 'Add-on deleted successfully' })
  @ApiResponse({ status: 404, description: 'Add-on not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const result = await this.addOnsService.remove(id, providerId)
    return ResponseUtil.success(result)
  }

  /**
   * Helper method to get provider ID for the current user
   */
  private async getProviderIdForUser(user: any): Promise<string> {
    const provider = await this.prisma.provider.findUnique({
      where: { ownerId: user.id },
      select: { id: true },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found for this user')
    }

    return provider.id
  }
}
