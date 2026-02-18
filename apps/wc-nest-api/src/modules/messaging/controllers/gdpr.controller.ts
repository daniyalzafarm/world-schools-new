import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { GdprService } from '../services/gdpr.service'
import { DeleteDataResponseDto, DeleteUserDataDto, ExportDataResponseDto } from '../dto/gdpr.dto'

/**
 * GDPR Controller
 *
 * Handles GDPR compliance endpoints for messaging data:
 * - Data export (Right to Data Portability)
 * - Data deletion (Right to Erasure)
 *
 * All endpoints require authentication and operate on the authenticated user's data.
 */
@ApiTags('GDPR & Privacy')
@ApiBearerAuth()
@Controller('messaging/gdpr')
export class GdprController {
  private readonly logger = new Logger(GdprController.name)

  constructor(private readonly gdprService: GdprService) {}

  /**
   * Export all messaging data for the authenticated user
   *
   * GDPR Article 20: Right to Data Portability
   *
   * Returns a complete export of:
   * - All conversations
   * - All messages sent
   * - All attachments uploaded
   * - All reactions, bookmarks, and reports
   */
  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Export all messaging data (GDPR)',
    description:
      'Exports all messaging data for the authenticated user in JSON format. ' +
      'Implements GDPR Article 20: Right to Data Portability. ' +
      'Includes conversations, messages, attachments, reactions, bookmarks, and reports.',
  })
  @ApiResponse({
    status: 200,
    description: 'Data exported successfully',
    type: ExportDataResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Export failed',
  })
  async exportUserData(@CurrentUser('id') userId: string): Promise<ExportDataResponseDto> {
    this.logger.log(`GDPR data export requested by user: ${userId}`)
    return this.gdprService.exportUserData(userId)
  }

  /**
   * Delete all messaging data for the authenticated user
   *
   * GDPR Article 17: Right to Erasure (Right to be Forgotten)
   *
   * ⚠️ WARNING: This operation is IRREVERSIBLE
   *
   * Permanently deletes:
   * - All messages (content replaced with deletion notice)
   * - All conversation participations
   * - All attachments
   * - All reactions, bookmarks, mentions, and reports
   */
  @Delete('delete-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete all messaging data (GDPR)',
    description:
      '⚠️ IRREVERSIBLE OPERATION ⚠️\n\n' +
      'Permanently deletes all messaging data for the authenticated user. ' +
      'Implements GDPR Article 17: Right to Erasure (Right to be Forgotten).\n\n' +
      'Requires confirmation string "DELETE_ALL_DATA" in request body.\n\n' +
      'This will:\n' +
      '- Replace message content with deletion notice\n' +
      '- Remove user from all conversations\n' +
      '- Delete all attachments\n' +
      '- Delete all reactions, bookmarks, and reports\n\n' +
      'This operation cannot be undone.',
  })
  @ApiBody({
    type: DeleteUserDataDto,
    description: 'Deletion request with confirmation',
    examples: {
      example1: {
        summary: 'Delete all data',
        value: {
          userId: 'user-123',
          confirmation: 'DELETE_ALL_DATA',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Data deleted successfully',
    type: DeleteDataResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid confirmation or deletion failed',
  })
  async deleteUserData(
    @CurrentUser('id') userId: string,
    @Body() dto: DeleteUserDataDto
  ): Promise<DeleteDataResponseDto> {
    this.logger.warn(`GDPR data deletion requested by user: ${userId}`)

    // Ensure user can only delete their own data
    if (dto.userId !== userId) {
      this.logger.error(`User ${userId} attempted to delete data for different user ${dto.userId}`)
      throw new Error('You can only delete your own data')
    }

    return this.gdprService.deleteUserData(userId, dto.confirmation)
  }
}
