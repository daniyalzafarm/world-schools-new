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

    let allPhotos = [...existingPhotos]

    // Upload new files if provided
    if (files && files.length > 0) {
      const uploadedPhotos = await this.photoUploadService.uploadPhotos(
        campId,
        providerId,
        files,
        existingPhotos
      )
      allPhotos = [...existingPhotos, ...uploadedPhotos]
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

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { meals: dto.meals },
    })

    return camp
  }

  /**
   * Update sports activities
   */
  async updateSports(campId: string, providerId: string, dto: UpdateSportsDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { sportsActivities: dto.sportsActivities },
    })

    return camp
  }

  /**
   * Update language programs
   */
  async updateLanguages(campId: string, providerId: string, dto: UpdateLanguagesDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { languagePrograms: dto.languagePrograms },
    })

    return camp
  }

  /**
   * Update arts and crafts
   */
  async updateArts(campId: string, providerId: string, dto: UpdateArtsDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { artsAndCrafts: dto.artsAndCrafts },
    })

    return camp
  }

  /**
   * Update adventure activities
   */
  async updateAdventure(campId: string, providerId: string, dto: UpdateAdventureDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { adventureActivities: dto.adventureActivities },
    })

    return camp
  }

  /**
   * Update water activities
   */
  async updateWater(campId: string, providerId: string, dto: UpdateWaterDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { waterActivities: dto.waterActivities },
    })

    return camp
  }

  /**
   * Update environmental activities
   */
  async updateEnvironmental(campId: string, providerId: string, dto: UpdateEnvironmentalDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { environmentalActivities: dto.environmentalActivities },
    })

    return camp
  }

  /**
   * Update academics
   */
  async updateAcademics(campId: string, providerId: string, dto: UpdateAcademicsDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { academics: dto.academics },
    })

    return camp
  }

  /**
   * Update religion programs
   */
  async updateReligion(campId: string, providerId: string, dto: UpdateReligionDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { religionPrograms: dto.religionPrograms },
    })

    return camp
  }

  /**
   * Update excursions and trips
   */
  async updateExcursions(campId: string, providerId: string, dto: UpdateExcursionsDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { excursionsTrips: dto.excursionsTrips },
    })

    return camp
  }

  /**
   * Update location and campus
   */
  async updateLocationCampus(campId: string, providerId: string, dto: UpdateLocationCampusDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { campusFacilities: dto.campusFacilities },
    })

    return camp
  }

  /**
   * Update accommodation
   */
  async updateAccommodation(campId: string, providerId: string, dto: UpdateAccommodationDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { accommodation: dto.accommodation },
    })

    return camp
  }

  /**
   * Update getting there
   */
  async updateGettingThere(campId: string, providerId: string, dto: UpdateGettingThereDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { gettingThere: dto.gettingThere },
    })

    return camp
  }

  /**
   * Update camp focus
   */
  async updateCampFocus(campId: string, providerId: string, dto: UpdateCampFocusDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { campFocus: dto.campFocus },
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
}
