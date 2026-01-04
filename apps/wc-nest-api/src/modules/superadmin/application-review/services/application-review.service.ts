import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { ConfigService } from '../../../../config/config.service'
import { TrustScoreService } from '../../../provider/onboarding/services/trust-score.service'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import {
  ApplicationDetailDto,
  ApplicationListItemDto,
  ApproveApplicationDto,
  GetApplicationsQueryDto,
  RejectApplicationDto,
  RequestInfoDto,
} from '../dto/application-review.dto'

@Injectable()
export class ApplicationReviewService {
  private readonly logger = new Logger(ApplicationReviewService.name)
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
   * Get paginated list of provider applications
   */
  async getApplications(query: GetApplicationsQueryDto): Promise<{
    data: ApplicationListItemDto[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const {
      status,
      search,
      minTrustScore,
      maxTrustScore,
      page = 1,
      limit = 20,
      sortBy = 'onboardingCompletedAt',
      sortOrder = 'desc',
    } = query

    // Build where clause
    const where: any = {
      onboardingCompletedAt: { not: null },
    }

    if (status) {
      where.approvalStatus = status
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { legalCompanyName: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (minTrustScore !== undefined || maxTrustScore !== undefined) {
      where.trustScore = {}
      if (minTrustScore !== undefined) {
        where.trustScore.gte = minTrustScore
      }
      if (maxTrustScore !== undefined) {
        where.trustScore.lte = maxTrustScore
      }
    }

    // Get total count
    const total = await this.prisma.provider.count({ where })

    // Get paginated data
    const providers = await this.prisma.provider.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        approvalStatus: true,
        trustScore: true,
        onboardingCompletedAt: true,
        applicationSubmittedAt: true,
        legalCompanyName: true,
        contactFirstName: true,
        contactLastName: true,
        createdAt: true, // Added for sorting support
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    })

    const data: ApplicationListItemDto[] = providers.map(p => ({
      id: p.id,
      businessName: p.name,
      email: p.email || '',
      approvalStatus: p.approvalStatus,
      trustScore: p.trustScore,
      onboardingCompletedAt: p.onboardingCompletedAt?.toISOString() || null,
      submittedAt: p.applicationSubmittedAt?.toISOString() || null,
      legalCompanyName: p.legalCompanyName,
      contactFirstName: p.contactFirstName,
      contactLastName: p.contactLastName,
      createdAt: p.createdAt.toISOString(),
    }))

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get detailed application information
   */
  async getApplicationDetail(providerId: string): Promise<ApplicationDetailDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        owner: {
          select: {
            emailVerified: true,
          },
        },
        googleBusinessProfile: true,
        verificationDocuments: {
          orderBy: { uploadedAt: 'desc' },
        },
        settings: true,
        reviewedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!provider) {
      throw new NotFoundException('Provider application not found')
    }

    // Get trust score breakdown
    const trustScoreBreakdown = await this.trustScoreService.calculateTrustScore(providerId)

    // Generate SAS URLs for documents
    const documentsWithUrls = await Promise.all(
      provider.verificationDocuments.map(async doc => {
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

    return {
      id: provider.id,
      businessName: provider.name,
      email: provider.email || '',
      emailVerified: provider.owner.emailVerified,
      phoneVerified: provider.phoneVerified,
      approvalStatus: provider.approvalStatus,
      trustScore: provider.trustScore,
      onboardingCompletedAt: provider.onboardingCompletedAt?.toISOString() || null,
      submittedAt: provider.applicationSubmittedAt?.toISOString() || null,
      reviewedAt: provider.applicationReviewedAt?.toISOString() || null,
      reviewedBy: provider.reviewedByUser
        ? `${provider.reviewedByUser.firstName} ${provider.reviewedByUser.lastName}`
        : null,
      rejectionReason: provider.rejectionReason,
      rejectionCategory: provider.rejectionCategory,
      createdAt: provider.createdAt.toISOString(),
      onboardingStartedAt: provider.onboardingStartedAt?.toISOString() || null,
      approvalDecisionAt: provider.approvalDecisionAt?.toISOString() || null,
      contactFirstName: provider.contactFirstName,
      contactLastName: provider.contactLastName,
      contactRole: provider.contactRole,
      contactPhone: provider.contactPhone,
      contactPhoneCountryCode: provider.contactPhoneCountryCode,
      legalCompanyName: provider.legalCompanyName,
      legalStreetAddress: provider.legalStreetAddress,
      legalAptSuite: provider.legalAptSuite,
      legalCity: provider.legalCity,
      legalStateProvince: provider.legalStateProvince,
      legalPostalCode: provider.legalPostalCode,
      legalCountry: provider.legalCountry,
      yearFounded: provider.yearFounded,
      googleBusinessProfile: provider.googleBusinessProfile,
      verificationDocuments: documentsWithUrls,
      settings: provider.settings,
      trustScoreBreakdown,
    }
  }

  /**
   * Approve a provider application
   */
  async approveApplication(
    providerId: string,
    reviewerId: string,
    _dto: ApproveApplicationDto
  ): Promise<void> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    })

    if (!provider) {
      throw new NotFoundException('Provider application not found')
    }

    if (provider.approvalStatus === 'approved') {
      throw new BadRequestException('Application is already approved')
    }

    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        approvalStatus: 'approved',
        applicationReviewedAt: new Date(),
        applicationReviewedBy: reviewerId,
        rejectionReason: null,
        rejectionCategory: null,
      },
    })

    this.logger.log(`Approved provider application ${providerId} by reviewer ${reviewerId}`)
  }

  /**
   * Reject a provider application
   */
  async rejectApplication(
    providerId: string,
    reviewerId: string,
    dto: RejectApplicationDto
  ): Promise<void> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    })

    if (!provider) {
      throw new NotFoundException('Provider application not found')
    }

    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        approvalStatus: 'rejected',
        applicationReviewedAt: new Date(),
        applicationReviewedBy: reviewerId,
        rejectionReason: dto.reason,
        rejectionCategory: dto.category,
      },
    })

    this.logger.log(`Rejected provider application ${providerId} by reviewer ${reviewerId}`)
  }

  /**
   * Request additional information from provider
   */
  async requestInfo(providerId: string, reviewerId: string, _dto: RequestInfoDto): Promise<void> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    })

    if (!provider) {
      throw new NotFoundException('Provider application not found')
    }

    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        approvalStatus: 'info_requested',
        applicationReviewedAt: new Date(),
        applicationReviewedBy: reviewerId,
      },
    })

    // TODO: Send email notification to provider with the info request message

    this.logger.log(`Requested info from provider ${providerId} by reviewer ${reviewerId}`)
  }

  /**
   * Suspend a provider
   */
  async suspendProvider(providerId: string, reviewerId: string, reason: string): Promise<void> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found')
    }

    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        approvalStatus: 'suspended',
        applicationReviewedAt: new Date(),
        applicationReviewedBy: reviewerId,
        rejectionReason: reason,
      },
    })

    this.logger.log(`Suspended provider ${providerId} by reviewer ${reviewerId}`)
  }
}
