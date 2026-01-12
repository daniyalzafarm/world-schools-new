import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { ConfigService } from '../../../../config/config.service'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import { v4 as uuidv4 } from 'uuid'

export interface CampPhotoUploadResult {
  id: string
  url: string
  thumbnail: string
  isPrimary: boolean
  order: number
  fileSizeBytes: number
  mimeType: string
}

@Injectable()
export class PhotoUploadService {
  private readonly logger = new Logger(PhotoUploadService.name)
  private readonly azureStorage: AzureStorageService

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    // Initialize Azure Storage Service
    this.azureStorage = new AzureStorageService(this.configService.azureStorageConfig)
  }

  /**
   * Upload multiple camp photos to Azure Blob Storage
   */
  async uploadPhotos(
    campId: string,
    providerId: string,
    files: Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }>,
    existingPhotos: any[] = []
  ): Promise<CampPhotoUploadResult[]> {
    const uploadedPhotos: CampPhotoUploadResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file
      const validation = this.azureStorage.validateFile(
        { size: file.size, mimetype: file.mimetype },
        {
          maxSizeBytes: 5 * 1024 * 1024, // 5MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
        }
      )

      if (!validation.isValid) {
        throw new BadRequestException(`File ${file.originalname}: ${validation.error}`)
      }

      try {
        // Generate unique photo ID
        const photoId = uuidv4()

        // Upload file to Azure Blob Storage
        const uploadResult = await this.azureStorage.uploadFile({
          buffer: file.buffer,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          folderPath: `providers/${providerId}/camps/${campId}/photos`,
          documentType: `photo_${photoId}`,
          metadata: {
            providerId,
            campId,
            photoId,
            uploadedAt: new Date().toISOString(),
          },
        })

        // Calculate order (existing photos + current index)
        const order = existingPhotos.length + i

        uploadedPhotos.push({
          id: photoId,
          url: uploadResult.blobName,
          thumbnail: uploadResult.blobName, // For now, use same URL for thumbnail
          isPrimary: order === 0, // First photo is primary
          order,
          fileSizeBytes: uploadResult.fileSizeBytes,
          mimeType: uploadResult.mimeType,
        })

        this.logger.log(`Uploaded photo ${photoId} for camp ${campId}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        this.logger.error(`Failed to upload photo for camp ${campId}: ${errorMessage}`)
        throw new BadRequestException(`Failed to upload photo: ${errorMessage}`)
      }
    }

    return uploadedPhotos
  }

  /**
   * Delete a photo from Azure Blob Storage
   */
  async deletePhoto(blobName: string): Promise<void> {
    try {
      await this.azureStorage.deleteFile(blobName)
      this.logger.log(`Deleted photo from storage: ${blobName}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.warn(`Failed to delete photo from Azure Storage: ${errorMessage}`)
      // Don't throw error - continue with database deletion
    }
  }

  /**
   * Generate SAS URLs for photos
   */
  async generatePhotoUrls(photos: any[]): Promise<any[]> {
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
          this.logger.warn(`Failed to generate SAS URL for photo ${photo.id}`)
          return photo
        }
      })
    )
  }

  /**
   * Delete multiple photos from storage
   */
  async deletePhotos(photos: any[]): Promise<void> {
    for (const photo of photos) {
      if (photo.url) {
        await this.deletePhoto(photo.url)
      }
    }
  }
}
