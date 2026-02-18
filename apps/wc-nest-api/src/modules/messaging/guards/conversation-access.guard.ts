import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { ConversationType } from '../../../generated/client/client'
import { ConversationsService } from '../services/conversations.service'

/**
 * Conversation Access Guard
 *
 * Verifies that the authenticated user has permission to access a specific conversation.
 * A user can access a conversation if:
 * 1. They are a direct participant in it, OR
 * 2. They belong to the provider organization referenced in the conversation's
 *    metadata.providerId (for USER_PROVIDER conversations where the provider user
 *    has not yet been added as a participant).
 *
 * This guard expects:
 * - A conversation ID in the request params (as 'id' or 'conversationId')
 * - An authenticated user in request.user
 *
 * @throws {NotFoundException} If the conversation doesn't exist
 * @throws {ForbiddenException} If the user is not a participant
 *
 * @example
 * ```typescript
 * @UseGuards(ConversationAccessGuard)
 * @Get(':id')
 * async getConversation(@Param('id') id: string) {
 *   // User is guaranteed to be a participant or provider org member
 * }
 * ```
 */
@Injectable()
export class ConversationAccessGuard implements CanActivate {
  private readonly logger = new Logger(ConversationAccessGuard.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationsService: ConversationsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user?.id) {
      // If no user is authenticated, let the JWT guard handle it
      return true
    }

    // Extract conversation ID from params
    const conversationId = request.params.id || request.params.conversationId

    if (!conversationId) {
      // No conversation ID in params, skip this guard
      return true
    }

    const userId = user.id

    try {
      // Check if conversation exists and fetch type + metadata for provider-level access check
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, type: true, metadata: true },
      })

      if (!conversation) {
        this.logger.warn(`Conversation ${conversationId} not found`)
        throw new NotFoundException(`Conversation not found`)
      }

      // Check if user is a participant in this conversation
      const participant = await this.prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId,
        },
        select: { id: true },
      })

      if (participant) {
        // User is a direct participant, allow access
        this.logger.debug(`User ${userId} granted access to conversation ${conversationId}`)
        return true
      }

      // User is NOT a direct participant — check provider-level access
      // For USER_PROVIDER conversations, provider users see conversations
      // through their organization (metadata.providerId) before being added
      // as individual participants.
      if (conversation.type === ConversationType.USER_PROVIDER) {
        const metadata = conversation.metadata as { providerId?: string } | null

        if (metadata?.providerId) {
          const userProviderId = await this.conversationsService.getProviderIdForUser(userId)

          if (userProviderId && userProviderId === metadata.providerId) {
            this.logger.debug(
              `User ${userId} granted provider-level access to conversation ${conversationId} (provider: ${userProviderId})`
            )
            return true
          }
        }
      }

      // No access
      this.logger.warn(
        `User ${userId} attempted to access conversation ${conversationId} without permission`
      )
      throw new ForbiddenException('You do not have permission to access this conversation')
    } catch (error) {
      // Re-throw our custom exceptions
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error
      }

      // Log unexpected errors and deny access
      this.logger.error(
        `Error checking conversation access for user ${userId}, conversation ${conversationId}:`,
        error
      )
      throw new ForbiddenException('Unable to verify conversation access')
    }
  }
}
