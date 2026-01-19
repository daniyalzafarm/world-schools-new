import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { ConfigService } from '../../../config/config.service'
import { AzureStorageService } from '@world-schools/wc-utils/backend'

@Injectable()
export class UserCampsService {
  private readonly azureStorage: AzureStorageService

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    // Initialize Azure Storage Service
    this.azureStorage = new AzureStorageService(this.configService.azureStorageConfig)
  }

  /**
   * Generate SAS URLs for photos
   */
  private async generatePhotoUrls(photos: any[]): Promise<any[]> {
    return Promise.all(
      photos.map(async photo => {
        try {
          // Generate SAS URL for secure access (24 hours expiry)
          const sasUrl = await this.azureStorage.generateSasUrl(photo.url, 24)
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
   */
  async getCampBySlug(slug: string) {
    const camp = await this.prisma.camp.findUnique({
      where: {
        slug,
      },
    })

    if (!camp) {
      throw new NotFoundException(`Camp with slug "${slug}" not found`)
    }

    if (camp.status !== 'published') {
      throw new NotFoundException(`Camp with slug "${slug}" is not published`)
    }

    // Generate SAS URLs for photos if they exist
    if (camp.photos && Array.isArray(camp.photos) && camp.photos.length > 0) {
      const photosWithUrls = await this.generatePhotoUrls(camp.photos as any[])
      return { ...camp, photos: photosWithUrls }
    }

    return camp
  }
}
