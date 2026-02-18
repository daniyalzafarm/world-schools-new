import { Body, Controller, Get, Logger, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ReportsService } from '../services/reports.service'
import { GetReportsDto, TakeModerationActionDto, UpdateReportStatusDto } from '../dto/report.dto'

/**
 * Reports Controller
 *
 * Admin-only endpoints for managing abuse reports and taking moderation actions.
 * All endpoints require authentication and admin role.
 */
@ApiTags('Messaging - Reports (Admin)')
@ApiBearerAuth()
@Controller('messaging/admin/reports')
@UseGuards(JwtAuthGuard, RolesOrPermissionsGuard)
@Roles('admin', 'superadmin')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name)

  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Get all abuse reports with filtering and pagination
   *
   * Admin endpoint to list all reports with various filters:
   * - Filter by status (PENDING, UNDER_REVIEW, RESOLVED, DISMISSED)
   * - Filter by reason (SPAM, HARASSMENT, etc.)
   * - Filter by reporter or message
   * - Filter by date range
   */
  @Get()
  @ApiOperation({
    summary: 'List all abuse reports',
    description: 'Get paginated list of abuse reports with filtering options. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reports retrieved successfully',
    schema: {
      example: {
        items: [
          {
            id: 'report-123',
            messageId: 'msg-456',
            reportedBy: 'user-789',
            reason: 'SPAM',
            description: 'This message contains spam links',
            status: 'PENDING',
            reviewedBy: null,
            reviewedAt: null,
            resolution: null,
            createdAt: '2026-02-10T12:00:00Z',
            message: {
              id: 'msg-456',
              content: 'Buy now at...',
              senderId: 'user-999',
              conversationId: 'conv-111',
              createdAt: '2026-02-10T11:00:00Z',
              isDeleted: false,
            },
            reporter: {
              id: 'user-789',
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
            },
            reviewer: null,
          },
        ],
        nextCursor: 'report-124',
        hasMore: true,
        total: 20,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getReports(@Query() query: GetReportsDto) {
    this.logger.log(`Admin retrieving reports with filters: ${JSON.stringify(query)}`)
    return this.reportsService.getReports(query)
  }

  /**
   * Get a specific report by ID with full details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get report details',
    description: 'Get detailed information about a specific abuse report. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Report details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getReportById(@Param('id') reportId: string) {
    this.logger.log(`Admin retrieving report ${reportId}`)
    return this.reportsService.getReportById(reportId)
  }

  /**
   * Update report status (e.g., PENDING -> UNDER_REVIEW)
   */
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update report status',
    description: 'Update the status of an abuse report (e.g., mark as under review). Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Report status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async updateReportStatus(
    @Param('id') reportId: string,
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser('id') adminId: string
  ) {
    this.logger.log(`Admin ${adminId} updating report ${reportId} status to ${dto.status}`)

    // Override IDs
    dto.reportId = reportId
    dto.reviewedBy = adminId

    return this.reportsService.updateReportStatus(dto)
  }

  /**
   * Take moderation action on a report
   *
   * Available actions:
   * - DISMISS: Mark as false positive
   * - DELETE_MESSAGE: Soft delete the reported message
   * - WARN_USER: Issue warning to user
   * - SUSPEND_USER: Temporarily suspend user
   * - BAN_USER: Permanently ban user
   */
  @Post(':id/moderate')
  @ApiOperation({
    summary: 'Take moderation action',
    description:
      'Take a moderation action on a report (dismiss, delete message, warn/suspend/ban user). Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Moderation action completed successfully',
    schema: {
      example: {
        success: true,
        reportId: 'report-123',
        action: 'DELETE_MESSAGE',
        messageId: 'msg-456',
        message: 'Reported message has been deleted',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid action or report already resolved',
  })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async takeModerationAction(
    @Param('id') reportId: string,
    @Body() dto: TakeModerationActionDto,
    @CurrentUser('id') adminId: string
  ) {
    this.logger.warn(
      `Admin ${adminId} taking moderation action ${dto.action} on report ${reportId}`
    )

    // Override IDs
    dto.reportId = reportId
    dto.moderatorId = adminId

    return this.reportsService.takeModerationAction(dto)
  }
}
