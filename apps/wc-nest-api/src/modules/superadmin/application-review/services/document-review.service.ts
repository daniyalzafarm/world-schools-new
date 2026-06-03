import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NotificationType } from '@world-schools/wc-types'
import { PrismaService } from '../../../../prisma/prisma.service'
import { ConfigService } from '../../../../config/config.service'
import { TrustScoreService } from '../../../provider/onboarding/services/trust-score.service'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import { notify } from '../../../notifications/dispatcher/notify'
import { ReviewDocumentDto } from '../dto/application-review.dto'

@Injectable()
export class DocumentReviewService {
  private readonly logger = new Logger(DocumentReviewService.name)
  private azureStorage: AzureStorageService | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly trustScoreService: TrustScoreService,
    private readonly eventEmitter: EventEmitter2
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
          'Azure Storage is not configured. Please contact the administrator to enable document access.'
        )
      }
      this.azureStorage = new AzureStorageService(config)
    }
    return this.azureStorage
  }

  /**
   * Get all documents for a provider with SAS URLs
   */
  async getProviderDocuments(providerId: string): Promise<any[]> {
    const documents = await this.prisma.verificationDocument.findMany({
      where: { providerId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        reviewedByAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
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
   * Get a specific document with SAS URL
   */
  async getDocument(documentId: string): Promise<any> {
    const document = await this.prisma.verificationDocument.findUnique({
      where: { id: documentId },
      include: {
        provider: {
          select: {
            id: true,
            legalCompanyName: true,
            email: true,
          },
        },
        reviewedByAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!document) {
      throw new NotFoundException('Document not found')
    }

    // Get Azure Storage service (will throw error if not configured)
    const azureStorage = this.getAzureStorage()

    // Generate SAS URL for secure access
    try {
      const sasUrl = await azureStorage.generateSasUrl(document.fileUrl, 24)
      return {
        ...document,
        fileUrl: sasUrl,
      }
    } catch {
      this.logger.warn(`Failed to generate SAS URL for document ${document.id}`)
      return document
    }
  }

  /**
   * Review a document (approve, reject, or request reupload)
   */
  async reviewDocument(
    documentId: string,
    reviewerId: string,
    dto: ReviewDocumentDto
  ): Promise<void> {
    const document = await this.prisma.verificationDocument.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw new NotFoundException('Document not found')
    }

    // Validate rejection reason is provided if status is rejected
    if (dto.reviewStatus === 'rejected' && !dto.rejectionReason) {
      throw new BadRequestException('Rejection reason is required when rejecting a document')
    }

    await this.prisma.verificationDocument.update({
      where: { id: documentId },
      data: {
        reviewStatus: dto.reviewStatus as 'approved' | 'rejected' | 'needs_reupload',
        reviewNotes: dto.reviewNotes,
        rejectionReason: dto.rejectionReason,
        reviewedAt: new Date(),
        reviewedByAdminId: reviewerId,
      },
    })

    // Update trust score after document review
    await this.trustScoreService.updateTrustScore(document.providerId)

    this.logger.log(
      `Reviewed document ${documentId} with status ${dto.reviewStatus} by reviewer ${reviewerId}`
    )

    // v28 catalog dispatch — only fires for `needs_reupload` (the parent
    // application status change for approve/reject is owned by
    // `ApplicationReviewService.approve/rejectApplication`).
    if (dto.reviewStatus === 'needs_reupload') {
      const detail = [document.documentType, dto.reviewNotes].filter(Boolean).join(': ')
      notify(this.eventEmitter, NotificationType.ProviderDocumentReuploadRequested, {
        providerId: document.providerId,
        verificationDocumentId: documentId,
        extra: detail ? { detail } : undefined,
      })
    }
  }

  /**
   * Get documents pending review with SAS URLs
   */
  async getPendingDocuments(limit = 50): Promise<any[]> {
    const documents = await this.prisma.verificationDocument.findMany({
      where: {
        reviewStatus: 'pending',
      },
      orderBy: { uploadedAt: 'asc' },
      take: limit,
      include: {
        provider: {
          select: {
            id: true,
            legalCompanyName: true,
            email: true,
            approvalStatus: true,
          },
        },
      },
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
   * Get document statistics
   */
  async getDocumentStats(): Promise<{
    total: number
    pending: number
    approved: number
    rejected: number
    needsReupload: number
  }> {
    const [total, pending, approved, rejected, needsReupload] = await Promise.all([
      this.prisma.verificationDocument.count(),
      this.prisma.verificationDocument.count({ where: { reviewStatus: 'pending' } }),
      this.prisma.verificationDocument.count({ where: { reviewStatus: 'approved' } }),
      this.prisma.verificationDocument.count({ where: { reviewStatus: 'rejected' } }),
      this.prisma.verificationDocument.count({ where: { reviewStatus: 'needs_reupload' } }),
    ])

    return {
      total,
      pending,
      approved,
      rejected,
      needsReupload,
    }
  }
}
