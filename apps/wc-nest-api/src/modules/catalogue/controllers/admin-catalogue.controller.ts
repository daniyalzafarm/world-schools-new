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

// Admin / superadmin catalogue management endpoints.
// Route prefix is aligned with other admin-style controllers.
@Controller('superadmin/catalogue')
@UseGuards(RolesOrPermissionsGuard)
export class AdminCatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Get('categories')
  async getCategories(): Promise<AdminCategoryWithActivitiesDto[]> {
    return this.catalogueService.getAdminCategories()
  }

  @Get('categories/check-slug/:slug')
  async checkCategorySlug(@Param('slug') slug: string, @Query('categoryId') categoryId?: string) {
    return this.catalogueService.checkCategorySlugAvailability(slug, categoryId)
  }

  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto): Promise<AdminCategoryWithActivitiesDto> {
    return this.catalogueService.createCategory(dto)
  }

  @Patch('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto
  ): Promise<AdminCategoryWithActivitiesDto> {
    return this.catalogueService.updateCategory(id, dto)
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string): Promise<void> {
    return this.catalogueService.deleteCategory(id)
  }

  @Post('categories/:id/activities')
  async addActivity(@Param('id') categoryId: string, @Body() dto: CreateActivityDto) {
    return this.catalogueService.addActivityToCategory(categoryId, dto)
  }

  @Get('activities/check-slug/:slug')
  async checkActivitySlug(
    @Param('slug') slug: string,
    @Query('categoryId') categoryId: string,
    @Query('activityId') activityId?: string
  ) {
    return this.catalogueService.checkActivitySlugAvailability(slug, categoryId, activityId)
  }

  @Patch('activities/:id')
  async updateActivity(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.catalogueService.updateActivity(id, dto)
  }

  @Delete('activities/:id')
  async deleteActivity(@Param('id') id: string): Promise<void> {
    return this.catalogueService.deleteActivity(id)
  }

  @Get('scales')
  async getScales() {
    return this.catalogueService.getScalesWithUsage()
  }

  @Get('scales/check-id/:id')
  async checkScaleId(@Param('id') id: string) {
    return this.catalogueService.checkScaleIdAvailability(id)
  }

  @Get('scales/:id')
  async getScale(@Param('id') id: string) {
    return this.catalogueService.getScaleWithUsage(id)
  }

  @Post('scales')
  async createScale(@Body() dto: CreateScaleDto) {
    return this.catalogueService.createScale(dto)
  }

  @Patch('scales/:id')
  async updateScale(@Param('id') id: string, @Body() dto: UpdateScaleDto) {
    return this.catalogueService.updateScale(id, dto)
  }

  @Delete('scales/:id')
  async deleteScale(@Param('id') id: string): Promise<void> {
    return this.catalogueService.deleteScale(id)
  }
}
