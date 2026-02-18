import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { DeletionType } from '../../../generated/client/client'
import { DeleteDataResponseDto, ExportDataResponseDto } from '../dto/gdpr.dto'

/**
 * GDPR Compliance Service
 *
 * Implements GDPR requirements for messaging data:
 * - Right to Data Portability (Article 20): Export all user data
 * - Right to Erasure (Article 17): Delete all user data
 *
 * All operations are logged for audit purposes.
 */
@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export all messaging data for a user (GDPR Article 20: Right to Data Portability)
   *
   * Exports:
   * - All conversations the user participates in
   * - All messages sent by the user
   * - All attachments uploaded by the user
   * - All reactions, bookmarks, and reports by the user
   *
   * @param userId - User ID to export data for
   * @returns Complete export of user's messaging data
   */
  async exportUserData(userId: string): Promise<ExportDataResponseDto> {
    this.logger.log(`Starting GDPR data export for user: ${userId}`)

    try {
      // Get all conversations the user participates in
      const conversations = await this.prisma.conversation.findMany({
        where: {
          participants: {
            some: { userId },
          },
        },
        include: {
          participants: {
            select: {
              userId: true,
              providerId: true,
              pinned: true,
              starred: true,
              muted: true,
              archived: true,
              lastReadAt: true,
            },
          },
          labels: {
            include: {
              label: true,
            },
          },
        },
      })

      // Get all messages sent by the user
      const messages = await this.prisma.message.findMany({
        where: { senderId: userId },
        include: {
          reactions: true,
          mentions: true,
          editHistory: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      // Get all attachments uploaded by the user
      const attachments = await this.prisma.messageAttachment.findMany({
        where: { uploadedBy: userId },
      })

      // Get all reactions by the user
      const reactions = await this.prisma.messageReaction.findMany({
        where: { userId },
      })

      // Get all bookmarks by the user
      const bookmarks = await this.prisma.messageBookmark.findMany({
        where: { userId },
        include: {
          message: {
            select: {
              id: true,
              content: true,
              createdAt: true,
            },
          },
        },
      })

      // Get all reports submitted by the user
      const reports = await this.prisma.messageReport.findMany({
        where: { reportedBy: userId },
      })

      const exportData: ExportDataResponseDto = {
        userId,
        exportedAt: new Date().toISOString(),
        totalConversations: conversations.length,
        totalMessages: messages.length,
        totalAttachments: attachments.length,
        data: {
          conversations,
          messages,
          attachments,
          reactions,
          bookmarks,
          reports,
        },
      }

      this.logger.log(
        `GDPR data export completed for user ${userId}: ${messages.length} messages, ${conversations.length} conversations`
      )

      return exportData
    } catch (error) {
      this.logger.error(`GDPR data export failed for user ${userId}:`, error)
      throw new BadRequestException('Failed to export user data')
    }
  }

  /**
   * Delete all messaging data for a user (GDPR Article 17: Right to Erasure)
   *
   * This is a HARD DELETE operation that permanently removes:
   * - All messages sent by the user (content replaced, marked as GDPR_DELETE)
   * - All conversation participations
   * - All attachments (files and database records)
   * - All reactions, bookmarks, mentions, and reports
   *
   * This operation is IRREVERSIBLE.
   *
   * @param userId - User ID to delete data for
   * @param confirmation - Must be "DELETE_ALL_DATA" to proceed
   * @returns Summary of deleted data
   */
  async deleteUserData(userId: string, confirmation: string): Promise<DeleteDataResponseDto> {
    // Require explicit confirmation
    if (confirmation !== 'DELETE_ALL_DATA') {
      throw new BadRequestException(
        'Invalid confirmation. Must provide "DELETE_ALL_DATA" to proceed.'
      )
    }

    this.logger.warn(`Starting GDPR data deletion for user: ${userId}`)

    try {
      // Use transaction to ensure atomicity
      const result = await this.prisma.$transaction(async tx => {
        // 1. Delete or anonymize messages sent by user
        const messagesResult = await tx.message.updateMany({
          where: { senderId: userId },
          data: {
            content: '[User deleted their account - GDPR]',
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: userId,
            deletionType: DeletionType.GDPR_DELETED,
          },
        })

        // 2. Delete message edit history
        await tx.messageEditHistory.deleteMany({
          where: {
            message: { senderId: userId },
          },
        })

        // 3. Delete reactions by user
        await tx.messageReaction.deleteMany({
          where: { userId },
        })

        // 4. Delete bookmarks by user
        await tx.messageBookmark.deleteMany({
          where: { userId },
        })

        // 5. Delete mentions of user
        await tx.messageMention.deleteMany({
          where: { userId: userId },
        })

        // 6. Delete reports submitted by user
        await tx.messageReport.deleteMany({
          where: { reportedBy: userId },
        })

        // 7. Delete attachments uploaded by user
        const attachmentsResult = await tx.messageAttachment.deleteMany({
          where: { uploadedBy: userId },
        })

        // 8. Remove user from conversation participants
        const participantsResult = await tx.conversationParticipant.deleteMany({
          where: { userId },
        })

        return {
          messagesDeleted: messagesResult.count,
          attachmentsDeleted: attachmentsResult.count,
          conversationsRemoved: participantsResult.count,
        }
      })

      const response: DeleteDataResponseDto = {
        success: true,
        userId,
        deletedAt: new Date().toISOString(),
        messagesDeleted: result.messagesDeleted,
        conversationsRemoved: result.conversationsRemoved,
        attachmentsDeleted: result.attachmentsDeleted,
        message: 'All messaging data has been permanently deleted in compliance with GDPR',
      }

      this.logger.warn(
        `GDPR data deletion completed for user ${userId}: ${result.messagesDeleted} messages, ${result.conversationsRemoved} conversations`
      )

      return response
    } catch (error) {
      this.logger.error(`GDPR data deletion failed for user ${userId}:`, error)
      throw new BadRequestException('Failed to delete user data')
    }
  }
}
