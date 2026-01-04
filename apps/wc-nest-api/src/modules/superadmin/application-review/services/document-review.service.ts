import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { ConfigService } from '../../../../config/config.service'
import { TrustScoreService } from '../../../provider/onboarding/services/trust-score.service'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import { ReviewDocumentDto } from '../dto/application-review.dto'

@Injectable()
export class DocumentReviewService {
  private readonly logger = new Logger(DocumentReviewService.name)
  private readonly azureStorage: AzureStorageService

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly trustScoreService: TrustScoreService
  ) {
    // Initialize Azure Storage Service
    this.azureStorage = new AzureStorageService(this.configService.azureStorageConfig)
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

    // Generate SAS URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async doc => {
        try {
          // Generate SAS URL for secure access (24 hours expiry)
          const sasUrl = await this.azureStorage.generateSasUrl(doc.fileUrl, 24)
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
            name: true,
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

    // Generate SAS URL for secure access
    try {
      const sasUrl = await this.azureStorage.generateSasUrl(document.fileUrl, 24)
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
    if (dto.status === 'rejected' && !dto.rejectionReason) {
      throw new BadRequestException('Rejection reason is required when rejecting a document')
    }

    await this.prisma.verificationDocument.update({
      where: { id: documentId },
      data: {
        reviewStatus: dto.status as 'approved' | 'rejected' | 'needs_reupload',
        reviewNotes: dto.notes,
        rejectionReason: dto.rejectionReason,
        reviewedAt: new Date(),
        reviewedByAdminId: reviewerId,
      },
    })

    // Update trust score after document review
    await this.trustScoreService.updateTrustScore(document.providerId)

    this.logger.log(
      `Reviewed document ${documentId} with status ${dto.status} by reviewer ${reviewerId}`
    )
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
            name: true,
            email: true,
            approvalStatus: true,
          },
        },
      },
    })

    // Generate SAS URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async doc => {
        try {
          // Generate SAS URL for secure access (24 hours expiry)
          const sasUrl = await this.azureStorage.generateSasUrl(doc.fileUrl, 24)
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
