import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { ConfigService } from '../../../../config/config.service'
import { TrustScoreService } from './trust-score.service'
import { AzureStorageService } from '@world-schools/wc-utils/backend'

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name)
  private azureStorage: AzureStorageService | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly trustScoreService: TrustScoreService
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
          'Azure Storage is not configured. Please contact the administrator to enable document uploads.'
        )
      }
      this.azureStorage = new AzureStorageService(config)
    }
    return this.azureStorage
  }

  /**
   * Upload and process a document
   * If a document of the same type already exists, it will be replaced
   */
  async uploadDocument(
    providerId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    documentType: string,
    customTitle?: string
  ): Promise<any> {
    // Validate file
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    // Get Azure Storage service (will throw error if not configured)
    const azureStorage = this.getAzureStorage()

    // Validate file using Azure Storage service
    const validation = azureStorage.validateFile(
      { size: file.size, mimetype: file.mimetype },
      {
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
      }
    )

    if (!validation.isValid) {
      throw new BadRequestException(validation.error)
    }

    try {
      // Check if a document of this type already exists
      const existingDocument = await this.prisma.verificationDocument.findFirst({
        where: {
          providerId,
          documentType,
        },
      })

      // If exists, delete the old document from storage
      if (existingDocument) {
        try {
          await azureStorage.deleteFile(existingDocument.fileUrl)
          this.logger.log(
            `Deleted old document ${existingDocument.id} from storage for replacement`
          )
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          this.logger.warn(`Failed to delete old file from Azure Storage: ${errorMessage}`)
          // Continue with upload even if deletion fails
        }
      }

      // Upload file to Azure Blob Storage
      const metadata: Record<string, string> = {
        providerId,
        documentType,
        uploadedAt: new Date().toISOString(),
      }

      // Only add customTitle to metadata if it's provided
      if (customTitle) {
        metadata.customTitle = customTitle
      }

      const uploadResult = await azureStorage.uploadFile({
        buffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        folderPath: `providers/${providerId}/verification`,
        documentType: documentType,
        metadata,
      })

      // If document exists, update it; otherwise create new
      const document = existingDocument
        ? await this.prisma.verificationDocument.update({
            where: { id: existingDocument.id },
            data: {
              fileUrl: uploadResult.blobName,
              fileName: file.originalname,
              fileSizeBytes: uploadResult.fileSizeBytes,
              mimeType: uploadResult.mimeType,
              customTitle: customTitle ?? undefined,
              reviewStatus: 'pending',
              uploadedAt: new Date(),
            },
          })
        : await this.prisma.verificationDocument.create({
            data: {
              providerId,
              documentType,
              customTitle: customTitle ?? undefined,
              fileUrl: uploadResult.blobName,
              fileName: file.originalname,
              fileSizeBytes: uploadResult.fileSizeBytes,
              mimeType: uploadResult.mimeType,
              reviewStatus: 'pending',
            },
          })

      // Update trust score
      await this.trustScoreService.updateTrustScore(providerId)

      this.logger.log(
        `${existingDocument ? 'Replaced' : 'Uploaded'} document ${document.id} for provider ${providerId}`
      )

      return document
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to upload document: ${errorMessage}`, errorStack)
      throw new BadRequestException('Failed to upload document')
    }
  }

  /**
   * Get all documents for a provider with SAS URLs
   */
  async getDocuments(providerId: string): Promise<any[]> {
    const documents = await this.prisma.verificationDocument.findMany({
      where: { providerId },
      orderBy: { uploadedAt: 'desc' },
    })

    // Get Azure Storage service (will throw error if not configured)
    const azureStorage = this.getAzureStorage()

    // Generate SAS URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async doc => {
        try {
          // Generate SAS URL for secure access (24 hours expiry)
          const sasUrl = await azureStorage.generateSasUrl(doc.fileUrl, 24)
          return {
            ...doc,
            fileUrl: sasUrl, // Replace blob name with SAS URL
          }
        } catch {
          this.logger.warn(`Failed to generate SAS URL for document ${doc.id}`)
          return doc
        }
      })
    )

    return documentsWithUrls
  }

  /**
   * Delete a document
   */
  async deleteDocument(providerId: string, documentId: string): Promise<void> {
    const document = await this.prisma.verificationDocument.findFirst({
      where: {
        id: documentId,
        providerId,
      },
    })

    if (!document) {
      throw new BadRequestException('Document not found')
    }

    // Get Azure Storage service (will throw error if not configured)
    const azureStorage = this.getAzureStorage()

    // Delete file from Azure Blob Storage
    try {
      await azureStorage.deleteFile(document.fileUrl)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.warn(`Failed to delete file from Azure Storage: ${errorMessage}`)
    }

    // Delete document record
    await this.prisma.verificationDocument.delete({
      where: { id: documentId },
    })

    // Update trust score
    await this.trustScoreService.updateTrustScore(providerId)

    this.logger.log(`Deleted document ${documentId} for provider ${providerId}`)
  }
}
