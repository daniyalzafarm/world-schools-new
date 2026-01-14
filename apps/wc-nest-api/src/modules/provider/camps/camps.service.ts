import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
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
  UpdateSportsDto,
  UpdateWaterDto,
  UpdateWhatsIncludedDto,
} from './dto/update-camp.dto'
import { UpdateCampAddOnsDto } from './dto/update-camp-addons.dto'
import { PhotoUploadService } from './services/photo-upload.service'
import { GetCampsFiltersDto } from './dto/get-camps-filters.dto'

@Injectable()
export class CampsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photoUploadService: PhotoUploadService
  ) {}

  /**
   * Create a new camp with basic info (Wizard Step 1)
   */
  async createCamp(providerId: string, dto: CreateCampDto) {
    // Validate location data
    if (dto.locationType === 'different' && !dto.locationPlaceId) {
      throw new BadRequestException('Location place ID is required when using different location')
    }

    // Prepare location data
    let locationData = {
      locationPlaceId: dto.locationPlaceId,
      locationName: dto.locationName,
      locationAddress: dto.locationAddress,
      locationLat: dto.locationLat,
      locationLng: dto.locationLng,
    }

    // If using provider location, populate from Google Business Profile
    if (dto.locationType === 'provider') {
      const googleProfile = await this.prisma.googleBusinessProfile.findUnique({
        where: { providerId },
      })

      if (googleProfile) {
        locationData = {
          locationPlaceId: googleProfile.placeId,
          locationName: googleProfile.businessName,
          locationAddress: googleProfile.formattedAddress,
          locationLat: Number(googleProfile.lat),
          locationLng: Number(googleProfile.lng),
        }
      }
    }

    const camp = await this.prisma.camp.create({
      data: {
        providerId,
        name: dto.name,
        type: dto.type,
        description: dto.description,
        locationType: dto.locationType,
        ...locationData,
        // Initialize with empty arrays for required fields
        ageGroups: [],
        languages: [],
        gender: 'coed',
        activities: [],
        status: 'draft',
      },
    })

    return camp
  }

  /**
   * Update camp audience (Wizard Step 2)
   */
  async updateCampAudience(campId: string, providerId: string, dto: UpdateCampAudienceDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate age groups
    for (const group of dto.ageGroups) {
      if (group.max <= group.min) {
        throw new BadRequestException('Max age must be greater than min age')
      }
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: {
        ageGroups: dto.ageGroups as any,
        languages: dto.languages,
        gender: dto.gender,
      },
    })

    return camp
  }

  /**
   * Update camp programs (Wizard Step 3)
   */
  async updateCampPrograms(campId: string, providerId: string, dto: UpdateCampProgramsDto) {
    await this.verifyCampOwnership(campId, providerId)

    if (dto.activities.length === 0) {
      throw new BadRequestException('At least one activity must be selected')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: {
        activities: dto.activities,
      },
    })

    return camp
  }

  /**
   * Update camp photos with file uploads
   */
  async updateCampPhotos(
    campId: string,
    providerId: string,
    files: Array<any>,
    existingPhotos: any[] = []
  ) {
    await this.verifyCampOwnership(campId, providerId)

    // Get current camp to check existing photos
    const currentCamp = await this.prisma.camp.findUnique({
      where: { id: campId },
      select: { photos: true },
    })

    // IMPORTANT: Sanitize existing photos to extract blob names from SAS URLs
    // The frontend sends photos with SAS URLs (from previous getCamp calls).
    // We must extract blob names before saving to maintain data integrity.
    // This is the ONLY place where URL sanitization should occur - all other
    // methods expect clean blob names in the database.
    const sanitizedExistingPhotos = existingPhotos.map(photo => ({
      ...photo,
      url: this.photoUploadService.extractBlobName(photo.url),
      thumbnail: this.photoUploadService.extractBlobName(photo.thumbnail || photo.url),
    }))

    let allPhotos = [...sanitizedExistingPhotos]

    // Upload new files if provided
    if (files && files.length > 0) {
      const uploadedPhotos = await this.photoUploadService.uploadPhotos(
        campId,
        providerId,
        files,
        sanitizedExistingPhotos
      )
      allPhotos = [...sanitizedExistingPhotos, ...uploadedPhotos]
    }

    // Validate minimum 5 photos requirement
    if (allPhotos.length < 5) {
      throw new BadRequestException('At least 5 photos are required')
    }

    // Update order and isPrimary flags
    const photosWithMetadata = allPhotos.map((photo, index) => ({
      ...photo,
      order: index,
      isPrimary: index === 0,
    }))

    // Delete photos that were removed (in currentCamp but not in allPhotos)
    if (currentCamp?.photos && Array.isArray(currentCamp.photos)) {
      const currentPhotoIds = new Set(allPhotos.map((p: any) => p.id))
      const photosToDelete = (currentCamp.photos as any[]).filter(
        (p: any) => !currentPhotoIds.has(p.id)
      )

      if (photosToDelete.length > 0) {
        await this.photoUploadService.deletePhotos(photosToDelete)
      }
    }

    // Update camp with new photos
    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: {
        photos: photosWithMetadata as any,
      },
    })

    return camp
  }

  /**
   * Publish camp (validates all required fields)
   */
  async publishCamp(campId: string, providerId: string) {
    const camp = await this.verifyCampOwnership(campId, providerId)

    // Validate required fields
    if (!camp.ageGroups || (camp.ageGroups as any[]).length === 0) {
      throw new BadRequestException('Age groups are required')
    }
    if (!camp.languages || camp.languages.length === 0) {
      throw new BadRequestException('Languages are required')
    }
    if (!camp.activities || camp.activities.length === 0) {
      throw new BadRequestException('Activities are required')
    }

    const updatedCamp = await this.prisma.camp.update({
      where: { id: campId },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    })

    return updatedCamp
  }

  /**
   * Get all camps for a provider with search and filtering
   */
  async getCamps(providerId: string, filters?: GetCampsFiltersDto) {
    const where: any = { providerId }

    // Status filter
    if (filters?.status) {
      where.status = filters.status
    }

    // Type filter
    if (filters?.type) {
      where.type = filters.type
    }

    // Location filter (search in locationName and locationAddress)
    if (filters?.location) {
      where.OR = [
        { locationName: { contains: filters.location, mode: 'insensitive' } },
        { locationAddress: { contains: filters.location, mode: 'insensitive' } },
      ]
    }

    // Search filter (search across name, description, locationName, locationAddress)
    if (filters?.search) {
      const searchConditions = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { locationName: { contains: filters.search, mode: 'insensitive' } },
        { locationAddress: { contains: filters.search, mode: 'insensitive' } },
      ]

      // If location filter is already applied, combine with AND
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }]
        delete where.OR
      } else {
        where.OR = searchConditions
      }
    }

    const camps = await this.prisma.camp.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // Generate SAS URLs for photos
    const campsWithPhotoUrls = await Promise.all(
      camps.map(async camp => {
        if (camp.photos && Array.isArray(camp.photos) && camp.photos.length > 0) {
          const photosWithUrls = await this.photoUploadService.generatePhotoUrls(
            camp.photos as any[]
          )
          return {
            ...camp,
            photos: photosWithUrls,
          }
        }
        return camp
      })
    )

    return campsWithPhotoUrls
  }

  /**
   * Get a single camp
   */
  async getCamp(campId: string, providerId: string) {
    const camp = await this.verifyCampOwnership(campId, providerId)

    // Generate SAS URLs for photos if they exist
    if (camp.photos && Array.isArray(camp.photos) && camp.photos.length > 0) {
      const photosWithUrls = await this.photoUploadService.generatePhotoUrls(camp.photos as any[])
      return { ...camp, photos: photosWithUrls }
    }

    return camp
  }

  /**
   * Delete a camp
   */
  async deleteCamp(campId: string, providerId: string) {
    await this.verifyCampOwnership(campId, providerId)

    await this.prisma.camp.delete({
      where: { id: campId },
    })

    return { message: 'Camp deleted successfully' }
  }

  /**
   * Update basic info (Editor)
   */
  async updateBasicInfo(campId: string, providerId: string, dto: UpdateBasicInfoDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Prepare update data
    const updateData: any = { ...dto }

    // If changing to provider location, populate from Google Business Profile
    if (dto.locationType === 'provider') {
      const googleProfile = await this.prisma.googleBusinessProfile.findUnique({
        where: { providerId },
      })

      if (googleProfile) {
        updateData.locationPlaceId = googleProfile.placeId
        updateData.locationName = googleProfile.businessName
        updateData.locationAddress = googleProfile.formattedAddress
        updateData.locationLat = Number(googleProfile.lat)
        updateData.locationLng = Number(googleProfile.lng)
      }
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: updateData,
    })

    return camp
  }

  /**
   * Update photos (Editor)
   */
  async updatePhotos(campId: string, providerId: string, dto: UpdatePhotosDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { photos: dto.photos as any },
    })

    return camp
  }

  /**
   * Update what's included
   */
  async updateWhatsIncluded(campId: string, providerId: string, dto: UpdateWhatsIncludedDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { whatsIncluded: dto.whatsIncluded },
    })

    return camp
  }

  /**
   * Update daily schedule
   */
  async updateDailySchedule(campId: string, providerId: string, dto: UpdateDailyScheduleDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { dailySchedule: dto.dailySchedule },
    })

    return camp
  }

  /**
   * Update meals
   */
  async updateMeals(campId: string, providerId: string, dto: UpdateMealsDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.meals) {
      this.validateActivityData(dto.meals, 'meals')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { meals: dto.meals as any },
    })

    return camp
  }

  /**
   * Update sports activities
   */
  async updateSports(campId: string, providerId: string, dto: UpdateSportsDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.sportsActivities) {
      this.validateActivityData(dto.sportsActivities, 'sports')
      this.validateArrayField(dto.sportsActivities.selectedSports, 'selectedSports')
      this.validateArrayField(dto.sportsActivities.customSports, 'customSports')
      this.validateArrayField(dto.sportsActivities.facilities, 'facilities')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { sportsActivities: dto.sportsActivities as any },
    })

    return camp
  }

  /**
   * Update language programs
   */
  async updateLanguages(campId: string, providerId: string, dto: UpdateLanguagesDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.languagePrograms) {
      this.validateActivityData(dto.languagePrograms, 'languages')
      this.validateArrayField(dto.languagePrograms.selectedLanguages, 'selectedLanguages')
      this.validateArrayField(dto.languagePrograms.customLanguages, 'customLanguages')
      this.validateArrayField(dto.languagePrograms.certificates, 'certificates')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { languagePrograms: dto.languagePrograms as any },
    })

    return camp
  }

  /**
   * Update arts and crafts
   */
  async updateArts(campId: string, providerId: string, dto: UpdateArtsDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.artsAndCrafts) {
      this.validateActivityData(dto.artsAndCrafts, 'arts')
      this.validateArrayField(dto.artsAndCrafts.selectedArts, 'selectedArts')
      this.validateArrayField(dto.artsAndCrafts.customArts, 'customArts')
      this.validateArrayField(dto.artsAndCrafts.supplies, 'supplies')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { artsAndCrafts: dto.artsAndCrafts as any },
    })

    return camp
  }

  /**
   * Update adventure activities
   */
  async updateAdventure(campId: string, providerId: string, dto: UpdateAdventureDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.adventureActivities) {
      this.validateActivityData(dto.adventureActivities, 'adventure')
      this.validateArrayField(dto.adventureActivities.selectedActivities, 'selectedActivities')
      this.validateArrayField(dto.adventureActivities.customActivities, 'customActivities')
      this.validateArrayField(dto.adventureActivities.certifications, 'certifications')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { adventureActivities: dto.adventureActivities as any },
    })

    return camp
  }

  /**
   * Update water activities
   */
  async updateWater(campId: string, providerId: string, dto: UpdateWaterDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.waterActivities) {
      this.validateActivityData(dto.waterActivities, 'water')
      this.validateArrayField(dto.waterActivities.selectedActivities, 'selectedActivities')
      this.validateArrayField(dto.waterActivities.customActivities, 'customActivities')
      this.validateArrayField(dto.waterActivities.facilities, 'facilities')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { waterActivities: dto.waterActivities as any },
    })

    return camp
  }

  /**
   * Update environmental activities
   */
  async updateEnvironmental(campId: string, providerId: string, dto: UpdateEnvironmentalDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.environmentalActivities) {
      this.validateActivityData(dto.environmentalActivities, 'environmental')
      this.validateArrayField(dto.environmentalActivities.selectedActivities, 'selectedActivities')
      this.validateArrayField(dto.environmentalActivities.customActivities, 'customActivities')
      this.validateArrayField(dto.environmentalActivities.certifications, 'certifications')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { environmentalActivities: dto.environmentalActivities as any },
    })

    return camp
  }

  /**
   * Update academics
   */
  async updateAcademics(campId: string, providerId: string, dto: UpdateAcademicsDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.academics) {
      this.validateActivityData(dto.academics, 'academics')
      this.validateArrayField(dto.academics.selectedSubjects, 'selectedSubjects')
      this.validateArrayField(dto.academics.customSubjects, 'customSubjects')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { academics: dto.academics as any },
    })

    return camp
  }

  /**
   * Update religion programs
   */
  async updateReligion(campId: string, providerId: string, dto: UpdateReligionDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.religionPrograms) {
      this.validateActivityData(dto.religionPrograms, 'religion')
      this.validateArrayField(dto.religionPrograms.selectedPrograms, 'selectedPrograms')
      this.validateArrayField(dto.religionPrograms.customPrograms, 'customPrograms')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { religionPrograms: dto.religionPrograms as any },
    })

    return camp
  }

  /**
   * Update excursions and trips
   */
  async updateExcursions(campId: string, providerId: string, dto: UpdateExcursionsDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.excursionsTrips) {
      this.validateActivityData(dto.excursionsTrips, 'excursions')
      this.validateArrayField(dto.excursionsTrips.selectedTrips, 'selectedTrips')
      this.validateArrayField(dto.excursionsTrips.customTrips, 'customTrips')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { excursionsTrips: dto.excursionsTrips as any },
    })

    return camp
  }

  /**
   * Update location and campus
   */
  async updateLocationCampus(campId: string, providerId: string, dto: UpdateLocationCampusDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.campusFacilities) {
      this.validateActivityData(dto.campusFacilities, 'location')
      this.validateArrayField(dto.campusFacilities.selectedFacilities, 'selectedFacilities')
      this.validateArrayField(dto.campusFacilities.customFacilities, 'customFacilities')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { campusFacilities: dto.campusFacilities as any },
    })

    return camp
  }

  /**
   * Update accommodation
   */
  async updateAccommodation(campId: string, providerId: string, dto: UpdateAccommodationDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.accommodation) {
      this.validateActivityData(dto.accommodation, 'accommodation')
      this.validateArrayField(dto.accommodation.selectedTypes, 'selectedTypes')
      this.validateArrayField(dto.accommodation.customTypes, 'customTypes')
      this.validateArrayField(dto.accommodation.amenities, 'amenities')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { accommodation: dto.accommodation as any },
    })

    return camp
  }

  /**
   * Update getting there
   */
  async updateGettingThere(campId: string, providerId: string, dto: UpdateGettingThereDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.gettingThere) {
      this.validateActivityData(dto.gettingThere, 'transport')
      this.validateArrayField(dto.gettingThere.selectedOptions, 'selectedOptions')
      this.validateArrayField(dto.gettingThere.customOptions, 'customOptions')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { gettingThere: dto.gettingThere as any },
    })

    return camp
  }

  /**
   * Update camp focus
   */
  async updateCampFocus(campId: string, providerId: string, dto: UpdateCampFocusDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate structured data
    if (dto.campFocus) {
      this.validateActivityData(dto.campFocus, 'focus')
      this.validateArrayField(dto.campFocus.selectedFocusAreas, 'selectedFocusAreas')
      this.validateArrayField(dto.campFocus.customFocusAreas, 'customFocusAreas')
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { campFocus: dto.campFocus as any },
    })

    return camp
  }

  /**
   * Update camp status
   */
  async updateCampStatus(campId: string, providerId: string, dto: UpdateCampStatusDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: {
        status: dto.status,
        publishedAt: dto.status === 'published' ? new Date() : null,
      },
    })

    return camp
  }

  /**
   * Get camp statistics for provider dashboard
   */
  async getCampStatistics(providerId: string) {
    const camps = await this.prisma.camp.findMany({
      where: { providerId },
      select: {
        id: true,
        status: true,
      },
    })

    // TODO: Replace with actual bookings and sessions data when those models are implemented
    // For now, return mock data
    const stats = {
      totalCamps: camps.length,
      publishedCamps: camps.filter(c => c.status === 'published').length,
      draftCamps: camps.filter(c => c.status === 'draft').length,
      archivedCamps: camps.filter(c => c.status === 'archived').length,
      totalBookings: 0, // TODO: Implement when bookings model is ready
      activeSessions: 0, // TODO: Implement when sessions model is ready
      averageRating: 0.0, // TODO: Implement when reviews model is ready
    }

    return stats
  }

  /**
   * Archive a camp
   */
  async archiveCamp(campId: string, providerId: string) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: {
        status: 'archived',
      },
    })

    return camp
  }

  /**
   * Duplicate a camp
   */
  async duplicateCamp(campId: string, providerId: string) {
    const originalCamp = await this.verifyCampOwnership(campId, providerId)

    // Create a copy of the camp with a new name
    const { id, createdAt, updatedAt, publishedAt, ...campData } = originalCamp as any

    const duplicatedCamp = await this.prisma.camp.create({
      data: {
        ...campData,
        name: `${campData.name} (Copy)`,
        status: 'draft',
        publishedAt: null,
      },
    })

    return duplicatedCamp
  }

  /**
   * Helper: Verify camp ownership
   */
  private async verifyCampOwnership(campId: string, providerId: string) {
    const camp = await this.prisma.camp.findUnique({
      where: { id: campId },
    })

    if (!camp) {
      throw new NotFoundException('Camp not found')
    }

    if (camp.providerId !== providerId) {
      throw new ForbiddenException('You do not have permission to access this camp')
    }

    return camp
  }

  /**
   * Helper: Validate activity data structure
   */
  private validateActivityData(data: any, activityType: string) {
    if (!data || typeof data !== 'object') {
      throw new BadRequestException(`Invalid ${activityType} data structure`)
    }

    // Validate description length if present
    if (data.description && typeof data.description === 'string') {
      if (data.description.length > 1200) {
        throw new BadRequestException(`${activityType} description must not exceed 1200 characters`)
      }
    }

    // Validate that data is a plain object
    if (Array.isArray(data)) {
      throw new BadRequestException(`${activityType} data must be an object, not an array`)
    }
  }

  /**
   * Helper: Validate array field
   */
  private validateArrayField(field: any, fieldName: string) {
    if (field !== undefined && field !== null) {
      if (!Array.isArray(field)) {
        throw new BadRequestException(`${fieldName} must be an array`)
      }

      // Validate each item is a string
      for (const item of field) {
        if (typeof item !== 'string') {
          throw new BadRequestException(`All items in ${fieldName} must be strings`)
        }
      }
    }
  }

  /**
   * Helper: Validate string field
   */
  private validateStringField(field: any, fieldName: string) {
    if (field !== undefined && field !== null) {
      if (typeof field !== 'string') {
        throw new BadRequestException(`${fieldName} must be a string`)
      }
    }
  }

  /**
   * Get camp add-ons with their enabled status
   */
  async getCampAddOns(campId: string, providerId: string) {
    await this.verifyCampOwnership(campId, providerId)

    // Get all provider's add-ons
    const allAddOns = await this.prisma.addOn.findMany({
      where: { providerId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    // Get camp-specific add-on relationships
    const campAddOns = await this.prisma.campAddOn.findMany({
      where: { campId },
      include: {
        addOn: true,
      },
      orderBy: { sortOrder: 'asc' },
    })

    // Create a map of add-on ID to camp-specific settings
    const campAddOnMap = new Map(
      campAddOns.map(ca => [
        ca.addOnId,
        {
          isEnabled: ca.isEnabled,
          sortOrder: ca.sortOrder,
        },
      ])
    )

    // Merge provider add-ons with camp-specific settings
    const addOnsWithStatus = allAddOns.map(addOn => {
      const campSettings = campAddOnMap.get(addOn.id)
      return {
        ...addOn,
        price: typeof addOn.price === 'object' ? parseFloat(addOn.price.toString()) : addOn.price,
        isEnabled: campSettings?.isEnabled ?? false,
        campSortOrder: campSettings?.sortOrder ?? 0,
      }
    })

    return addOnsWithStatus
  }

  /**
   * Update camp add-ons (enable/disable and reorder)
   */
  async updateCampAddOns(campId: string, providerId: string, dto: UpdateCampAddOnsDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Verify all add-ons belong to the provider
    const addOnIds = dto.addOns.map(a => a.addOnId)
    const providerAddOns = await this.prisma.addOn.findMany({
      where: {
        id: { in: addOnIds },
        providerId,
      },
    })

    if (providerAddOns.length !== addOnIds.length) {
      throw new BadRequestException('One or more add-ons do not belong to this provider')
    }

    // Use transaction to update all camp add-ons
    await this.prisma.$transaction(async tx => {
      // Delete all existing camp add-ons for this camp
      await tx.campAddOn.deleteMany({
        where: { campId },
      })

      // Create new camp add-ons
      if (dto.addOns.length > 0) {
        await tx.campAddOn.createMany({
          data: dto.addOns.map((addOn, index) => ({
            campId,
            addOnId: addOn.addOnId,
            isEnabled: addOn.isEnabled,
            sortOrder: addOn.sortOrder ?? index,
          })),
        })
      }
    })

    return { message: 'Camp add-ons updated successfully' }
  }
}
