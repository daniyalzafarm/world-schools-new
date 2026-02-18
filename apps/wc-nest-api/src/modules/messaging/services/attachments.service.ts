import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { ConfigService } from '../../../config/config.service'
import { AzureStorageService } from '@world-schools/wc-utils/backend'

/**
 * Attachment upload options
 */
export interface UploadAttachmentOptions {
  buffer: Buffer
  fileName: string
  mimeType: string
  size: number
  messageId?: string
  uploadedBy: string
}

/**
 * Attachment result
 */
export interface AttachmentResult {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  url: string
  thumbnailUrl?: string
  blobName: string
}

/**
 * Attachments Service for managing message attachments
 * Handles file uploads to Azure Blob Storage, thumbnail generation, and CDN URLs
 */
@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name)
  private azureStorage: AzureStorageService | null = null
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
  private readonly ALLOWED_MIME_TYPES = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text
    'text/plain',
    'text/csv',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    // Video
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
  ]

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
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
        this.logger.warn(
          'Azure Storage is not configured. Attachment uploads will fail until configuration is provided.'
        )
        throw new Error(
          'Azure Storage is not configured. Please contact the administrator to enable attachment uploads.'
        )
      }
      this.azureStorage = new AzureStorageService(config)
    }
    return this.azureStorage
  }

  /**
   * Upload an attachment to Azure Blob Storage
   */
  async uploadAttachment(options: UploadAttachmentOptions): Promise<AttachmentResult> {
    const { buffer, fileName, mimeType, size, messageId, uploadedBy } = options

    // Validate file
    this.validateFile(size, mimeType)

    try {
      // Upload to Azure Blob Storage
      const azureStorage = this.getAzureStorage()
      const uploadResult = await azureStorage.uploadFile({
        buffer,
        fileName,
        mimeType,
        fileSizeBytes: size,
        folderPath: 'messages/attachments',
        metadata: {
          uploadedBy,
          messageId: messageId || 'pending',
          uploadedAt: new Date().toISOString(),
        },
      })

      // Generate thumbnail for images
      let thumbnailUrl: string | undefined
      if (this.isImage(mimeType)) {
        const thumbnail = await this.generateThumbnail(uploadResult.blobName)
        thumbnailUrl = thumbnail ?? undefined
      }

      // Determine file type from MIME type
      const fileType = this.getFileType(mimeType)

      // Create attachment record in database
      const attachment = await this.prisma.messageAttachment.create({
        data: {
          fileName,
          fileSize: size,
          mimeType,
          fileType: fileType as any, // Cast to satisfy Prisma type
          storageUrl: uploadResult.url,
          cdnUrl: uploadResult.url, // Use same URL for now
          thumbnailUrl,
          uploadedBy,
          messageId: messageId || '', // Temporary - will be updated when message is created
        },
      })

      this.logger.log(`Attachment uploaded: ${attachment.id} (${fileName})`)

      return {
        id: attachment.id,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        url: attachment.storageUrl,
        thumbnailUrl: attachment.thumbnailUrl || undefined,
        blobName: uploadResult.blobName,
      }
    } catch (error) {
      this.logger.error('Failed to upload attachment:', error)
      throw new BadRequestException('Failed to upload attachment')
    }
  }

  /**
   * Generate a thumbnail for an image attachment
   * For now, returns the same URL - can be enhanced with actual thumbnail generation
   */
  async generateThumbnail(blobName: string): Promise<string | null> {
    try {
      // TODO: Implement actual thumbnail generation using Sharp or similar library
      // For now, return a SAS URL to the original image
      const azureStorage = this.getAzureStorage()
      const sasUrl = await azureStorage.generateSasUrl(blobName, 24)
      return sasUrl
    } catch (error) {
      this.logger.error('Failed to generate thumbnail:', error)
      return null
    }
  }

  /**
   * Delete an attachment from Azure Blob Storage and database
   */
  async deleteAttachment(attachmentId: string, userId: string): Promise<boolean> {
    try {
      // Get attachment from database
      const attachment = await this.prisma.messageAttachment.findUnique({
        where: { id: attachmentId },
      })

      if (!attachment) {
        throw new NotFoundException('Attachment not found')
      }

      // Verify user has permission to delete (must be uploader)
      if (attachment.uploadedBy !== userId) {
        throw new BadRequestException('You do not have permission to delete this attachment')
      }

      // Extract blob name from storage URL
      const blobName = this.extractBlobNameFromUrl(attachment.storageUrl)

      // Delete from Azure Blob Storage
      if (blobName) {
        const azureStorage = this.getAzureStorage()
        await azureStorage.deleteFile(blobName)
      }

      // Delete from database
      await this.prisma.messageAttachment.delete({
        where: { id: attachmentId },
      })

      this.logger.log(`Attachment deleted: ${attachmentId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to delete attachment ${attachmentId}:`, error)
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error
      }
      throw new BadRequestException('Failed to delete attachment')
    }
  }

  /**
   * Get a signed CDN URL for an attachment
   */
  async getAttachmentUrl(attachmentId: string, expiryHours = 24): Promise<string> {
    try {
      const attachment = await this.prisma.messageAttachment.findUnique({
        where: { id: attachmentId },
      })

      if (!attachment) {
        throw new NotFoundException('Attachment not found')
      }

      // Extract blob name from storage URL
      const blobName = this.extractBlobNameFromUrl(attachment.storageUrl)

      if (!blobName) {
        // Return existing URL if we can't extract blob name
        return attachment.cdnUrl || attachment.storageUrl
      }

      // Generate SAS URL with specified expiry
      const azureStorage = this.getAzureStorage()
      const sasUrl = await azureStorage.generateSasUrl(blobName, expiryHours)

      this.logger.debug(`Generated SAS URL for attachment ${attachmentId}`)
      return sasUrl
    } catch (error) {
      this.logger.error(`Failed to get attachment URL for ${attachmentId}:`, error)
      if (error instanceof NotFoundException) {
        throw error
      }
      throw new BadRequestException('Failed to get attachment URL')
    }
  }

  /**
   * Validate file size and type
   */
  private validateFile(size: number, mimeType: string): void {
    // Validate file size
    if (size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds ${this.MAX_FILE_SIZE / (1024 * 1024)}MB limit`
      )
    }

    // Validate MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`
      )
    }
  }

  /**
   * Check if file is an image
   */
  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/')
  }

  /**
   * Get attachment by ID
   */
  async getAttachment(attachmentId: string): Promise<AttachmentResult> {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment) {
      throw new NotFoundException('Attachment not found')
    }

    const blobName = this.extractBlobNameFromUrl(attachment.storageUrl)

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      url: attachment.cdnUrl || attachment.storageUrl,
      thumbnailUrl: attachment.thumbnailUrl || undefined,
      blobName: blobName || '',
    }
  }

  /**
   * Get attachments for a message
   */
  async getMessageAttachments(messageId: string): Promise<AttachmentResult[]> {
    const attachments = await this.prisma.messageAttachment.findMany({
      where: { messageId },
      orderBy: { uploadedAt: 'asc' },
    })

    return attachments.map(attachment => {
      const blobName = this.extractBlobNameFromUrl(attachment.storageUrl)
      return {
        id: attachment.id,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        url: attachment.cdnUrl || attachment.storageUrl,
        thumbnailUrl: attachment.thumbnailUrl || undefined,
        blobName: blobName || '',
      }
    })
  }

  /**
   * Extract blob name from Azure Storage URL
   */
  private extractBlobNameFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url)
      // Remove leading slash and container name
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      if (pathParts.length > 1) {
        // Skip container name (first part) and return the rest
        return pathParts.slice(1).join('/')
      }
      return null
    } catch (error) {
      this.logger.error('Failed to extract blob name from URL:', error)
      return null
    }
  }

  /**
   * Determine file type from MIME type
   */
  private getFileType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'IMAGE'
    if (mimeType.startsWith('video/')) return 'VIDEO'
    if (mimeType.startsWith('audio/')) return 'AUDIO'
    if (mimeType === 'application/pdf') return 'DOCUMENT'
    if (mimeType.includes('word') || mimeType.includes('document')) return 'DOCUMENT'
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'DOCUMENT'
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'DOCUMENT'
    if (mimeType === 'text/plain' || mimeType === 'text/csv') return 'DOCUMENT'
    if (mimeType === 'application/zip' || mimeType.includes('compressed')) return 'ARCHIVE'
    return 'OTHER'
  }
}
