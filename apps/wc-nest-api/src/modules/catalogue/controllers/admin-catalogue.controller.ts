import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CatalogueService } from '../services/catalogue.service'
import {
  AdminCategoryWithActivitiesDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../dto/catalogue-category.dto'
import { CreateActivityDto, UpdateActivityDto } from '../dto/catalogue-activity.dto'
import { CreateScaleDto, UpdateScaleDto } from '../dto/catalogue-scale-admin.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'

// Admin / superadmin catalogue management endpoints.
// Route prefix is aligned with other admin-style controllers.
@Controller('superadmin/catalogue')
@UseGuards(RolesOrPermissionsGuard)
export class AdminCatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Get('categories')
  @Permissions('catalogue.read')
  async getCategories(): Promise<AdminCategoryWithActivitiesDto[]> {
    return this.catalogueService.getAdminCategories()
  }

  @Get('categories/check-slug/:slug')
  @Permissions('catalogue.read')
  async checkCategorySlug(@Param('slug') slug: string, @Query('categoryId') categoryId?: string) {
    return this.catalogueService.checkCategorySlugAvailability(slug, categoryId)
  }

  @Post('categories')
  @Permissions('catalogue.create')
  async createCategory(@Body() dto: CreateCategoryDto): Promise<AdminCategoryWithActivitiesDto> {
    return this.catalogueService.createCategory(dto)
  }

  @Patch('categories/:id')
  @Permissions('catalogue.update')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto
  ): Promise<AdminCategoryWithActivitiesDto> {
    return this.catalogueService.updateCategory(id, dto)
  }

  @Delete('categories/:id')
  @Permissions('catalogue.delete')
  async deleteCategory(@Param('id') id: string): Promise<void> {
    return this.catalogueService.deleteCategory(id)
  }

  @Post('categories/:id/activities')
  @Permissions('catalogue.create')
  async addActivity(@Param('id') categoryId: string, @Body() dto: CreateActivityDto) {
    return this.catalogueService.addActivityToCategory(categoryId, dto)
  }

  @Get('activities/check-slug/:slug')
  @Permissions('catalogue.read')
  async checkActivitySlug(
    @Param('slug') slug: string,
    @Query('categoryId') categoryId: string,
    @Query('activityId') activityId?: string
  ) {
    return this.catalogueService.checkActivitySlugAvailability(slug, categoryId, activityId)
  }

  @Patch('activities/:id')
  @Permissions('catalogue.update')
  async updateActivity(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.catalogueService.updateActivity(id, dto)
  }

  @Delete('activities/:id')
  @Permissions('catalogue.delete')
  async deleteActivity(@Param('id') id: string): Promise<void> {
    return this.catalogueService.deleteActivity(id)
  }

  @Get('scales')
  @Permissions('catalogue.read')
  async getScales() {
    return this.catalogueService.getScalesWithUsage()
  }

  @Get('scales/check-id/:id')
  @Permissions('catalogue.read')
  async checkScaleId(@Param('id') id: string) {
    return this.catalogueService.checkScaleIdAvailability(id)
  }

  @Get('scales/:id')
  @Permissions('catalogue.read')
  async getScale(@Param('id') id: string) {
    return this.catalogueService.getScaleWithUsage(id)
  }

  @Post('scales')
  @Permissions('catalogue.create')
  async createScale(@Body() dto: CreateScaleDto) {
    return this.catalogueService.createScale(dto)
  }

  @Patch('scales/:id')
  @Permissions('catalogue.update')
  async updateScale(@Param('id') id: string, @Body() dto: UpdateScaleDto) {
    return this.catalogueService.updateScale(id, dto)
  }

  @Delete('scales/:id')
  @Permissions('catalogue.delete')
  async deleteScale(@Param('id') id: string): Promise<void> {
    return this.catalogueService.deleteScale(id)
  }
}
