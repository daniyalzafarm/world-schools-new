import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { ConfigService } from '../../../../config/config.service'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import { sanitizeFileName } from '../../../messaging/utils/sanitization.util'

export interface ProviderLogoUploadResult {
  url: string
  fileSizeBytes: number
  mimeType: string
}

/**
 * Allowed file extensions for provider logos (allowlist approach for security)
 */
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

/**
 * Allowed image MIME types for provider logos
 */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']

/**
 * Maximum file size for provider logos (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024

@Injectable()
export class ProviderLogoService {
  private readonly logger = new Logger(ProviderLogoService.name)
  private azureStorage: AzureStorageService | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Get or initialize Azure Storage Service
   */
  private getAzureStorage(): AzureStorageService {
    if (!this.azureStorage) {
      const config = this.configService.azureStorageConfig
      if (!config.accountName || !config.accountKey || !config.containerName) {
        throw new BadRequestException(
          'Azure Storage is not configured. Please contact the administrator to enable logo uploads.'
        )
      }
      this.azureStorage = new AzureStorageService(config)
    }
    return this.azureStorage
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
   */
  private validateFile(file: {
    buffer: Buffer
    originalname: string
    mimetype: string
    size: number
  }): void {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    if (!file.buffer) {
      throw new BadRequestException('File buffer is missing')
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      )
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      )
    }

    const fileName = file.originalname.toLowerCase()
    const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()

    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      throw new BadRequestException(
        `File extension '${fileExtension}' is not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
    }

    // Check for double extensions (e.g., image.jpg.exe) - security measure
    const parts = fileName.split('.')
    if (parts.length > 2) {
      throw new BadRequestException(
        `Multiple file extensions detected. Only single extension files are allowed.`
      )
    }
  }

  /**
   * Upload provider logo to Azure Blob Storage
   */
  async uploadLogo(
    providerId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
  ): Promise<ProviderLogoUploadResult> {
    this.validateFile(file)

    const sanitizedFilename = sanitizeFileName(file.originalname)
    const azureStorage = this.getAzureStorage()

    try {
      const fileExtension = this.getFileExtension(sanitizedFilename)
      const folderPath = `providers/${providerId}`
      const timestamp = Date.now()
      const logoFileName = `logo-${timestamp}-${providerId}.${fileExtension}`

      // Fetch old blob name before uploading so we can delete it after success
      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId },
        select: { logoUrl: true },
      })
      const oldLogoUrl = provider?.logoUrl ?? null

      const uploadResult = await azureStorage.uploadFile({
        buffer: file.buffer,
        fileName: logoFileName,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        folderPath,
        documentType: 'provider-logo',
        metadata: {
          providerId,
          uploadedAt: new Date().toISOString(),
        },
      })

      // Delete old logo only after new upload succeeds
      if (oldLogoUrl) {
        await this.deleteLogo(oldLogoUrl)
      }

      this.logger.log(`Uploaded logo for provider ${providerId}: ${logoFileName}`)

      return {
        url: uploadResult.blobName,
        fileSizeBytes: uploadResult.fileSizeBytes,
        mimeType: uploadResult.mimeType,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to upload logo for provider ${providerId}: ${errorMessage}`)
      throw new BadRequestException(`Failed to upload logo: ${errorMessage}`)
    }
  }

  /**
   * Delete a logo from Azure Blob Storage
   */
  async deleteLogo(blobName: string): Promise<void> {
    try {
      const azureStorage = this.getAzureStorage()
      await azureStorage.deleteFile(blobName)
      this.logger.log(`Deleted provider logo from storage: ${blobName}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.warn(`Failed to delete logo from Azure Storage: ${errorMessage}`)
      // Don't throw — continue with database update
    }
  }

  /**
   * Generate SAS URL for provider logo (24-hour expiry)
   */
  async generateLogoUrl(blobName: string): Promise<string> {
    try {
      const azureStorage = this.getAzureStorage()
      return await azureStorage.generateSasUrl(blobName, 24)
    } catch (error) {
      this.logger.warn(`Failed to generate SAS URL for provider logo`)
      return blobName
    }
  }
}
