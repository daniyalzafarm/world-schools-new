import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../../prisma/prisma.service'
import { ConfigService } from '../../../config/config.service'
import { AzureStorageService } from '@world-schools/wc-utils/backend'

@Injectable()
export class UserCampsService {
  private azureStorage: AzureStorageService | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
  ) {
    // Azure Storage Service will be initialized lazily when needed
  }

  /**
   * Get or initialize Azure Storage Service
   */
  private getAzureStorage(): AzureStorageService {
    if (!this.azureStorage) {
      const config = this.configService.azureStorageConfig
      if (!config.accountName || !config.accountKey || !config.containerName) {
        throw new Error('Azure Storage is not configured. Please contact the administrator.')
      }
      this.azureStorage = new AzureStorageService(config)
    }
    return this.azureStorage
  }

  /**
   * Generate SAS URLs for photos
   */
  private async generatePhotoUrls(photos: any[]): Promise<any[]> {
    const azureStorage = this.getAzureStorage()
    return Promise.all(
      photos.map(async photo => {
        try {
          // Generate SAS URL for secure access (24 hours expiry)
          const sasUrl = await azureStorage.generateSasUrl(photo.url, 24)
          return {
            ...photo,
            url: sasUrl,
            thumbnail: sasUrl, // Use same SAS URL for thumbnail
          }
        } catch (error) {
          // If SAS URL generation fails, return original photo
          return photo
        }
      })
    )
  }

  /**
   * Get all published camps
   */
  async getPublishedCamps(search?: string) {
    const camps = await this.prisma.camp.findMany({
      where: {
        status: 'published',
        ...(search?.trim() && {
          name: { contains: search.trim(), mode: 'insensitive' },
        }),
      },
      orderBy: { publishedAt: 'desc' },
      // Limit search results to keep the response fast
      ...(search?.trim() && { take: 15 }),
    })

    // Generate SAS URL for the primary/first photo only (thumbnail for search results)
    const campsWithPhotoUrls = await Promise.all(
      camps.map(async camp => {
        if (camp.photos && Array.isArray(camp.photos) && camp.photos.length > 0) {
          const photosWithUrls = await this.generatePhotoUrls(camp.photos as any[])
          return { ...camp, photos: photosWithUrls }
        }
        return camp
      })
    )

    return campsWithPhotoUrls
  }

  /**
   * Get a published camp by slug
   * Only returns camps with status 'published' and their active sessions
   * Supports preview mode with JWT token for providers to view unpublished camps
   */
  async getCampBySlug(slug: string, previewToken?: string) {
    // Determine if we're in preview mode
    let isPreviewMode = false
    let previewProviderId: string | null = null

    if (previewToken) {
      try {
        // Verify and decode the preview token
        const payload = this.jwtService.verify(previewToken, {
          secret: this.configService.jwtConfig.secret,
        })

        // Validate token type and extract provider ID
        if (payload.type === 'preview' && payload.slug === slug) {
          isPreviewMode = true
          previewProviderId = payload.providerId
        }
      } catch (error) {
        // Invalid or expired token - throw unauthorized error
        throw new UnauthorizedException('Invalid or expired preview token')
      }
    }

    // Build the where clause based on preview mode
    const whereClause: any = { slug }

    if (!isPreviewMode) {
      // Public mode: only show published camps
      whereClause.status = 'published'
    } else if (previewProviderId) {
      // Preview mode: show camp only if it belongs to the provider
      whereClause.providerId = previewProviderId
    }

    const camp = await this.prisma.camp.findFirst({
      where: whereClause,
      include: {
        sessions: {
          where: {
            status: 'published', // Only include published sessions for public viewing
          },
          orderBy: [
            { sortOrder: 'asc' }, // by sort order
            { startDate: 'asc' }, // then by start date
          ],
        },
        campFocusRecord: {
          include: {
            activity: { select: { id: true, name: true, emoji: true, slug: true } },
            category: { select: { id: true, name: true, emoji: true, slug: true } },
          },
        },
        provider: {
          select: {
            id: true,
            legalCompanyName: true,
            legalStreetAddress: true,
            legalCity: true,
            legalStateProvince: true,
            legalPostalCode: true,
            legalCountry: true,
            phone: true,
            email: true,
            website: true,
            yearFounded: true,
            description: true,
            trustScore: true,
            approvalStatus: true,
            logoUrl: true,
            _count: {
              select: {
                camps: { where: { status: 'published' } },
              },
            },
            googleBusinessProfile: {
              select: {
                businessName: true,
                formattedAddress: true,
                rating: true,
                reviewsCount: true,
                phone: true,
                website: true,
              },
            },
            settings: {
              select: {
                currency: true,
                cancellationPolicy: true,
                cancellationPolicyCustom: true,
                depositRequired: true,
                depositType: true,
                depositPercentage: true,
                depositFixedAmount: true,
              },
            },
          },
        },
      },
    })

    if (!camp) {
      throw new NotFoundException(`The camp you are looking for does not exist.`)
    }

    // Generate SAS URLs for photos if they exist
    let campWithPhotos = camp
    if (camp.photos && Array.isArray(camp.photos) && camp.photos.length > 0) {
      const photosWithUrls = await this.generatePhotoUrls(camp.photos as any[])
      campWithPhotos = { ...camp, photos: photosWithUrls }
    }

    // Generate SAS URL for provider logo if it exists
    if (campWithPhotos.provider?.logoUrl) {
      try {
        const azureStorage = this.getAzureStorage()
        const logoSasUrl = await azureStorage.generateSasUrl(campWithPhotos.provider.logoUrl, 24)
        campWithPhotos = {
          ...campWithPhotos,
          provider: { ...campWithPhotos.provider, logoUrl: logoSasUrl },
        }
      } catch {
        // Fall back to the blob name if SAS URL generation fails
      }
    }

    // Compute bookedCount per session in a single grouped query
    const sessionIds = (camp.sessions || []).map(s => s.id)
    const bookingCounts =
      sessionIds.length > 0
        ? await this.prisma.booking.groupBy({
            by: ['sessionId'],
            where: {
              sessionId: { in: sessionIds },
              bookingGroup: {
                status: { notIn: ['draft', 'declined', 'expired', 'cancelled'] },
              },
            },
            _count: { id: true },
          })
        : []

    const countMap = Object.fromEntries(bookingCounts.map(r => [r.sessionId, r._count.id]))

    // Transform sessions: convert Decimals, normalize JSON keys, attach bookedCount
    const transformedSessions = (camp.sessions || []).map(session => ({
      ...session,
      price: session.price != null ? Number(session.price) : session.price,
      bookedCount: countMap[session.id] ?? 0,
      ageGroupPrices: Array.isArray(session.ageGroupPrices)
        ? (session.ageGroupPrices as any[]).map(agp => ({
            ageGroupId: agp.age_group_id ?? agp.ageGroupId,
            price: agp.price,
          }))
        : null,
      ageGroupSpots: Array.isArray(session.ageGroupSpots)
        ? (session.ageGroupSpots as any[]).map(ags => ({
            ageGroupId: ags.age_group_id ?? ags.ageGroupId,
            spots: ags.spots,
          }))
        : null,
    }))

    return {
      ...campWithPhotos,
      locationLat: camp.locationLat != null ? Number(camp.locationLat) : null,
      locationLng: camp.locationLng != null ? Number(camp.locationLng) : null,
      sessions: transformedSessions,
    }
  }

  async getCampSessions(campId: string) {
    const camp = await this.prisma.camp.findFirst({
      where: { id: campId, status: 'published' },
      select: { id: true },
    })
    if (!camp) throw new NotFoundException('Camp not found')

    const sessions = await this.prisma.session.findMany({
      where: {
        campId,
        status: 'published',
      },
      orderBy: [{ sortOrder: 'asc' }, { startDate: 'asc' }],
    })

    return sessions.map(session => ({
      ...session,
      price:
        session.price !== null && session.price !== undefined
          ? Number(session.price)
          : session.price,
    }))
  }

  async getCampAddOns(campId: string) {
    const camp = await this.prisma.camp.findFirst({
      where: { id: campId, status: 'published' },
      select: { id: true },
    })
    if (!camp) throw new NotFoundException('Camp not found')

    const campAddOns = await this.prisma.campAddOn.findMany({
      where: {
        campId,
        isEnabled: true,
        addOn: {
          isActive: true,
        },
      },
      include: {
        addOn: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { addOn: { sortOrder: 'asc' } }],
    })

    return campAddOns.map(item => ({
      campId: item.campId,
      addOnId: item.addOnId,
      sortOrder: item.sortOrder,
      name: item.addOn.name,
      description: item.addOn.description,
      icon: item.addOn.icon,
      type: item.addOn.type,
      price: Number(item.addOn.price),
      currency: item.addOn.currency,
      pricingUnit: item.addOn.pricingUnit,
      maxQuantity: item.addOn.maxQuantity,
      quantityUnit: item.addOn.quantityUnit,
      minAge: item.addOn.minAge,
      maxAge: item.addOn.maxAge,
    }))
  }

  async getCampReviews(campId: string) {
    const camp = await this.prisma.camp.findFirst({
      where: { id: campId, status: 'published' },
      select: { id: true },
    })
    if (!camp) throw new NotFoundException('Camp not found')

    const reviews = await this.prisma.campReview.findMany({
      where: { campId, status: 'published' },
      orderBy: { publishedAt: 'desc' },
      include: {
        parent: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                city: true,
                country: true,
              },
            },
          },
        },
        tags: {
          select: { id: true, dimension: true, tagValue: true },
        },
      },
    })

    // Compute per-dimension averages across all published reviews
    const agg = await this.prisma.campReview.aggregate({
      where: { campId, status: 'published' },
      _avg: {
        happinessRating: true,
        safetyRating: true,
        communicationRating: true,
        asDescribedRating: true,
        growthRating: true,
        valueRating: true,
      },
      _count: { _all: true },
    })

    const round1 = (v: number | null) => (v != null ? Math.round(v * 10) / 10 : null)

    const categoryScores = {
      happiness: round1(agg._avg.happinessRating as unknown as number | null),
      safety: round1(agg._avg.safetyRating as unknown as number | null),
      communication: round1(agg._avg.communicationRating as unknown as number | null),
      asDescribed: round1(agg._avg.asDescribedRating as unknown as number | null),
      growth: round1(agg._avg.growthRating as unknown as number | null),
      value: round1(agg._avg.valueRating as unknown as number | null),
    }

    const allDims = Object.values(categoryScores).filter((v): v is number => v != null)
    const overallRating =
      allDims.length > 0
        ? Math.round((allDims.reduce((a, b) => a + b, 0) / allDims.length) * 10) / 10
        : null

    const mappedReviews = reviews.map(r => ({
      id: r.id,
      rating: (() => {
        const dims = [
          r.happinessRating,
          r.safetyRating,
          r.communicationRating,
          r.asDescribedRating,
          r.growthRating,
          r.valueRating,
        ].filter((v): v is number => v != null)
        return dims.length > 0
          ? Math.round((dims.reduce((a, b) => a + b, 0) / dims.length) * 10) / 10
          : null
      })(),
      reviewText: r.reviewText,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      visitMonth: r.visitMonth,
      visitYear: r.visitYear,
      kidAges: r.kidAges,
      kidTags: r.kidTags,
      tags: r.tags.map(t => t.tagValue),
      reviewer: {
        firstName: r.parent.user.firstName,
        lastName: r.parent.user.lastName,
        city: r.parent.user.city,
        country: r.parent.user.country,
      },
    }))

    return {
      totalReviews: agg._count._all,
      overallRating,
      categoryScores,
      reviews: mappedReviews,
    }
  }
}
