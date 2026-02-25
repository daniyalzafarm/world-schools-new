import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { ConfigService } from '../../../../config/config.service'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import { sanitizeFileName } from '../../../messaging/utils/sanitization.util'

export interface ProfilePhotoUploadResult {
  url: string
  fileSizeBytes: number
  mimeType: string
}

/**
 * Allowed file extensions for profile photos (allowlist approach for security)
 * Using allowlist instead of blocklist prevents bypass attacks
 */
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

/**
 * Allowed image MIME types for profile photos
 */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']

/**
 * Maximum file size for profile photos (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024

@Injectable()
export class ProfilePhotoService {
  private readonly logger = new Logger(ProfilePhotoService.name)
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
   * Generate storage path based on user role
   */
  private async generateStoragePath(userId: string, fileExtension: string): Promise<string> {
    // Get user with roles
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        ownedProvider: {
          select: { id: true },
        },
      },
    })

    if (!user) {
      throw new BadRequestException('User not found')
    }

    // Check roles in priority order: Provider > SuperAdmin > Parent
    const roleNames = user.roles.map(ur => ur.role.name)

    if (roleNames.includes('Provider') && user.ownedProvider) {
      // Provider user: providers/{providerId}/users/{userId}/profile-photo.{ext}
      return `providers/${user.ownedProvider.id}/users/${userId}/profile-photo.${fileExtension}`
    } else if (roleNames.includes('SuperAdmin')) {
      // SuperAdmin user: superadmin/users/{userId}/profile-photo.{ext}
      return `superadmin/users/${userId}/profile-photo.${fileExtension}`
    } else {
      // Parent or other roles: users/{userId}/profile-photo.{ext}
      return `users/${userId}/profile-photo.${fileExtension}`
    }
  }

  /**
   * Extract file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg'
  }

  /**
   * Validate file upload for security
   * Checks file existence, size, MIME type, and extension
   */
  private validateFile(file: {
    buffer: Buffer
    originalname: string
    mimetype: string
    size: number
  }): void {
    // Check if file exists
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    // Check if buffer exists
    if (!file.buffer) {
      throw new BadRequestException('File buffer is missing')
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      )
    }

    // Validate MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      )
    }

    // Validate file extension using allowlist approach (more secure than blocklist)
    const fileName = file.originalname.toLowerCase()

    // Extract the actual file extension
    const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()

    // Check if extension is in the allowed list
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      throw new BadRequestException(
        `File extension '${fileExtension}' is not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}. File: ${file.originalname}`
      )
    }

    // Check for double extensions (e.g., image.jpg.exe) - security measure
    const parts = fileName.split('.')
    if (parts.length > 2) {
      throw new BadRequestException(
        `Multiple file extensions detected. Only single extension files are allowed. File: ${file.originalname}`
      )
    }
  }

  /**
   * Upload profile photo to Azure Blob Storage
   */
  async uploadPhoto(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
  ): Promise<ProfilePhotoUploadResult> {
    // Validate file for security
    this.validateFile(file)

    // Sanitize filename to prevent path traversal attacks
    const sanitizedFilename = sanitizeFileName(file.originalname)

    // Get Azure Storage service
    const azureStorage = this.getAzureStorage()

    try {
      // Get file extension from sanitized filename
      const fileExtension = this.getFileExtension(sanitizedFilename)

      // Generate storage path based on user role
      const folderPath = await this.generateStoragePath(userId, fileExtension)

      // Delete old photo if exists (get user profile first)
      const userProfile = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { profilePhotoUrl: true },
      })

      if (userProfile?.profilePhotoUrl) {
        await this.deletePhoto(userProfile.profilePhotoUrl)
      }

      // Upload file to Azure Blob Storage
      const uploadResult = await azureStorage.uploadFile({
        buffer: file.buffer,
        fileName: sanitizedFilename,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        folderPath: folderPath.substring(0, folderPath.lastIndexOf('/')),
        documentType: `profile-photo`,
        metadata: {
          userId,
          uploadedAt: new Date().toISOString(),
        },
      })

      this.logger.log(`Uploaded profile photo for user ${userId}: ${sanitizedFilename}`)

      return {
        url: uploadResult.blobName,
        fileSizeBytes: uploadResult.fileSizeBytes,
        mimeType: uploadResult.mimeType,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(
        `Failed to upload profile photo for user ${userId} (${sanitizedFilename}): ${errorMessage}`
      )
      throw new BadRequestException(`Failed to upload photo ${sanitizedFilename}: ${errorMessage}`)
    }
  }

  /**
   * Delete a photo from Azure Blob Storage
   */
  async deletePhoto(blobName: string): Promise<void> {
    try {
      const azureStorage = this.getAzureStorage()
      await azureStorage.deleteFile(blobName)
      this.logger.log(`Deleted profile photo from storage: ${blobName}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.warn(`Failed to delete photo from Azure Storage: ${errorMessage}`)
      // Don't throw error - continue with database update
    }
  }

  /**
   * Generate SAS URL for profile photo
   */
  async generatePhotoUrl(blobName: string): Promise<string> {
    try {
      const azureStorage = this.getAzureStorage()
      // Generate SAS URL for secure access (24 hours expiry)
      return await azureStorage.generateSasUrl(blobName, 24)
    } catch (error) {
      this.logger.warn(`Failed to generate SAS URL for profile photo`)
      return blobName // Return blob name as fallback
    }
  }
}
