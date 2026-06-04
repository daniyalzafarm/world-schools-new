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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { PrismaService } from '../../../prisma/prisma.service'
import { CampsService } from './camps.service'
import { CreateCampDto, UpdateCampAudienceDto, UpdateCampProgramsDto } from './dto/create-camp.dto'
import {
  UpdateAcademicsDto,
  UpdateAccommodationDto,
  UpdateAdventureDto,
  UpdateArtsDto,
  UpdateBasicInfoDto,
  UpdateCampFocusDto,
  UpdateCampStatusDto,
  UpdateDailyScheduleDto,
  UpdateEnvironmentalDto,
  UpdateExcursionsDto,
  UpdateGettingThereDto,
  UpdateLanguagesDto,
  UpdateLocationCampusDto,
  UpdateMealsDto,
  UpdatePhotosDto,
  UpdateReligionDto,
  UpdateSafetyPoliciesDto,
  UpdateSportsDto,
  UpdateWaterDto,
  UpdateWhatsIncludedDto,
} from './dto/update-camp.dto'
import { GetCampsFiltersDto } from './dto/get-camps-filters.dto'
import { UpdateCampAddOnsDto } from './dto/update-camp-addons.dto'
import {
  PutCampEligibilityDto,
  PutCampFocusBodyDto,
  PutCampInterestsDto,
} from './dto/camp-catalogue.dto'

@Controller('provider/camps')
@UseGuards(RolesOrPermissionsGuard)
export class CampsController {
  constructor(
    private readonly campsService: CampsService,
    private readonly prisma: PrismaService
  ) {}

  // ============================================
  // Wizard Endpoints
  // ============================================

  /**
   * Check if a slug is available
   */
  @Get('check-slug/:slug')
  @Permissions('camps.create', 'camps.update')
  @HttpCode(HttpStatus.OK)
  async checkSlugAvailability(@Param('slug') slug: string, @Query('campId') campId?: string) {
    const existingCamp = await this.prisma.camp.findUnique({
      where: { slug },
      select: { id: true },
    })

    // If no camp found with this slug, it's available
    if (!existingCamp) {
      return ResponseUtil.success({ available: true })
    }

    // If a campId is provided and it matches the existing camp, it's available (same camp)
    if (campId && existingCamp.id === campId) {
      return ResponseUtil.success({ available: true })
    }

    // Slug is taken by another camp
    return ResponseUtil.success({ available: false })
  }

  /**
   * Generate a preview token for a camp
   * Allows providers to preview unpublished camps in the booking app
   */
  @Get(':campId/preview-token')
  @Permissions('camps.read')
  @HttpCode(HttpStatus.OK)
  async generatePreviewToken(@Param('campId') campId: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const token = await this.campsService.generatePreviewToken(campId, providerId)
    return ResponseUtil.success({ token })
  }

  /**
   * Create camp with basic info (Wizard Step 1)
   */
  @Post('create/basic-info')
  @Permissions('camps.create')
  @HttpCode(HttpStatus.CREATED)
  async createCamp(@CurrentUser() user: any, @Body() dto: CreateCampDto) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.createCamp(providerId, dto)
    return ResponseUtil.success({ camp })
  }

  /**
   * Update camp audience (Wizard Step 2)
   */
  @Patch(':id/create/audience')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateCampAudience(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCampAudienceDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateCampAudience(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  /**
   * Update camp programs (Wizard Step 3)
   */
  @Patch(':id/create/programs')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateCampPrograms(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCampProgramsDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateCampPrograms(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  /**
   * Update camp photos (Wizard Step 4)
   * Supports both file uploads and metadata updates
   */
  @Patch(':id/create/photos')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('photos', 20)) // Max 20 photos
  async updateCampPhotos(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() body: any,
    @UploadedFiles() files?: Array<any>
  ) {
    const providerId = await this.getProviderIdForUser(user)

    // Parse existing photos from body if provided
    let existingPhotos = []
    if (body.existingPhotos) {
      try {
        existingPhotos =
          typeof body.existingPhotos === 'string'
            ? JSON.parse(body.existingPhotos)
            : body.existingPhotos
      } catch (error) {
        existingPhotos = []
      }
    }

    const camp = await this.campsService.updateCampPhotos(
      campId,
      providerId,
      files ?? [],
      existingPhotos
    )
    return ResponseUtil.success({ camp })
  }

  /**
   * Publish camp
   */
  @Post(':id/publish')
  @Permissions('camps.publish')
  @HttpCode(HttpStatus.OK)
  async publishCamp(@Param('id') campId: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.publishCamp(campId, providerId)
    return ResponseUtil.success({ camp })
  }

  // ============================================
  // Camp Management Endpoints
  // ============================================

  /**
   * Get camp statistics
   */
  @Get('statistics')
  @Permissions('camps.read')
  @HttpCode(HttpStatus.OK)
  async getCampStatistics(@CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const stats = await this.campsService.getCampStatistics(providerId)
    return ResponseUtil.success({ stats })
  }

  /**
   * Get all camps with search and filtering
   */
  @Get()
  @Permissions('camps.read')
  @HttpCode(HttpStatus.OK)
  async getCamps(@CurrentUser() user: any, @Query() filters: GetCampsFiltersDto) {
    const providerId = await this.getProviderIdForUser(user)
    const camps = await this.campsService.getCamps(providerId, filters)
    return ResponseUtil.success({ camps })
  }

  /**
   * Get single camp
   */
  @Get(':id')
  @Permissions('camps.read')
  @HttpCode(HttpStatus.OK)
  async getCamp(@Param('id') campId: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.getCamp(campId, providerId)
    return ResponseUtil.success({ camp })
  }

  /**
   * Get camp focus (catalogue primary activity)
   */
  @Get(':id/focus')
  @Permissions('camps.read')
  @HttpCode(HttpStatus.OK)
  async getCampFocus(@Param('id') campId: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const result = await this.campsService.getCampFocus(campId, providerId)
    return ResponseUtil.success(result)
  }

  /**
   * Set or clear camp focus (catalogue primary activity)
   */
  @Patch(':id/focus')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async putCampFocus(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: PutCampFocusBodyDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const result = await this.campsService.putCampFocus(campId, providerId, dto)
    return ResponseUtil.success(result)
  }

  /**
   * Get camp interests (catalogue categories + activities)
   */
  @Get(':id/interests')
  @Permissions('camps.read')
  @HttpCode(HttpStatus.OK)
  async getCampInterests(@Param('id') campId: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const result = await this.campsService.getCampInterests(campId, providerId)
    return ResponseUtil.success(result)
  }

  /**
   * Replace camp interests
   */
  @Patch(':id/interests')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async putCampInterests(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: PutCampInterestsDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const result = await this.campsService.putCampInterests(campId, providerId, dto)
    return ResponseUtil.success(result)
  }

  /**
   * Get camp eligibility requirements (skill requirements)
   */
  @Get(':id/eligibility')
  @Permissions('camps.read')
  @HttpCode(HttpStatus.OK)
  async getCampEligibility(@Param('id') campId: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const result = await this.campsService.getCampEligibility(campId, providerId)
    return ResponseUtil.success(result)
  }

  /**
   * Replace camp eligibility requirements
   */
  @Patch(':id/eligibility')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async putCampEligibility(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: PutCampEligibilityDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const result = await this.campsService.putCampEligibility(campId, providerId, dto)
    return ResponseUtil.success(result)
  }

  /**
   * Archive a camp
   */
  @Post(':id/archive')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async archiveCamp(@Param('id') campId: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.archiveCamp(campId, providerId)
    return ResponseUtil.success({ camp })
  }

  /**
   * Duplicate a camp
   */
  @Post(':id/duplicate')
  @Permissions('camps.create')
  @HttpCode(HttpStatus.OK)
  async duplicateCamp(@Param('id') campId: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.duplicateCamp(campId, providerId)
    return ResponseUtil.success({ camp })
  }

  /**
   * Delete camp
   */
  @Delete(':id')
  @Permissions('camps.delete')
  @HttpCode(HttpStatus.OK)
  async deleteCamp(@Param('id') campId: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const result = await this.campsService.deleteCamp(campId, providerId)
    return ResponseUtil.success(result)
  }

  // ============================================
  // Editor Endpoints
  // ============================================

  /**
   * Update basic info
   */
  @Patch(':id/basic-info')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateBasicInfo(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateBasicInfoDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateBasicInfo(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/photos')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updatePhotos(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdatePhotosDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updatePhotos(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/whats-included')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateWhatsIncluded(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateWhatsIncludedDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateWhatsIncluded(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/daily-schedule')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateDailySchedule(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateDailyScheduleDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateDailySchedule(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/meals')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateMeals(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateMealsDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateMeals(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/sports')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateSports(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateSportsDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateSports(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/languages')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateLanguages(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateLanguagesDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateLanguages(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/arts')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateArts(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateArtsDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateArts(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/adventure')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateAdventure(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateAdventureDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateAdventure(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/water')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateWater(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateWaterDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateWater(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/environmental')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateEnvironmental(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateEnvironmentalDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateEnvironmental(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/academics')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateAcademics(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateAcademicsDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateAcademics(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/religion')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateReligion(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateReligionDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateReligion(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/excursions')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateExcursions(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateExcursionsDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateExcursions(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/location-campus')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateLocationCampus(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateLocationCampusDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateLocationCampus(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/accommodation')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateAccommodation(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateAccommodationDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateAccommodation(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/getting-there')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateGettingThere(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateGettingThereDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateGettingThere(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/camp-focus')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateCampFocus(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCampFocusDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateCampFocus(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/status')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateCampStatus(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCampStatusDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateCampStatus(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  @Patch(':id/safety-policies')
  @Permissions('camps.update')
  @HttpCode(HttpStatus.OK)
  async updateSafetyPolicies(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateSafetyPoliciesDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const camp = await this.campsService.updateSafetyPolicies(campId, providerId, dto)
    return ResponseUtil.success({ camp })
  }

  // ============================================
  // Camp Add-ons Endpoints
  // ============================================

  /**
   * Get camp add-ons with enabled status
   */
  @Get(':id/addons')
  @Permissions('addons.read')
  @HttpCode(HttpStatus.OK)
  async getCampAddOns(@Param('id') campId: string, @CurrentUser() user: any) {
    const providerId = await this.getProviderIdForUser(user)
    const addOns = await this.campsService.getCampAddOns(campId, providerId)
    return ResponseUtil.success({ addOns })
  }

  /**
   * Update camp add-ons (enable/disable and reorder)
   */
  @Patch(':id/addons')
  @Permissions('addons.update')
  @HttpCode(HttpStatus.OK)
  async updateCampAddOns(
    @Param('id') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCampAddOnsDto
  ) {
    const providerId = await this.getProviderIdForUser(user)
    const result = await this.campsService.updateCampAddOns(campId, providerId, dto)
    return ResponseUtil.success(result)
  }

  /**
   * Helper method to get provider ID from user
   */
  private async getProviderIdForUser(user: any): Promise<string> {
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
}
