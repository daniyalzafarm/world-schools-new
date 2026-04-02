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
  async getPublishedCamps() {
    const camps = await this.prisma.camp.findMany({
      where: {
        status: 'published',
      },
      orderBy: {
        publishedAt: 'desc',
      },
    })

    // Generate SAS URLs for photos
    const campsWithPhotoUrls = await Promise.all(
      camps.map(async camp => {
        if (camp.photos && Array.isArray(camp.photos) && camp.photos.length > 0) {
          const photosWithUrls = await this.generatePhotoUrls(camp.photos as any[])
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

    // Transform sessions to convert Decimal fields to numbers
    const transformedSessions = (camp.sessions || []).map(session => ({
      ...session,
      price:
        session.price !== null && session.price !== undefined
          ? Number(session.price)
          : session.price,
    }))

    return {
      ...campWithPhotos,
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
}
