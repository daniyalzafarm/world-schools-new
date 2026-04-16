import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { parse } from 'csv-parse/sync'
import { PrismaService } from '../../../prisma/prisma.service'
import { GoogleBusinessService } from '../../provider/onboarding/services/google-business.service'
import { PhotoUploadService } from '../../provider/camps/services/photo-upload.service'
import { generateCampSlug, parseCampCsvRow, validateCampCsvRow } from './camps-csv.helpers'
import { GetCampsQueryDto } from './dto/get-camps-query.dto'
import { GetCampSessionsQueryDto } from './dto/get-camp-sessions-query.dto'
import { GetCampBookingsQueryDto } from './dto/get-camp-bookings-query.dto'
import { GetCampReviewsQueryDto } from './dto/get-camp-reviews-query.dto'

export interface ImportCampRowError {
  column: number
  name: string
  reason: string
}

export interface ImportCampsResult {
  imported: number
  failed: number
  errors: ImportCampRowError[]
}

@Injectable()
export class SuperAdminCampsService {
  private readonly logger = new Logger(SuperAdminCampsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleBusinessService: GoogleBusinessService,
    private readonly photoUploadService: PhotoUploadService
  ) {}

  async findAll(query: GetCampsQueryDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const where: any = {}

    if (query.status) {
      where.status = query.status
    }

    if (query.providerId) {
      where.providerId = query.providerId
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { provider: { legalCompanyName: { contains: query.search, mode: 'insensitive' } } },
      ]
    }

    if (query.country) {
      const countryCondition = {
        OR: [
          { locationAddress: { contains: query.country, mode: 'insensitive' } },
          { locationName: { contains: query.country, mode: 'insensitive' } },
        ],
      }
      where.AND = [...(where.AND ?? []), countryCondition]
    }

    if (query.category) {
      where.activities = { has: query.category }
    }

    const [total, camps] = await this.prisma.$transaction([
      this.prisma.camp.count({ where }),
      this.prisma.camp.findMany({
        where,
        select: {
          id: true,
          name: true,
          status: true,
          providerId: true,
          locationName: true,
          locationAddress: true,
          photos: true,
          ageGroups: true,
          provider: {
            select: {
              id: true,
              legalCompanyName: true,
              contactFirstName: true,
              contactLastName: true,
            },
          },
          _count: {
            select: {
              sessions: true,
              bookingGroups: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    const campIds = camps.map(c => c.id)
    const ratingsData =
      campIds.length > 0
        ? await this.prisma.campReview.groupBy({
            by: ['campId'],
            where: {
              campId: { in: campIds },
              status: 'published',
              happinessRating: { not: null },
            },
            _avg: { happinessRating: true },
          })
        : []

    const ratingsMap = new Map(ratingsData.map(r => [r.campId, r._avg.happinessRating]))

    const data = await Promise.all(
      camps.map(async camp => {
        const rawPhotos = (camp.photos as any[]) ?? []
        const primaryPhoto = rawPhotos.find((p: any) => p.isPrimary) ?? rawPhotos[0] ?? null

        // Resolve SAS URL for the cover image blob name
        let coverImageUrl: string | null = null
        if (primaryPhoto?.url) {
          try {
            const [resolved] = await this.photoUploadService.generatePhotoUrls([primaryPhoto])
            coverImageUrl = resolved.url ?? null
          } catch {
            coverImageUrl = null
          }
        }

        const providerName =
          camp.provider.legalCompanyName ||
          [camp.provider.contactFirstName, camp.provider.contactLastName]
            .filter(Boolean)
            .join(' ') ||
          'Unknown Provider'

        return {
          id: camp.id,
          name: camp.name,
          status: camp.status,
          providerName,
          providerId: camp.providerId,
          location: camp.locationName || camp.locationAddress || '',
          coverImageUrl,
          ageGroups: (camp.ageGroups as any[]) ?? [],
          averageRating: ratingsMap.get(camp.id) ?? null,
          totalBookings: camp._count.bookingGroups,
          sessionsCount: camp._count.sessions,
        }
      })
    )

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getStats() {
    const [draft, published, archived, pendingReviewCount, suspendedCount] =
      await this.prisma.$transaction([
        this.prisma.camp.count({ where: { status: 'draft' } }),
        this.prisma.camp.count({ where: { status: 'published' } }),
        this.prisma.camp.count({ where: { status: 'archived' } }),
        this.prisma.camp.count({ where: { status: 'pending_review' } }),
        this.prisma.camp.count({ where: { status: 'suspended' } }),
      ])

    return {
      totalCamps: draft + published + archived + pendingReviewCount + suspendedCount,
      draft,
      published,
      pendingReview: pendingReviewCount,
      suspended: suspendedCount,
      archived,
    }
  }

  async getDetail(id: string) {
    const camp = await this.prisma.camp.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            legalCompanyName: true,
            contactFirstName: true,
            contactLastName: true,
            contactEmail: true,
            logoUrl: true,
            createdAt: true,
            _count: { select: { camps: true } },
          },
        },
        sessions: {
          where: {
            startDate: { gte: new Date() },
            status: 'published',
          },
          orderBy: { startDate: 'asc' },
          take: 10,
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            totalSpots: true,
            _count: { select: { bookings: true } },
          },
        },
        _count: {
          select: {
            sessions: true,
            bookingGroups: true,
          },
        },
      },
    })

    if (!camp) {
      throw new NotFoundException(`Camp with ID '${id}' not found`)
    }

    const [revenueResult, reviewAggregate, ratingsDistribution, providerRating, publishedSessions] =
      await Promise.all([
        this.prisma.bookingGroup.aggregate({
          where: {
            campId: id,
            status: { in: ['deposit_paid', 'fully_paid', 'at_camp', 'completed'] },
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.campReview.aggregate({
          where: { campId: id, status: 'published', happinessRating: { not: null } },
          _avg: { happinessRating: true },
          _count: { _all: true },
        }),
        this.prisma.campReview.groupBy({
          by: ['happinessRating'],
          where: { campId: id, status: 'published', happinessRating: { not: null } },
          _count: { _all: true },
          orderBy: { happinessRating: 'desc' },
        }),
        this.prisma.campReview.aggregate({
          where: {
            camp: { providerId: camp.providerId },
            status: 'published',
            happinessRating: { not: null },
          },
          _avg: { happinessRating: true },
        }),
        this.prisma.session.findMany({
          where: { campId: id, status: 'published' },
          select: { price: true },
        }),
      ])

    const prices = publishedSessions.map(s => Number(s.price)).filter(p => !isNaN(p) && p > 0)
    const priceMin = prices.length > 0 ? Math.min(...prices) : null
    const priceMax = prices.length > 0 ? Math.max(...prices) : null

    const providerName =
      camp.provider.legalCompanyName ||
      [camp.provider.contactFirstName, camp.provider.contactLastName].filter(Boolean).join(' ') ||
      'Unknown Provider'

    const upcomingSessions = camp.sessions.map(session => {
      const totalSpots = session.totalSpots ?? 0
      const enrolledCount = session._count.bookings
      let status: 'upcoming' | 'full' | 'active' = 'upcoming'
      if (totalSpots > 0 && enrolledCount >= totalSpots) status = 'full'
      else if (new Date() >= session.startDate) status = 'active'

      return {
        id: session.id,
        name: session.name,
        startDate: session.startDate.toISOString(),
        endDate: session.endDate.toISOString(),
        capacity: totalSpots,
        enrolled: enrolledCount,
        status,
      }
    })

    const campFocusData = camp.campFocus as any
    const primaryFocus: string[] = campFocusData?.primaryFocus?.activityName
      ? [campFocusData.primaryFocus.activityName]
      : []

    // Resolve SAS URLs for all photos
    const rawPhotos = (camp.photos as any[]) ?? []
    const photos =
      rawPhotos.length > 0 ? await this.photoUploadService.generatePhotoUrls(rawPhotos) : rawPhotos

    // Resolve SAS URL for provider logo
    let providerLogoUrl: string | null = null
    if (camp.provider.logoUrl) {
      try {
        const [resolved] = await this.photoUploadService.generatePhotoUrls([
          { url: camp.provider.logoUrl },
        ])
        providerLogoUrl = resolved.url ?? null
      } catch {
        // Fall back to null if SAS generation fails
      }
    }

    return {
      id: camp.id,
      name: camp.name,
      status: camp.status,
      type: camp.type,
      gender: camp.gender,
      isFeatured: false,
      isVerified: false,
      slug: camp.slug,
      providerName,
      providerId: camp.providerId,
      providerLogoUrl,
      providerContactEmail: camp.provider.contactEmail ?? null,
      providerMemberSince: camp.provider.createdAt.toISOString(),
      providerCampsCount: camp.provider._count.camps,
      providerAvgRating: providerRating._avg?.happinessRating ?? null,
      location: camp.locationName || camp.locationAddress || '',
      ageGroups: (camp.ageGroups as any[]) ?? [],
      priceMin,
      priceMax,
      sessionsCount: camp._count.sessions,
      totalBookings: camp._count.bookingGroups,
      averageRating: reviewAggregate._avg?.happinessRating ?? null,
      totalRevenue: Number(revenueResult._sum.totalAmount ?? 0),
      avgOccupancy: null,
      description: camp.description,
      primaryFocus,
      keyActivities: camp.activities ?? [],
      photos,
      createdAt: camp.createdAt.toISOString(),
      upcomingSessions,
      ratingsDistribution: ratingsDistribution.map(r => ({
        stars: r.happinessRating ?? 0,
        count: r._count._all,
      })),
      totalReviews: reviewAggregate._count._all,
      // Camp Details tab: JSON editor fields
      languages: camp.languages ?? [],
      campFocusFull: camp.campFocus ?? null,
      whatsIncluded: camp.whatsIncluded ?? null,
      meals: camp.meals ?? null,
      accommodation: camp.accommodation ?? null,
      scheduleType: camp.scheduleType ?? null,
      dailySchedule: camp.dailySchedule ?? null,
      weeklySchedule: camp.weeklySchedule ?? null,
      sportsActivities: camp.sportsActivities ?? null,
      waterActivities: camp.waterActivities ?? null,
      artsAndCrafts: camp.artsAndCrafts ?? null,
      adventureActivities: camp.adventureActivities ?? null,
      environmentalActivities: camp.environmentalActivities ?? null,
      languagePrograms: camp.languagePrograms ?? null,
      academics: camp.academics ?? null,
      religionPrograms: camp.religionPrograms ?? null,
      excursionsTrips: camp.excursionsTrips ?? null,
      campusFacilities: camp.campusFacilities ?? null,
      gettingThere: camp.gettingThere ?? null,
    }
  }

  async getCampSessions(campId: string, query: GetCampSessionsQueryDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const where: any = { campId }
    if (query.status) where.status = query.status

    const [total, sessions] = await this.prisma.$transaction([
      this.prisma.session.count({ where }),
      this.prisma.session.findMany({
        where,
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          price: true,
          pricingType: true,
          totalSpots: true,
          status: true,
          _count: { select: { bookings: true } },
        },
        orderBy: { startDate: 'asc' },
        skip,
        take: limit,
      }),
    ])

    const data = sessions.map(s => ({
      id: s.id,
      name: s.name,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate.toISOString(),
      price: Number(s.price),
      pricingType: s.pricingType,
      totalSpots: s.totalSpots ?? 0,
      enrolledCount: s._count.bookings,
      status: s.status,
    }))

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async getCampBookings(campId: string, query: GetCampBookingsQueryDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const where: any = { campId }
    if (query.status) where.status = query.status

    const [total, groups] = await this.prisma.$transaction([
      this.prisma.bookingGroup.count({ where }),
      this.prisma.bookingGroup.findMany({
        where,
        select: {
          id: true,
          bookingGroupNumber: true,
          totalAmount: true,
          status: true,
          requestedAt: true,
          createdAt: true,
          session: { select: { id: true, name: true, startDate: true, endDate: true } },
          parent: {
            select: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
          _count: { select: { bookings: true } },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    const data = groups.map(g => {
      const u = g.parent.user
      const parentName =
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || 'Unknown'
      return {
        id: g.id,
        bookingGroupNumber: g.bookingGroupNumber,
        sessionId: g.session.id,
        sessionName: g.session.name,
        sessionStartDate: g.session.startDate.toISOString(),
        sessionEndDate: g.session.endDate.toISOString(),
        parentName,
        childrenCount: g._count.bookings,
        totalAmount: Number(g.totalAmount),
        status: g.status,
        requestedAt: (g.requestedAt ?? g.createdAt).toISOString(),
      }
    })

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async getCampReviews(campId: string, query: GetCampReviewsQueryDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const where: any = { campId }
    if (query.status) where.status = query.status

    const [total, reviews] = await this.prisma.$transaction([
      this.prisma.campReview.count({ where }),
      this.prisma.campReview.findMany({
        where,
        select: {
          id: true,
          happinessRating: true,
          reviewText: true,
          status: true,
          visitMonth: true,
          visitYear: true,
          createdAt: true,
          returnChoice: true,
          kidCount: true,
          parent: {
            select: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    const data = reviews.map(r => {
      const u = r.parent.user
      const parentName =
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || 'Unknown'
      return {
        id: r.id,
        parentName,
        happinessRating: r.happinessRating,
        reviewText: r.reviewText,
        status: r.status,
        visitMonth: r.visitMonth,
        visitYear: r.visitYear,
        createdAt: r.createdAt.toISOString(),
        returnChoice: r.returnChoice,
        kidCount: r.kidCount,
      }
    })

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async importFromCsv(fileBuffer: Buffer, providerId: string): Promise<ImportCampsResult> {
    // Verify provider exists and fetch its GBP data for 'provider' location type
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        gbpId: true,
        googleBusinessProfile: {
          select: {
            placeId: true,
            businessName: true,
            formattedAddress: true,
            lat: true,
            lng: true,
          },
        },
      },
    })

    if (!provider) {
      throw new NotFoundException(`Provider with ID '${providerId}' not found`)
    }

    // Parse CSV — column-oriented format: first column = field key, each subsequent column = one camp
    let rawRows: string[][]
    try {
      rawRows = parse(fileBuffer, {
        columns: false,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as string[][]
    } catch {
      throw new Error('Failed to parse CSV file. Please ensure it is a valid CSV.')
    }

    // Transpose: each raw row is [fieldKey, campValue0, campValue1, ...]
    const numCamps = rawRows.length > 0 ? rawRows[0].length - 1 : 0

    if (numCamps === 0) {
      return { imported: 0, failed: 0, errors: [] }
    }

    if (numCamps > 500) {
      throw new Error('CSV file exceeds the 500-camp limit. Please split into smaller files.')
    }

    const rows: Record<string, string>[] = Array.from({ length: numCamps }, (_, p) => {
      const record: Record<string, string> = {}
      for (const rawRow of rawRows) {
        const key = rawRow[0] ?? ''
        record[key] = rawRow[p + 1] ?? ''
      }
      return record
    })

    let imported = 0
    const errors: ImportCampRowError[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // column 1 = field keys, column 2 = first camp
      const campName = row['name']?.trim() ?? ''

      try {
        // 1. Validate required fields + value constraints
        const validationError = validateCampCsvRow(row)
        if (validationError) throw new Error(validationError)

        // 2. Parse the validated row
        const parsed = parseCampCsvRow(row)

        // 3. Resolve slug — generate if absent, ensure uniqueness
        let slug = parsed.slug ?? generateCampSlug(parsed.name)
        const existingSlug = await this.prisma.camp.findUnique({ where: { slug } })
        if (existingSlug) {
          // Try appending -2, -3, ... until unique
          let suffix = 2
          let candidate = `${slug}-${suffix}`
          while (await this.prisma.camp.findUnique({ where: { slug: candidate } })) {
            suffix++
            candidate = `${slug}-${suffix}`
          }
          slug = candidate
        }

        // 4. Resolve location + gbpId (external calls must happen outside Prisma transaction)
        let locationData: {
          locationType: 'provider' | 'different'
          locationPlaceId?: string
          locationName?: string
          locationAddress?: string
          locationLat?: number
          locationLng?: number
          gbpId?: string
        } = {
          locationType: parsed.locationType,
          locationPlaceId: parsed.locationPlaceId,
          locationName: parsed.locationName,
          locationAddress: parsed.locationAddress,
        }

        if (parsed.locationType === 'provider') {
          // Inherit location and GBP from the provider's registered profile
          const gbp = provider.googleBusinessProfile
          if (gbp) {
            locationData = {
              locationType: 'provider',
              locationPlaceId: gbp.placeId ?? undefined,
              locationName: gbp.businessName ?? undefined,
              locationAddress: gbp.formattedAddress ?? undefined,
              locationLat: gbp.lat !== null ? Number(gbp.lat) : undefined,
              locationLng: gbp.lng !== null ? Number(gbp.lng) : undefined,
              gbpId: provider.gbpId ?? undefined,
            }
          }
        } else if (parsed.locationType === 'different' && parsed.locationPlaceId) {
          // Resolve (or create) a GBP record for this venue
          const gbp = await this.googleBusinessService.findOrCreateGbp(parsed.locationPlaceId)
          if (gbp) {
            locationData.gbpId = gbp.id
          }
        }

        // 5. Create the camp as a draft
        await this.prisma.camp.create({
          data: {
            providerId,
            name: parsed.name,
            slug,
            type: parsed.type,
            description: parsed.description,
            gender: parsed.gender,
            ageGroups: parsed.ageGroups as any,
            languages: parsed.languages,
            activities: parsed.activities,
            status: 'draft',
            locationType: locationData.locationType,
            ...(locationData.locationPlaceId && {
              locationPlaceId: locationData.locationPlaceId,
            }),
            ...(locationData.locationName && { locationName: locationData.locationName }),
            ...(locationData.locationAddress && {
              locationAddress: locationData.locationAddress,
            }),
            ...(locationData.locationLat !== undefined && {
              locationLat: locationData.locationLat,
            }),
            ...(locationData.locationLng !== undefined && {
              locationLng: locationData.locationLng,
            }),
            ...(locationData.gbpId && { gbpId: locationData.gbpId }),
          },
        })

        imported++
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error'
        errors.push({ column: rowNum, name: campName, reason })
      }
    }

    return { imported, failed: errors.length, errors }
  }
}
