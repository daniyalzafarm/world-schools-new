import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { ConfigService } from '../../../config/config.service'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import { ConversationType } from '../../../generated/client/client'
import { ConversationsService } from './conversations.service'

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
    private configService: ConfigService,
    private conversationsService: ConversationsService
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

      // Store only storage path (blob name), not full URL - URLs are built in GET APIs (like camp images)
      const thumbnailPath = this.isImage(mimeType) ? uploadResult.blobName : null

      // Determine file type from MIME type
      const fileType = this.getFileType(mimeType)

      // Create attachment record in database (storageUrl/thumbnailUrl = path on storage)
      const attachment = await this.prisma.messageAttachment.create({
        data: {
          fileName,
          fileSize: size,
          mimeType,
          fileType: fileType as any, // Cast to satisfy Prisma type
          storageUrl: uploadResult.blobName,
          thumbnailUrl: thumbnailPath,
          uploadedBy,
          ...(messageId ? { messageId } : {}), // omit when no message yet (upload-then-send)
        },
      })

      this.logger.log(`Attachment uploaded: ${attachment.id} (${fileName})`)

      // Build URLs for response (SAS URLs, not stored in DB)
      const url = await this.generateStorageUrl(attachment.storageUrl)
      const thumbnailUrl = attachment.thumbnailUrl
        ? await this.generateStorageUrl(attachment.thumbnailUrl)
        : undefined

      return {
        id: attachment.id,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        url,
        thumbnailUrl,
        blobName: uploadResult.blobName,
      }
    } catch (error) {
      this.logger.error('Failed to upload attachment:', error)
      throw new BadRequestException('Failed to upload attachment')
    }
  }

  /**
   * Generate a SAS URL for a storage path (blob name).
   * Used when returning attachment data in API responses - like camp images in get camp API.
   */
  async generateStorageUrl(storagePath: string, expiryHours = 24): Promise<string> {
    const blobName = this.getBlobName(storagePath)
    if (!blobName) return storagePath
    try {
      const azureStorage = this.getAzureStorage()
      return await azureStorage.generateSasUrl(blobName, expiryHours)
    } catch (error) {
      this.logger.warn(`Failed to generate URL for path ${storagePath}:`, error)
      return storagePath
    }
  }

  /**
   * Resolve message.attachments array (paths) to full URLs for API response.
   * Preserves all attachment fields (id, fileName, etc.); only url and thumbnailUrl are resolved.
   */
  async resolveMessageAttachmentsUrls<T extends { url: string; thumbnailUrl?: string | null }>(
    attachments: T[] | null
  ): Promise<T[]> {
    if (!attachments || attachments.length === 0) return []
    return Promise.all(
      attachments.map(async a => ({
        ...a,
        url: await this.generateStorageUrl(a.url),
        thumbnailUrl: a.thumbnailUrl ? await this.generateStorageUrl(a.thumbnailUrl) : null,
      }))
    )
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

      const blobName = this.getBlobName(attachment.storageUrl)

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
  async getAttachmentUrl(attachmentId: string, expiryHours = 24, userId?: string): Promise<string> {
    try {
      const attachment = await this.prisma.messageAttachment.findUnique({
        where: { id: attachmentId },
      })

      if (!attachment) {
        throw new NotFoundException('Attachment not found')
      }

      // Optional access control when userId is provided
      if (userId) {
        await this.ensureUserCanAccessAttachment(attachment, userId)
      }

      const blobName = this.getBlobName(attachment.storageUrl)
      if (!blobName) return attachment.storageUrl

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
  async getAttachment(attachmentId: string, userId: string): Promise<AttachmentResult> {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment) {
      throw new NotFoundException('Attachment not found')
    }

    await this.ensureUserCanAccessAttachment(attachment, userId)

    const url = await this.generateStorageUrl(attachment.storageUrl)
    const thumbnailUrl = attachment.thumbnailUrl
      ? await this.generateStorageUrl(attachment.thumbnailUrl)
      : undefined

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      url,
      thumbnailUrl,
      blobName: this.getBlobName(attachment.storageUrl) || '',
    }
  }

  /**
   * Get attachments for a message
   */
  async getMessageAttachments(messageId: string, userId: string): Promise<AttachmentResult[]> {
    // Ensure user participates in the conversation or is a provider org member (USER_PROVIDER)
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        conversationId: true,
        senderId: true,
        conversation: {
          select: {
            type: true,
            metadata: true,
            participants: {
              where: { userId },
              select: { id: true },
            },
          },
        },
      },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    const isParticipant =
      message.conversation?.participants && message.conversation.participants.length > 0

    if (!isParticipant && message.senderId !== userId) {
      const conversation = message.conversation
      const isProviderOrgMember =
        conversation?.type === ConversationType.USER_PROVIDER &&
        (conversation.metadata as { providerId?: string } | null)?.providerId &&
        (await this.conversationsService.getProviderIdForUser(userId)) ===
          (conversation.metadata as { providerId?: string }).providerId
      if (!isProviderOrgMember) {
        throw new ForbiddenException('You do not have access to these attachments')
      }
    }

    const attachments = await this.prisma.messageAttachment.findMany({
      where: { messageId },
      orderBy: { uploadedAt: 'asc' },
    })

    const result: AttachmentResult[] = []
    for (const attachment of attachments) {
      const url = await this.generateStorageUrl(attachment.storageUrl)
      const thumbnailUrl = attachment.thumbnailUrl
        ? await this.generateStorageUrl(attachment.thumbnailUrl)
        : undefined
      result.push({
        id: attachment.id,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        url,
        thumbnailUrl,
        blobName: this.getBlobName(attachment.storageUrl) || '',
      })
    }
    return result
  }

  /**
   * Ensure a user is allowed to access a specific attachment
   */
  private async ensureUserCanAccessAttachment(
    attachment: { messageId: string | null; uploadedBy: string },
    userId: string
  ): Promise<void> {
    // Uploader always has access
    if (attachment.uploadedBy === userId) {
      return
    }

    // Pre-send attachments (no associated message yet) are only visible to uploader
    if (!attachment.messageId) {
      throw new ForbiddenException('You do not have access to this attachment')
    }

    const message = await this.prisma.message.findUnique({
      where: { id: attachment.messageId },
      select: {
        conversationId: true,
        conversation: {
          select: {
            type: true,
            metadata: true,
            participants: {
              where: { userId },
              select: { id: true },
            },
          },
        },
      },
    })

    const isParticipant =
      message?.conversation?.participants && message.conversation.participants.length > 0

    if (isParticipant) return

    // For USER_PROVIDER conversations, allow provider org members who are not yet direct participants
    const conversation = message?.conversation
    if (conversation?.type === ConversationType.USER_PROVIDER) {
      const metadata = conversation.metadata as { providerId?: string } | null
      if (metadata?.providerId) {
        const userProviderId = await this.conversationsService.getProviderIdForUser(userId)
        if (userProviderId === metadata.providerId) return
      }
    }

    throw new ForbiddenException('You do not have access to this attachment')
  }

  /**
   * Get blob name (storage path). storageUrl may be stored as path (blob name) or legacy full URL.
   */
  private getBlobName(storageUrl: string): string | null {
    if (!storageUrl) return null
    if (!storageUrl.includes('://')) return storageUrl
    return this.extractBlobNameFromUrl(storageUrl)
  }

  /**
   * Extract blob name from Azure Storage URL (for legacy records that stored full URL)
   */
  private extractBlobNameFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      if (pathParts.length > 1) return pathParts.slice(1).join('/')
      return null
    } catch {
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
