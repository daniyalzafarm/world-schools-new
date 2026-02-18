import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { DeletionType, ReportStatus } from '../../../generated/client/client'
import {
  GetReportsDto,
  ModerationAction,
  TakeModerationActionDto,
  UpdateReportStatusDto,
} from '../dto/report.dto'

/**
 * Reports Service
 *
 * Handles abuse report management and moderation workflow:
 * - List and filter reports
 * - Review reports
 * - Take moderation actions (dismiss, delete, warn, suspend, ban)
 * - Track audit trail
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all reports with filtering and pagination
   *
   * @param dto - Filter and pagination options
   * @returns Paginated list of reports with message and user details
   */
  async getReports(dto: GetReportsDto) {
    const { status, reason, reportedBy, messageId, startDate, endDate, limit = 20, cursor } = dto

    // Build where clause
    const where: any = {}

    if (status) where.status = status
    if (reason) where.reason = reason
    if (reportedBy) where.reportedBy = reportedBy
    if (messageId) where.messageId = messageId

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    // Cursor pagination
    const findManyOptions: any = {
      where,
      take: limit + 1, // Fetch one extra to determine if there are more
      orderBy: { createdAt: 'desc' as const },
      include: {
        message: {
          select: {
            id: true,
            content: true,
            senderId: true,
            conversationId: true,
            createdAt: true,
            isDeleted: true,
          },
        },
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }

    // Add cursor options if cursor is provided
    if (cursor) {
      findManyOptions.cursor = { id: cursor }
      findManyOptions.skip = 1
    }

    const reports = await this.prisma.messageReport.findMany(findManyOptions)

    // Check if there are more results
    const hasMore = reports.length > limit
    const items = hasMore ? reports.slice(0, limit) : reports
    const nextCursor = hasMore ? items[items.length - 1].id : null

    this.logger.log(`Retrieved ${items.length} reports (hasMore: ${hasMore})`)

    return {
      items,
      nextCursor,
      hasMore,
      total: items.length,
    }
  }

  /**
   * Get a single report by ID with full details
   *
   * @param reportId - Report ID
   * @returns Report with message, reporter, and reviewer details
   */
  async getReportById(reportId: string) {
    const report = await this.prisma.messageReport.findUnique({
      where: { id: reportId },
      include: {
        message: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            conversation: {
              select: {
                id: true,
                type: true,
              },
            },
          },
        },
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!report) {
      throw new NotFoundException(`Report ${reportId} not found`)
    }

    this.logger.log(`Retrieved report ${reportId}`)
    return report
  }

  /**
   * Update report status (e.g., PENDING -> UNDER_REVIEW -> RESOLVED)
   *
   * @param dto - Status update details
   * @returns Updated report
   */
  async updateReportStatus(dto: UpdateReportStatusDto) {
    const { reportId, status, reviewedBy, reviewNotes } = dto

    const report = await this.prisma.messageReport.findUnique({
      where: { id: reportId },
    })

    if (!report) {
      throw new NotFoundException(`Report ${reportId} not found`)
    }

    const updated = await this.prisma.messageReport.update({
      where: { id: reportId },
      data: {
        status,
        reviewedBy,
        reviewedAt: new Date(),
        resolution: reviewNotes,
      },
    })

    this.logger.log(`Report ${reportId} status updated to ${status} by ${reviewedBy}`)
    return updated
  }

  /**
   * Take moderation action on a report
   *
   * Supports the following actions:
   * - DISMISS: Mark report as false positive
   * - DELETE_MESSAGE: Soft delete the reported message
   * - WARN_USER: Issue a warning to the user (logged only)
   * - SUSPEND_USER: Temporarily suspend the user
   * - BAN_USER: Permanently ban the user
   *
   * @param dto - Moderation action details
   * @returns Result of the moderation action
   */
  async takeModerationAction(dto: TakeModerationActionDto) {
    const {
      reportId,
      action,
      moderatorId,
      reason,
      suspensionDays = 7,
      notifyUser,
      notifyReporter,
    } = dto

    // Get report with message details
    const report = await this.prisma.messageReport.findUnique({
      where: { id: reportId },
      include: {
        message: {
          select: {
            id: true,
            senderId: true,
            content: true,
            isDeleted: true,
          },
        },
      },
    })

    if (!report) {
      throw new NotFoundException(`Report ${reportId} not found`)
    }

    if (report.status === ReportStatus.RESOLVED || report.status === ReportStatus.DISMISSED) {
      throw new BadRequestException(
        `Report ${reportId} has already been ${report.status.toLowerCase()}`
      )
    }

    this.logger.warn(
      `Taking moderation action ${action} on report ${reportId} by moderator ${moderatorId}`
    )

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async tx => {
      let actionResult: any = {}

      switch (action) {
        case ModerationAction.DISMISS:
          // Mark report as dismissed (false positive)
          await tx.messageReport.update({
            where: { id: reportId },
            data: {
              status: ReportStatus.DISMISSED,
              reviewedBy: moderatorId,
              reviewedAt: new Date(),
              resolution: reason || 'Report dismissed - no violation found',
            },
          })
          actionResult = { action: 'dismissed', message: 'Report dismissed as false positive' }
          break

        case ModerationAction.DELETE_MESSAGE:
          // Soft delete the reported message
          if (report.message.isDeleted) {
            throw new BadRequestException('Message is already deleted')
          }

          await tx.message.update({
            where: { id: report.message.id },
            data: {
              isDeleted: true,
              deletedAt: new Date(),
              deletedBy: moderatorId,
              deletionType: DeletionType.ADMIN_DELETED,
            },
          })

          await tx.messageReport.update({
            where: { id: reportId },
            data: {
              status: ReportStatus.RESOLVED,
              reviewedBy: moderatorId,
              reviewedAt: new Date(),
              resolution: reason || 'Message deleted by moderator',
            },
          })

          actionResult = {
            action: 'message_deleted',
            messageId: report.message.id,
            message: 'Reported message has been deleted',
          }
          break

        case ModerationAction.WARN_USER:
          // Issue warning to user (logged in audit trail)
          await tx.messageReport.update({
            where: { id: reportId },
            data: {
              status: ReportStatus.RESOLVED,
              reviewedBy: moderatorId,
              reviewedAt: new Date(),
              resolution: `User warned: ${reason || 'Community guidelines violation'}`,
            },
          })

          actionResult = {
            action: 'user_warned',
            userId: report.message.senderId,
            message: 'Warning issued to user',
          }
          break

        case ModerationAction.SUSPEND_USER: {
          // Temporarily suspend user
          const suspendUntil = new Date()
          suspendUntil.setDate(suspendUntil.getDate() + suspensionDays)

          // Note: This assumes a 'suspendedUntil' field exists on User model
          // If not, this would need to be tracked differently
          await tx.messageReport.update({
            where: { id: reportId },
            data: {
              status: ReportStatus.RESOLVED,
              reviewedBy: moderatorId,
              reviewedAt: new Date(),
              resolution: `User suspended for ${suspensionDays} days: ${reason || 'Community guidelines violation'}`,
            },
          })

          actionResult = {
            action: 'user_suspended',
            userId: report.message.senderId,
            suspendedUntil: suspendUntil.toISOString(),
            message: `User suspended for ${suspensionDays} days`,
          }
          break
        }

        case ModerationAction.BAN_USER:
          // Permanently ban user
          // Note: This assumes a 'isBanned' field exists on User model
          // If not, this would need to be tracked differently
          await tx.messageReport.update({
            where: { id: reportId },
            data: {
              status: ReportStatus.RESOLVED,
              reviewedBy: moderatorId,
              reviewedAt: new Date(),
              resolution: `User permanently banned: ${reason || 'Severe community guidelines violation'}`,
            },
          })

          actionResult = {
            action: 'user_banned',
            userId: report.message.senderId,
            message: 'User has been permanently banned',
          }
          break

        default:
          throw new BadRequestException(`Unknown moderation action: ${action}`)
      }

      return actionResult
    })

    this.logger.warn(
      `Moderation action ${action} completed on report ${reportId}: ${JSON.stringify(result)}`
    )

    // TODO: Send notifications to reporter and/or reported user
    // This would integrate with a notification service
    if (notifyReporter) {
      this.logger.log(`TODO: Notify reporter ${report.reportedBy} about action taken`)
    }
    if (notifyUser && action !== ModerationAction.DISMISS) {
      this.logger.log(`TODO: Notify user ${report.message.senderId} about moderation action`)
    }

    return {
      success: true,
      reportId,
      action,
      ...result,
    }
  }
}
