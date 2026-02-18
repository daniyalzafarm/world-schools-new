import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'

/**
 * Message Access Guard
 *
 * Verifies that the authenticated user has permission to access a specific message.
 * A user can access a message if they are a participant in the message's conversation.
 *
 * This guard expects:
 * - A message ID in the request params (as 'id' or 'messageId')
 * - An authenticated user in request.user
 *
 * @throws {NotFoundException} If the message doesn't exist
 * @throws {ForbiddenException} If the user is not a participant in the message's conversation
 *
 * @example
 * ```typescript
 * @UseGuards(MessageAccessGuard)
 * @Get(':id')
 * async getMessage(@Param('id') id: string) {
 *   // User is guaranteed to have access to this message
 * }
 * ```
 */
@Injectable()
export class MessageAccessGuard implements CanActivate {
  private readonly logger = new Logger(MessageAccessGuard.name)

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user?.id) {
      // If no user is authenticated, let the JWT guard handle it
      return true
    }

    // Extract message ID from params
    const messageId = request.params.id || request.params.messageId

    if (!messageId) {
      // No message ID in params, skip this guard
      return true
    }

    const userId = user.id

    try {
      // Get message with conversation info
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          conversationId: true,
        },
      })

      if (!message) {
        this.logger.warn(`Message ${messageId} not found`)
        throw new NotFoundException(`Message not found`)
      }

      // Check if user is a participant in the message's conversation
      const participant = await this.prisma.conversationParticipant.findFirst({
        where: {
          conversationId: message.conversationId,
          userId,
        },
        select: { id: true },
      })

      if (!participant) {
        this.logger.warn(
          `User ${userId} attempted to access message ${messageId} without permission`
        )
        throw new ForbiddenException('You do not have permission to access this message')
      }

      // User is a participant in the conversation, allow access
      this.logger.debug(`User ${userId} granted access to message ${messageId}`)
      return true
    } catch (error) {
      // Re-throw our custom exceptions
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error
      }

      // Log unexpected errors and deny access
      this.logger.error(
        `Error checking message access for user ${userId}, message ${messageId}:`,
        error
      )
      throw new ForbiddenException('Unable to verify message access')
    }
  }
}
