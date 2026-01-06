import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

// Services
import { ApplicationReviewService } from './services/application-review.service'
import { DocumentReviewService } from './services/document-review.service'

// DTOs
import {
  ApproveApplicationDto,
  GetApplicationsQueryDto,
  RejectApplicationDto,
  RequestInfoDto,
  ReviewDocumentDto,
} from './dto/application-review.dto'

@ApiTags('Superadmin - Application Review')
@ApiBearerAuth()
@Controller('superadmin/applications')
@UseGuards(JwtAuthGuard, RolesOrPermissionsGuard)
export class ApplicationReviewController {
  constructor(
    private readonly applicationReviewService: ApplicationReviewService,
    private readonly documentReviewService: DocumentReviewService
  ) {}

  /**
   * Get list of provider applications
   */
  @Get()
  @Permissions('provider_applications.read')
  @ApiOperation({ summary: 'Get list of provider applications' })
  async getApplications(@Query() query: GetApplicationsQueryDto) {
    const result = await this.applicationReviewService.getApplications(query)
    return ResponseUtil.success(result)
  }

  /**
   * Get application detail
   */
  @Get(':providerId')
  @Permissions('provider_applications.read')
  @ApiOperation({ summary: 'Get detailed application information' })
  async getApplicationDetail(@Param('providerId') providerId: string) {
    const application = await this.applicationReviewService.getApplicationDetail(providerId)
    return ResponseUtil.success(application)
  }

  /**
   * Approve application
   */
  @Post(':providerId/approve')
  @Permissions('provider_applications.approve')
  @ApiOperation({ summary: 'Approve a provider application' })
  async approveApplication(
    @Param('providerId') providerId: string,
    @Request() req: any,
    @Body() dto: ApproveApplicationDto
  ) {
    const reviewerId = req.user.id
    await this.applicationReviewService.approveApplication(providerId, reviewerId, dto)
    return ResponseUtil.success({ message: 'Application approved successfully' })
  }

  /**
   * Reject application
   */
  @Post(':providerId/reject')
  @Permissions('provider_applications.reject')
  @ApiOperation({ summary: 'Reject a provider application' })
  async rejectApplication(
    @Param('providerId') providerId: string,
    @Request() req: any,
    @Body() dto: RejectApplicationDto
  ) {
    const reviewerId = req.user.id
    await this.applicationReviewService.rejectApplication(providerId, reviewerId, dto)
    return ResponseUtil.success({ message: 'Application rejected successfully' })
  }

  /**
   * Request additional information
   */
  @Post(':providerId/request-info')
  @Permissions('provider_applications.request_info')
  @ApiOperation({ summary: 'Request additional information from provider' })
  async requestInfo(
    @Param('providerId') providerId: string,
    @Request() req: any,
    @Body() dto: RequestInfoDto
  ) {
    const reviewerId = req.user.id
    await this.applicationReviewService.requestInfo(providerId, reviewerId, dto)
    return ResponseUtil.success({ message: 'Information request sent successfully' })
  }

  /**
   * Get provider documents
   */
  @Get(':providerId/documents')
  @Permissions('provider_documents.read')
  @ApiOperation({ summary: 'Get all documents for a provider' })
  async getProviderDocuments(@Param('providerId') providerId: string) {
    const documents = await this.documentReviewService.getProviderDocuments(providerId)
    return ResponseUtil.success(documents)
  }

  /**
   * Review a document
   */
  @Post('documents/:documentId/review')
  @Permissions('provider_documents.review')
  @ApiOperation({ summary: 'Review a verification document' })
  async reviewDocument(
    @Param('documentId') documentId: string,
    @Request() req: any,
    @Body() dto: ReviewDocumentDto
  ) {
    const reviewerId = req.user.id
    await this.documentReviewService.reviewDocument(documentId, reviewerId, dto)
    return ResponseUtil.success({ message: 'Document reviewed successfully' })
  }

  /**
   * Get pending documents
   */
  @Get('documents/pending/list')
  @Permissions('provider_documents.read')
  @ApiOperation({ summary: 'Get documents pending review' })
  async getPendingDocuments(@Query('limit') limit?: number) {
    const documents = await this.documentReviewService.getPendingDocuments(limit)
    return ResponseUtil.success(documents)
  }
}
