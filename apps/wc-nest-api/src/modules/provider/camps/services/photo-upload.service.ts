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
  private azureStorage: AzureStorageService | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
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
        throw new BadRequestException(
          'Azure Storage is not configured. Please contact the administrator to enable photo uploads.'
        )
      }
      this.azureStorage = new AzureStorageService(config)
    }
    return this.azureStorage
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

      // Get Azure Storage service
      const azureStorage = this.getAzureStorage()

      // Validate file
      const validation = azureStorage.validateFile(
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
        const uploadResult = await azureStorage.uploadFile({
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
      const azureStorage = this.getAzureStorage()
      await azureStorage.deleteFile(blobName)
      this.logger.log(`Deleted photo from storage: ${blobName}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.warn(`Failed to delete photo from Azure Storage: ${errorMessage}`)
      // Don't throw error - continue with database deletion
    }
  }

  /**
   * Extract blob name from a URL (handles both blob URLs and SAS URLs)
   *
   * This method is used ONLY at the input boundary (updateCampPhotos) to sanitize
   * incoming photo URLs from the frontend. It should NOT be used in read paths.
   *
   * @param url - The URL to extract the blob name from (can be a blob name, blob URL, or SAS URL)
   * @returns The blob name without query parameters or protocol
   *
   * @example
   * // Blob name (already clean)
   * extractBlobName('providers/123/camps/456/photos/photo.jpg')
   * // Returns: 'providers/123/camps/456/photos/photo.jpg'
   *
   * @example
   * // SAS URL (needs sanitization)
   * extractBlobName('https://account.blob.core.windows.net/container/providers/123/photos/photo.jpg?sv=2021&sig=abc')
   * // Returns: 'providers/123/photos/photo.jpg'
   */
  extractBlobName(url: string): string {
    try {
      // If it's already a blob name (no protocol), return as is
      if (!url.includes('://')) {
        return url
      }

      // Parse the URL to remove query parameters (SAS tokens)
      const urlObj = new URL(url)

      // Extract the path after the container name
      // Format: https://{account}.blob.core.windows.net/{container}/{blobName}
      const pathParts = urlObj.pathname.split('/')

      // Remove empty strings and container name (first two parts)
      const blobNameParts = pathParts.filter(part => part !== '').slice(1)

      return blobNameParts.join('/')
    } catch (error) {
      this.logger.warn(`Failed to extract blob name from URL: ${url}`)
      // Return the original URL if parsing fails
      return url
    }
  }

  /**
   * Generate SAS URLs for photos
   * Note: Expects photo.url to be a blob name, not a full URL
   */
  async generatePhotoUrls(photos: any[]): Promise<any[]> {
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
