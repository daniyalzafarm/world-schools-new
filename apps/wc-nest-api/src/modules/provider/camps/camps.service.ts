import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { JwtService } from '@nestjs/jwt'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../prisma/prisma.service'
import { ConfigService } from '../../../config/config.service'
import { notify } from '../../notifications/dispatcher/notify'
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
import { UpdateCampAddOnsDto } from './dto/update-camp-addons.dto'
import { UpdateCampDepositSettingsDto } from './dto/update-camp-deposit-settings.dto'
import { ProfileCompletionService } from '../../common/profile-completion/profile-completion.service'
import { PhotoUploadService } from './services/photo-upload.service'
import { GoogleBusinessService } from '../onboarding/services/google-business.service'
import { GetCampsFiltersDto } from './dto/get-camps-filters.dto'
import {
  PutCampEligibilityDto,
  PutCampFocusBodyDto,
  PutCampInterestsDto,
} from './dto/camp-catalogue.dto'
import { EligibilityMode } from '../../../generated/client/enums'

@Injectable()
export class CampsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photoUploadService: PhotoUploadService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly googleBusinessService: GoogleBusinessService,
    private readonly profileCompletion: ProfileCompletionService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Create a new camp with basic info (Wizard Step 1)
   */
  async createCamp(providerId: string, dto: CreateCampDto) {
    // Validate location data
    if (dto.locationType === 'different' && !dto.locationPlaceId) {
      throw new BadRequestException('Location place ID is required when using different location')
    }

    // Check if slug is already taken
    const existingCamp = await this.prisma.camp.findUnique({
      where: { slug: dto.slug },
    })

    if (existingCamp) {
      throw new BadRequestException('This slug is already taken. Please choose a different one.')
    }

    // Prepare location data
    let locationData: {
      locationPlaceId?: string
      locationName?: string
      locationAddress?: string
      locationLat?: number
      locationLng?: number
      gbpId?: string
    } = {
      locationPlaceId: dto.locationPlaceId,
      locationName: dto.locationName,
      locationAddress: dto.locationAddress,
      locationLat: dto.locationLat,
      locationLng: dto.locationLng,
    }

    // If using provider location, populate from Google Business Profile
    if (dto.locationType === 'provider') {
      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId },
        select: { gbpId: true, googleBusinessProfile: true },
      })
      const googleProfile = provider?.googleBusinessProfile

      if (googleProfile) {
        locationData = {
          locationPlaceId: googleProfile.placeId,
          locationName: googleProfile.businessName,
          locationAddress: googleProfile.formattedAddress,
          locationLat: Number(googleProfile.lat),
          locationLng: Number(googleProfile.lng),
          gbpId: provider.gbpId ?? undefined,
        }
      }
    }

    // If using a different location, find or create a GBP record for the selected venue
    if (dto.locationType === 'different' && dto.locationPlaceId) {
      const gbp = await this.googleBusinessService.findOrCreateGbp(dto.locationPlaceId)
      if (gbp) {
        locationData.gbpId = gbp.id
      }
    }

    // Snapshot the provider's deposit settings onto the new camp. Provider-
    // level settings are the DEFAULT for new camps; once snapshotted here,
    // editing the provider-level row never propagates to existing camps. The
    // booking flow reads these fields directly off the camp at submit time
    // (no provider-level fallback) — same pattern as the BookingGroup
    // financial snapshot.
    const providerSettings = await this.prisma.providerSettings.findUnique({
      where: { providerId },
      select: {
        depositRequired: true,
        depositType: true,
        depositPercentage: true,
        depositFixedAmount: true,
      },
    })

    const camp = await this.prisma.camp.create({
      data: {
        providerId,
        name: dto.name,
        slug: dto.slug,
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
        // Deposit snapshot. Defaults apply when the provider hasn't yet
        // configured deposit settings (incomplete onboarding) — the camp
        // simply has no deposit, which routes booking to full_at_booking.
        depositRequired: providerSettings?.depositRequired ?? false,
        depositType: providerSettings?.depositType ?? null,
        depositPercentage: providerSettings?.depositPercentage ?? null,
        depositFixedAmount: providerSettings?.depositFixedAmount ?? null,
      },
    })

    return camp
  }

  /**
   * Update camp audience (Wizard Step 2)
   */
  async updateCampAudience(campId: string, providerId: string, dto: UpdateCampAudienceDto) {
    await this.verifyCampOwnership(campId, providerId)

    // Validate age groups array is not empty
    if (!dto.ageGroups || dto.ageGroups.length === 0) {
      throw new BadRequestException('At least one age group is required')
    }

    // Validate each age group
    for (const group of dto.ageGroups) {
      // Validate min and max are valid numbers
      if (typeof group.min !== 'number' || typeof group.max !== 'number') {
        throw new BadRequestException('Age group min and max must be valid numbers')
      }

      // Validate age range constraints
      if (group.min < 4) {
        throw new BadRequestException('Min age must be at least 4')
      }
      if (group.min > 18) {
        throw new BadRequestException('Min age cannot exceed 18')
      }
      if (group.max < 4) {
        throw new BadRequestException('Max age must be at least 4')
      }
      if (group.max > 18) {
        throw new BadRequestException('Max age cannot exceed 18')
      }
      if (group.max <= group.min) {
        throw new BadRequestException('Max age must be greater than min age')
      }
    }

    // Check for overlapping age ranges
    for (let i = 0; i < dto.ageGroups.length; i++) {
      for (let j = i + 1; j < dto.ageGroups.length; j++) {
        const group1 = dto.ageGroups[i]
        const group2 = dto.ageGroups[j]

        // Check if ranges overlap
        // Overlap occurs if: (start1 <= end2) AND (end1 >= start2)
        if (group1.min <= group2.max && group1.max >= group2.min) {
          throw new BadRequestException(
            `Age groups cannot overlap: Group ${i + 1} (${group1.min}-${group1.max}) overlaps with Group ${j + 1} (${group2.min}-${group2.max})`
          )
        }
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

    // Generate SAS URLs for photos before returning (same as getCamp)
    if (camp.photos && Array.isArray(camp.photos) && camp.photos.length > 0) {
      const photosWithUrls = await this.photoUploadService.generatePhotoUrls(camp.photos as any[])
      return { ...camp, photos: photosWithUrls }
    }

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
    if (!camp.photos || (camp.photos as any[]).length < 5) {
      throw new BadRequestException('At least 5 photos are required')
    }

    // Detect "first publish" before flipping the row — drives the
    // ProviderProfilePublished catalog entry which is a one-shot welcome
    // notification (subsequent publishes are silent).
    const priorPublishedCount = await this.prisma.camp.count({
      where: { providerId, status: 'published' },
    })

    const updatedCamp = await this.prisma.camp.update({
      where: { id: campId },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    })

    // Phase 7g (audit bug #2): publishing the provider's first camp shifts
    // their profile-completion score by 30 points. Worth recomputing here
    // so the "incomplete profile" reminder is gated against fresh state.
    await this.profileCompletion.enqueueRecomputeForProvider(providerId)

    // v28 catalog dispatch (Phase 8a) — one-shot "you're live" notification
    // on the first publish only. Subsequent publishes are silent (the
    // provider already knows the publish flow works at that point).
    if (priorPublishedCount === 0) {
      notify(this.eventEmitter, NotificationType.ProviderProfilePublished, { providerId })
      // v28 Phase 9 — superadmin mirror surfaces the camp's first live
      // listing in the admin feed so platform-health monitoring + spot-
      // checks happen on day one.
      notify(this.eventEmitter, NotificationType.SuperadminCampFirstListingLive, { providerId })
    }

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

    const campIds = camps.map(c => c.id)

    const [sessionGroups, addOnGroups, eligibilityGroups] = await Promise.all([
      campIds.length
        ? this.prisma.session.groupBy({
            by: ['campId', 'status'],
            where: { campId: { in: campIds } },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ campId: string; status: any; _count: { _all: number } }>),
      campIds.length
        ? this.prisma.campAddOn.groupBy({
            by: ['campId', 'isEnabled'],
            where: { campId: { in: campIds } },
            _count: { _all: true },
          })
        : Promise.resolve(
            [] as Array<{ campId: string; isEnabled: boolean; _count: { _all: number } }>
          ),
      campIds.length
        ? this.prisma.campEligibilityRequirement.groupBy({
            by: ['campId'],
            where: { campId: { in: campIds } },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ campId: string; _count: { _all: number } }>),
    ])

    const sessionsByCamp = new Map<string, { published: number; total: number }>()
    for (const row of sessionGroups) {
      const cur = sessionsByCamp.get(row.campId) ?? { published: 0, total: 0 }
      cur.total += row._count._all
      if (row.status === 'published') cur.published += row._count._all
      sessionsByCamp.set(row.campId, cur)
    }

    const addOnsByCamp = new Map<string, { enabled: number; total: number }>()
    for (const row of addOnGroups) {
      const cur = addOnsByCamp.get(row.campId) ?? { enabled: 0, total: 0 }
      cur.total += row._count._all
      if (row.isEnabled) cur.enabled += row._count._all
      addOnsByCamp.set(row.campId, cur)
    }

    const eligibilityByCamp = new Map<string, number>()
    for (const row of eligibilityGroups) {
      eligibilityByCamp.set(row.campId, row._count._all)
    }

    // Generate SAS URLs for photos and attach counts
    const currency = await this.requireProviderCurrency(providerId)
    const campsWithPhotoUrls = await Promise.all(
      camps.map(async camp => {
        const counts = {
          sessionsCount: sessionsByCamp.get(camp.id) ?? { published: 0, total: 0 },
          addOnsCount: addOnsByCamp.get(camp.id) ?? { enabled: 0, total: 0 },
          eligibilityCount: eligibilityByCamp.get(camp.id) ?? 0,
        }
        if (camp.photos && Array.isArray(camp.photos) && camp.photos.length > 0) {
          const photosWithUrls = await this.photoUploadService.generatePhotoUrls(
            camp.photos as any[]
          )
          return {
            ...camp,
            photos: photosWithUrls,
            ...counts,
            currency,
          }
        }
        return { ...camp, ...counts, currency }
      })
    )

    return campsWithPhotoUrls
  }

  /**
   * Get a single camp
   */
  async getCamp(campId: string, providerId: string) {
    const camp = await this.verifyCampOwnership(campId, providerId)
    const currency = await this.requireProviderCurrency(providerId)

    // Generate SAS URLs for photos if they exist
    if (camp.photos && Array.isArray(camp.photos) && camp.photos.length > 0) {
      const photosWithUrls = await this.photoUploadService.generatePhotoUrls(camp.photos as any[])
      return { ...camp, photos: photosWithUrls, currency }
    }

    return { ...camp, currency }
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

    // If slug is being updated, check if it's already taken by another camp
    if (dto.slug) {
      const existingCamp = await this.prisma.camp.findUnique({
        where: { slug: dto.slug },
      })

      if (existingCamp && existingCamp.id !== campId) {
        throw new BadRequestException('This slug is already taken. Please choose a different one.')
      }
    }

    // Prepare update data
    const updateData: any = { ...dto }

    // If changing to provider location, populate from Google Business Profile
    if (dto.locationType === 'provider') {
      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId },
        select: { gbpId: true, googleBusinessProfile: true },
      })
      const googleProfile = provider?.googleBusinessProfile

      if (googleProfile) {
        updateData.locationPlaceId = googleProfile.placeId
        updateData.locationName = googleProfile.businessName
        updateData.locationAddress = googleProfile.formattedAddress
        updateData.locationLat = Number(googleProfile.lat)
        updateData.locationLng = Number(googleProfile.lng)
        updateData.gbpId = provider.gbpId ?? null
      }
    }

    // If changing to a different location, find or create a GBP record for the selected venue
    if (dto.locationType === 'different' && dto.locationPlaceId) {
      const gbp = await this.googleBusinessService.findOrCreateGbp(dto.locationPlaceId)
      updateData.gbpId = gbp?.id ?? null
    }

    // If switching to different location without a venue yet, clear any previous GBP link
    if (dto.locationType === 'different' && !dto.locationPlaceId) {
      updateData.gbpId = null
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

    // Generate SAS URLs for photos before returning (same as getCamp)
    if (camp.photos && Array.isArray(camp.photos) && camp.photos.length > 0) {
      const photosWithUrls = await this.photoUploadService.generatePhotoUrls(camp.photos as any[])
      return { ...camp, photos: photosWithUrls }
    }

    return camp
  }

  /**
   * Update what's included
   */
  async updateWhatsIncluded(campId: string, providerId: string, dto: UpdateWhatsIncludedDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: { whatsIncluded: dto.whatsIncluded as any },
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
      data: {
        scheduleType: dto.scheduleType,
        dailySchedule: dto.dailySchedule,
        weeklySchedule: dto.weeklySchedule,
      },
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
      this.validateArrayField(dto.gettingThere.selectedTransport, 'selectedTransport')
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

      // Validate primary focus if provided
      if (dto.campFocus.primaryFocus) {
        if (!dto.campFocus.primaryFocus.activityId || !dto.campFocus.primaryFocus.activityName) {
          throw new BadRequestException('Primary focus must have activityId and activityName')
        }
        if (!dto.campFocus.primaryFocus.categoryId || !dto.campFocus.primaryFocus.categoryName) {
          throw new BadRequestException('Primary focus must have categoryId and categoryName')
        }
      }
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

  // ---------- Catalogue: Focus, Interests, Eligibility ----------

  async getCampFocus(campId: string, providerId: string) {
    await this.verifyCampOwnership(campId, providerId)
    const focus = await this.prisma.campFocus.findUnique({
      where: { campId },
      include: { category: true, activity: true },
    })
    if (!focus) return { focus: null }
    return {
      focus: {
        categoryId: focus.category.slug,
        activityId: focus.activity.slug,
      },
    }
  }

  async putCampFocus(campId: string, providerId: string, dto: PutCampFocusBodyDto) {
    await this.verifyCampOwnership(campId, providerId)
    if (dto.focus == null || (typeof dto.focus === 'object' && !dto.focus.activityId)) {
      await this.prisma.campFocus.deleteMany({ where: { campId } })
      return this.getCampFocus(campId, providerId)
    }
    const cat = await this.prisma.activityCategory.findUnique({
      where: { slug: dto.focus.categoryId },
      select: { id: true },
    })
    if (!cat) throw new BadRequestException(`Unknown category: ${dto.focus.categoryId}`)
    const activity = await this.prisma.activity.findFirst({
      where: { categoryId: cat.id, slug: dto.focus.activityId, isActive: true },
      select: { id: true },
    })
    if (!activity) throw new BadRequestException(`Unknown activity: ${dto.focus.activityId}`)
    await this.prisma.campFocus.upsert({
      where: { campId },
      create: { campId, categoryId: cat.id, activityId: activity.id },
      update: { categoryId: cat.id, activityId: activity.id },
    })
    return this.getCampFocus(campId, providerId)
  }

  async getCampInterests(campId: string, providerId: string) {
    await this.verifyCampOwnership(campId, providerId)
    const list = await this.prisma.campInterest.findMany({
      where: { campId },
      include: { category: true },
      orderBy: { categoryId: 'asc' },
    })
    const activitiesByCategory = await this.prisma.activity.findMany({
      where: { categoryId: { in: list.map(i => i.categoryId) } },
      select: { id: true, slug: true, categoryId: true },
    })
    const slugById = new Map(activitiesByCategory.map(a => [a.id, a.slug]))
    return {
      items: list.map(item => ({
        categoryId: item.category.slug,
        specificActivityIds: (item.specificActivityIds || []).map(id => slugById.get(id) ?? id),
      })),
    }
  }

  async putCampInterests(campId: string, providerId: string, dto: PutCampInterestsDto) {
    await this.verifyCampOwnership(campId, providerId)
    const categorySlugs = dto.items.map(i => i.categoryId)
    const categories = await this.prisma.activityCategory.findMany({
      where: { slug: { in: categorySlugs } },
      select: { id: true, slug: true },
    })
    const categoryBySlug = new Map(categories.map(c => [c.slug, c.id]))
    for (const item of dto.items) {
      if (!categoryBySlug.has(item.categoryId)) {
        throw new BadRequestException(`Unknown category: ${item.categoryId}`)
      }
    }
    const payload = await Promise.all(
      dto.items.map(async item => {
        const categoryId = categoryBySlug.get(item.categoryId)!
        const specificActivityIds = await this.resolveActivityIdsInCategory(
          this.prisma,
          categoryId,
          item.specificActivityIds ?? []
        )
        return { campId, categoryId, specificActivityIds }
      })
    )
    await this.prisma.$transaction(async tx => {
      await tx.campInterest.deleteMany({ where: { campId } })
      if (payload.length) await tx.campInterest.createMany({ data: payload })
    })
    return this.getCampInterests(campId, providerId)
  }

  private async resolveActivityIdsInCategory(
    prisma: PrismaService,
    categoryId: string,
    activitySlugs: string[]
  ): Promise<string[]> {
    if (!activitySlugs.length) return []
    const activities = await prisma.activity.findMany({
      where: { categoryId, slug: { in: activitySlugs } },
      select: { id: true },
    })
    return activities.map(a => a.id)
  }

  async getCampEligibility(campId: string, providerId: string) {
    await this.verifyCampOwnership(campId, providerId)
    const list = await this.prisma.campEligibilityRequirement.findMany({
      where: { campId },
      include: { activity: true },
      orderBy: { createdAt: 'asc' },
    })
    return {
      items: list.map(item => ({
        activityId: item.activity.slug,
        mode: item.mode,
        minimumLevelValue: item.minimumLevelValue ?? null,
      })),
    }
  }

  async putCampEligibility(campId: string, providerId: string, dto: PutCampEligibilityDto) {
    await this.verifyCampOwnership(campId, providerId)
    const activitySlugs = dto.items.map(i => i.activityId)
    const activities = await this.prisma.activity.findMany({
      where: { slug: { in: activitySlugs } },
      include: { scale: { include: { levels: true } } },
    })
    const activityBySlug = new Map(activities.map(a => [a.slug, a]))
    for (const item of dto.items) {
      const activity = activityBySlug.get(item.activityId)
      if (!activity) throw new BadRequestException(`Unknown activity: ${item.activityId}`)
      if (!activity.scaleId || !activity.scale) {
        throw new BadRequestException(`Activity '${item.activityId}' does not have a skill scale`)
      }
      if (item.mode === EligibilityMode.GATE) {
        if (!item.minimumLevelValue?.trim()) {
          throw new BadRequestException(
            `minimumLevelValue is required when mode is GATE for activity '${item.activityId}'`
          )
        }
        const levelExists = activity.scale.levels.some(l => l.value === item.minimumLevelValue)
        if (!levelExists) {
          throw new BadRequestException(
            `Invalid minimumLevelValue '${item.minimumLevelValue}' for activity '${item.activityId}'`
          )
        }
      }
    }
    await this.prisma.$transaction(async tx => {
      await tx.campEligibilityRequirement.deleteMany({ where: { campId } })
      if (!dto.items.length) return
      await tx.campEligibilityRequirement.createMany({
        data: dto.items.map(item => {
          const activity = activityBySlug.get(item.activityId)!
          return {
            campId,
            activityId: activity.id,
            mode: item.mode as EligibilityMode,
            minimumLevelValue: item.mode === EligibilityMode.GATE ? item.minimumLevelValue! : null,
          }
        }),
      })
    })
    return this.getCampEligibility(campId, providerId)
  }

  /**
   * Get camp statistics for provider dashboard
   */
  async getCampStatistics(providerId: string) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    const CONFIRMED_STATUSES = [
      'accepted',
      'deposit_paid',
      'fully_paid',
      'at_camp',
      'completed',
    ] as const

    const [
      camps,
      totalBookings,
      activeSessions,
      ratingAgg,
      reviewCount,
      reviewsWithResponseCount,
      revenueTotalAgg,
      bookingsValueThisMonthAgg,
      payoutsThisMonthAgg,
      revenueLastSeasonAgg,
      pendingRevenueAgg,
      refundedAgg,
      providerSettings,
    ] = await Promise.all([
      this.prisma.camp.findMany({
        where: { providerId },
        select: { id: true, status: true },
      }),
      this.prisma.bookingGroup.count({
        where: { providerId, status: { in: CONFIRMED_STATUSES as unknown as string[] } as any },
      }),
      this.prisma.session.count({
        where: {
          camp: { providerId },
          status: 'published',
          endDate: { gte: now },
        },
      }),
      this.prisma.campReview.findMany({
        where: { camp: { providerId }, status: 'published' },
        select: {
          happinessRating: true,
          safetyRating: true,
          communicationRating: true,
          asDescribedRating: true,
          growthRating: true,
          valueRating: true,
        },
      }),
      this.prisma.campReview.count({
        where: { camp: { providerId }, status: 'published' },
      }),
      this.prisma.campReview.count({
        where: {
          camp: { providerId },
          status: 'published',
          response: { is: null },
        },
      }),
      this.prisma.bookingGroup.aggregate({
        where: { providerId },
        _sum: { paidAmount: true },
      }),
      // BUG-111: this counter used to filter by `session.startDate`, which
      // made any booking confirmed in month X for a camp that ran in month
      // X+n show as £0 in the current month. Filter by `respondedAt` (when
      // the provider accepted, which is also when capture completes) and
      // restrict to confirmed statuses to exclude pending/declined.
      this.prisma.bookingGroup.aggregate({
        where: {
          providerId,
          status: { in: CONFIRMED_STATUSES as unknown as string[] } as any,
          respondedAt: { gte: startOfMonth, lt: startOfNextMonth },
        },
        _sum: { totalAmount: true },
      }),
      // Disbursed funds: Stripe payouts that hit the provider's bank in
      // the current month. Separate metric so providers can see what
      // landed in their account vs. what's been earned but not yet paid.
      this.prisma.payoutEvent.aggregate({
        where: {
          providerId,
          status: 'paid',
          arrivalDate: { gte: startOfMonth, lt: startOfNextMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.bookingGroup.aggregate({
        where: {
          providerId,
          session: { endDate: { gte: ninetyDaysAgo, lt: now } },
        },
        _sum: { paidAmount: true },
      }),
      this.prisma.bookingGroup.aggregate({
        where: { providerId, status: 'request' },
        _sum: { totalAmount: true },
      }),
      this.prisma.bookingGroup.aggregate({
        where: { providerId },
        _sum: { refundedAmount: true },
      }),
      this.prisma.providerSettings.findUnique({
        where: { providerId },
        select: { currency: true },
      }),
    ])

    let ratingSum = 0
    let ratingCount = 0
    for (const r of ratingAgg) {
      const values = [
        r.happinessRating,
        r.safetyRating,
        r.communicationRating,
        r.asDescribedRating,
        r.growthRating,
        r.valueRating,
      ].filter((v): v is number => typeof v === 'number')
      if (values.length > 0) {
        ratingSum += values.reduce((a, b) => a + b, 0) / values.length
        ratingCount++
      }
    }
    const averageRating = ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(2)) : 0

    if (!providerSettings?.currency) {
      throw new BadRequestException('Provider currency must be configured')
    }
    const currency = providerSettings.currency

    return {
      totalCamps: camps.length,
      publishedCamps: camps.filter(c => c.status === 'published').length,
      draftCamps: camps.filter(c => c.status === 'draft').length,
      archivedCamps: camps.filter(c => c.status === 'archived').length,
      totalBookings,
      activeSessions,
      averageRating,
      reviewCount,
      unrespondedReviews: reviewsWithResponseCount,
      revenueTotalPaid: Number(revenueTotalAgg._sum.paidAmount ?? 0),
      bookingsValueThisMonth: Number(bookingsValueThisMonthAgg._sum.totalAmount ?? 0),
      payoutsThisMonth: Number(payoutsThisMonthAgg._sum.amount ?? 0),
      revenueLastSeason: Number(revenueLastSeasonAgg._sum.paidAmount ?? 0),
      pendingRevenue: Number(pendingRevenueAgg._sum.totalAmount ?? 0),
      refundedTotal: Number(refundedAgg._sum.refundedAmount ?? 0),
      currency,
    }
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
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      publishedAt: _publishedAt,
      ...campData
    } = originalCamp as any

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
   * Phase 9: get a camp's current deposit settings (snapshotted from the
   * provider on creation, editable per camp).
   */
  async getCampDepositSettings(campId: string, providerId: string) {
    await this.verifyCampOwnership(campId, providerId)
    const camp = await this.prisma.camp.findUnique({
      where: { id: campId },
      select: {
        depositRequired: true,
        depositType: true,
        depositPercentage: true,
        depositFixedAmount: true,
      },
    })
    if (!camp) throw new NotFoundException('Camp not found')
    return camp
  }

  /**
   * Phase 9: update the per-camp deposit settings.
   *
   * Modes:
   *   - No deposit (`depositRequired = false`) → clears `depositType`,
   *     `depositPercentage`, `depositFixedAmount`. Bookings will charge the
   *     full amount at booking time.
   *   - Percentage → requires `depositType = 'percentage'` +
   *     `depositPercentage` in [1, 100].
   *   - Fixed → requires `depositType = 'fixed'` + `depositFixedAmount > 0`,
   *     AND the amount must be strictly less than every existing session's
   *     price for this camp (per spec: "the sessions amount should always be
   *     greater than this fixed amount"). Sessions with age-group pricing
   *     are validated against their cheapest tier.
   */
  async updateCampDepositSettings(
    campId: string,
    providerId: string,
    dto: UpdateCampDepositSettingsDto
  ) {
    await this.verifyCampOwnership(campId, providerId)

    if (!dto.depositRequired) {
      // No-deposit mode: clear all related fields so the booking flow doesn't
      // accidentally see stale percentage/fixed values.
      const camp = await this.prisma.camp.update({
        where: { id: campId },
        data: {
          depositRequired: false,
          depositType: null,
          depositPercentage: null,
          depositFixedAmount: null,
        },
        select: {
          depositRequired: true,
          depositType: true,
          depositPercentage: true,
          depositFixedAmount: true,
        },
      })
      return camp
    }

    if (!dto.depositType) {
      throw new BadRequestException('depositType is required when depositRequired = true')
    }

    if (dto.depositType === 'percentage') {
      if (
        dto.depositPercentage == null ||
        !Number.isInteger(dto.depositPercentage) ||
        dto.depositPercentage < 1 ||
        dto.depositPercentage > 100
      ) {
        throw new BadRequestException(
          'depositPercentage must be an integer between 1 and 100 when depositType = percentage'
        )
      }
      const camp = await this.prisma.camp.update({
        where: { id: campId },
        data: {
          depositRequired: true,
          depositType: 'percentage',
          depositPercentage: dto.depositPercentage,
          // Clear the fixed amount so a stale value can't leak into the
          // booking math if depositType is later switched.
          depositFixedAmount: null,
        },
        select: {
          depositRequired: true,
          depositType: true,
          depositPercentage: true,
          depositFixedAmount: true,
        },
      })
      return camp
    }

    // Fixed amount.
    if (dto.depositFixedAmount == null || dto.depositFixedAmount <= 0) {
      throw new BadRequestException('depositFixedAmount must be > 0 when depositType = fixed')
    }

    // Spec: "The sessions amount should always be greater than this fixed
    // amount." Validate against every existing session's price (and every
    // age-group tier when applicable). A session with no price at all
    // (draft/incomplete) is skipped — it'll be re-validated when the
    // provider sets its price.
    const fixed = dto.depositFixedAmount
    const sessions = await this.prisma.session.findMany({
      where: { campId },
      select: {
        id: true,
        name: true,
        pricingType: true,
        price: true,
        ageGroupPrices: true,
      },
    })
    for (const session of sessions) {
      const minSessionPrice = this.minPriceForSession(session)
      if (minSessionPrice == null) continue
      if (minSessionPrice <= fixed) {
        throw new BadRequestException(
          `Fixed deposit ${fixed.toFixed(2)} must be strictly less than every session price. ` +
            `Session "${session.name}" has a price of ${minSessionPrice.toFixed(2)}.`
        )
      }
    }

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: {
        depositRequired: true,
        depositType: 'fixed',
        depositFixedAmount: fixed,
        // Clear percentage so a stale value can't leak through.
        depositPercentage: null,
      },
      select: {
        depositRequired: true,
        depositType: true,
        depositPercentage: true,
        depositFixedAmount: true,
      },
    })
    return camp
  }

  /**
   * Returns the minimum price across a session's pricing tiers. For
   * `pricingType = 'single'` it's just `session.price`. For `'age_group'`
   * it's the smallest non-null tier price. Returns null when no price is
   * configured (draft session) so the deposit-validation caller can skip it.
   */
  private minPriceForSession(session: {
    pricingType: string
    price: unknown
    ageGroupPrices: unknown
  }): number | null {
    if (session.pricingType === 'single') {
      const p = session.price
      if (p == null) return null
      return Number(p)
    }
    if (session.pricingType === 'age_group' && Array.isArray(session.ageGroupPrices)) {
      const prices = (session.ageGroupPrices as Array<Record<string, unknown>>)
        .map(t => Number(t.price ?? t.amount))
        .filter(n => Number.isFinite(n) && n > 0)
      if (prices.length === 0) return null
      return Math.min(...prices)
    }
    return null
  }

  /**
   * Resolves the provider's settlement currency from ProviderSettings.
   * Currency is required at onboarding and immutable thereafter — a missing
   * value is a data bug, not a runtime fallback.
   */
  private async requireProviderCurrency(providerId: string): Promise<string> {
    const settings = await this.prisma.providerSettings.findUnique({
      where: { providerId },
      select: { currency: true },
    })
    if (!settings?.currency) {
      throw new BadRequestException('Provider currency must be configured')
    }
    return settings.currency
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

  /**
   * Generate a preview token for a camp
   * Allows providers to preview unpublished camps in the booking app
   */
  async generatePreviewToken(campId: string, providerId: string): Promise<string> {
    // Verify the camp exists and belongs to the provider
    const camp = await this.prisma.camp.findUnique({
      where: { id: campId },
      select: { id: true, providerId: true, slug: true },
    })

    if (!camp) {
      throw new NotFoundException('Camp not found')
    }

    if (camp.providerId !== providerId) {
      throw new ForbiddenException('You do not have permission to preview this camp')
    }

    // Generate a short-lived JWT token (10 minutes)
    const payload = {
      campId: camp.id,
      providerId: camp.providerId,
      slug: camp.slug,
      type: 'preview',
    }

    const token = this.jwtService.sign(payload, {
      secret: this.configService.jwtConfig.secret,
      expiresIn: '10m', // 10 minutes expiration
    })

    return token
  }

  /**
   * Update safety & policies (combined safety supervision + screen policy)
   */
  async updateSafetyPolicies(campId: string, providerId: string, dto: UpdateSafetyPoliciesDto) {
    await this.verifyCampOwnership(campId, providerId)

    const camp = await this.prisma.camp.update({
      where: { id: campId },
      data: {
        safetySupervision: dto.safetySupervision as any,
        screenPolicy: dto.screenPolicy as any,
      },
    })

    return camp
  }
}
