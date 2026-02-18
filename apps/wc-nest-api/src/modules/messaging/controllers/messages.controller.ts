import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { MessageAccessGuard } from '../guards/message-access.guard'
import { RateLimitGuard } from '../guards/rate-limit.guard'
import { MessagesService } from '../services/messages.service'
import {
  AddReactionDto,
  BookmarkMessageDto,
  DeleteMessageDto,
  EditMessageDto,
  ForwardMessageDto,
  GetMessagesDto,
  MarkAsDeliveredDto,
  MarkAsReadDto,
  PinMessageDto,
  RemoveReactionDto,
  ReportMessageDto,
  ScheduleMessageDto,
  SendMessageDto,
  UnbookmarkMessageDto,
  UnpinMessageDto,
} from '../dto/message.dto'
import { MessageResponseDto, PaginatedMessagesResponseDto } from '../dto/response.dto'

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messaging/messages')
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name)

  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Send a new message
   */
  @Post()
  @UseGuards(RateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a new message',
    description:
      'Sends a new message in a conversation with idempotency support. Rate limited to 60 messages per minute.',
  })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too Many Requests - Rate limit exceeded' })
  async sendMessage(@Body() sendDto: SendMessageDto, @CurrentUser('id') currentUserId: string) {
    this.logger.log(`Sending message in conversation ${sendDto.conversationId}`)

    // Override sender ID with current user
    sendDto.senderId = currentUserId

    const message = await this.messagesService.sendMessage(sendDto)

    return {
      success: true,
      message: 'Message sent successfully',
      data: message,
    }
  }

  /**
   * Get messages in a conversation
   */
  @Get()
  @ApiOperation({
    summary: 'Get messages in a conversation',
    description: 'Retrieves messages with cursor-based pagination',
  })
  @ApiQuery({ name: 'conversationId', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'direction', required: false, enum: ['before', 'after'] })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    type: PaginatedMessagesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMessages(@Query() query: GetMessagesDto) {
    this.logger.log(`Getting messages for conversation ${query.conversationId}`)

    const messages = await this.messagesService.getMessages(query)

    return {
      success: true,
      message: 'Messages retrieved successfully',
      data: messages,
    }
  }

  /**
   * PHASE 6: Get messages where current user was mentioned
   */
  @Get('mentions')
  @ApiOperation({
    summary: 'Get mentioned messages',
    description: 'Retrieves messages where the current user was mentioned',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Mentioned messages retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMentionedMessages(
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Getting mentioned messages for user ${currentUserId}`)

    const messages = await this.messagesService.getMentionedMessages(currentUserId, limit, cursor)

    return {
      success: true,
      message: 'Mentioned messages retrieved successfully',
      data: messages,
    }
  }

  /**
   * Get a single message by ID
   */
  @Get(':id')
  @UseGuards(MessageAccessGuard)
  @ApiOperation({
    summary: 'Get message by ID',
    description:
      'Retrieves a single message with all details. User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Message retrieved successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in conversation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMessageById(@Param('id') messageId: string) {
    this.logger.log(`Getting message ${messageId}`)

    const message = await this.messagesService.getMessageById(messageId)

    return {
      success: true,
      message: 'Message retrieved successfully',
      data: message,
    }
  }

  /**
   * PHASE 6: Get message thread/reply chain
   */
  @Get(':id/thread')
  @UseGuards(MessageAccessGuard)
  @ApiOperation({
    summary: 'Get message thread',
    description:
      'Retrieves the full thread/reply chain for a message. User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Thread retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in conversation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMessageThread(@Param('id') messageId: string) {
    this.logger.log(`Getting thread for message ${messageId}`)

    const thread = await this.messagesService.getMessageThread(messageId)

    return {
      success: true,
      message: 'Thread retrieved successfully',
      data: thread,
    }
  }

  /**
   * PHASE 6.7: Get edit history for a message
   */
  @Get(':id/edit-history')
  @UseGuards(MessageAccessGuard)
  @ApiOperation({
    summary: 'Get message edit history',
    description:
      'Retrieves all edit history records for a message with pagination. User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Edit history retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in conversation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMessageEditHistory(
    @Param('id') messageId: string,
    @Query('limit') limit: number,
    @Query('cursor') cursor: string
  ) {
    this.logger.log(`Getting edit history for message ${messageId}`)

    const editHistory = await this.messagesService.getMessageEditHistory(messageId, limit, cursor)

    return {
      success: true,
      message: 'Edit history retrieved successfully',
      data: editHistory,
    }
  }

  /**
   * Edit a message
   */
  @Patch(':id')
  @UseGuards(MessageAccessGuard)
  @ApiOperation({
    summary: 'Edit a message',
    description:
      'Edits the content of an existing message (only by sender). User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Message edited successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to edit this message or not a participant in conversation',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async editMessage(
    @Param('id') messageId: string,
    @Body() editDto: EditMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Editing message ${messageId}`)

    // Override IDs
    editDto.messageId = messageId
    editDto.userId = currentUserId

    const message = await this.messagesService.editMessage(editDto)

    return {
      success: true,
      message: 'Message edited successfully',
      data: message,
    }
  }

  /**
   * Delete a message
   */
  @Delete(':id')
  @UseGuards(MessageAccessGuard)
  @ApiOperation({
    summary: 'Delete a message',
    description:
      'Deletes a message (soft delete or hard delete). User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Message deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to delete this message or not a participant in conversation',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteMessage(
    @Param('id') messageId: string,
    @Body() deleteDto: DeleteMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Deleting message ${messageId}`)

    // Override IDs
    deleteDto.messageId = messageId
    deleteDto.userId = currentUserId

    await this.messagesService.deleteMessage(deleteDto)

    return {
      success: true,
      message: 'Message deleted successfully',
    }
  }

  /**
   * Mark message as read
   */
  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark message as read',
    description: 'Marks a message as read for the current user',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Message marked as read',
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsRead(@Param('id') messageId: string, @CurrentUser('id') currentUserId: string) {
    this.logger.log(`Marking message ${messageId} as read`)

    const readDto: MarkAsReadDto = {
      messageId,
      userId: currentUserId,
    }

    await this.messagesService.markAsRead(readDto)

    return {
      success: true,
      message: 'Message marked as read',
    }
  }

  /**
   * Mark message as delivered
   */
  @Post(':id/delivered')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark message as delivered',
    description: 'Marks a message as delivered to the current user',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Message marked as delivered',
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsDelivered(@Param('id') messageId: string, @CurrentUser('id') currentUserId: string) {
    this.logger.log(`Marking message ${messageId} as delivered`)

    const deliveredDto: MarkAsDeliveredDto = {
      messageId,
      userId: currentUserId,
    }

    await this.messagesService.markAsDelivered(deliveredDto)

    return {
      success: true,
      message: 'Message marked as delivered',
    }
  }

  /**
   * Add reaction to a message
   */
  @Post(':id/reactions')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add reaction to message',
    description:
      'Adds an emoji reaction to a message. User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Reaction added successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in conversation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addReaction(
    @Param('id') messageId: string,
    @Body() reactionDto: AddReactionDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Adding reaction to message ${messageId}`)

    // Override IDs
    reactionDto.messageId = messageId
    reactionDto.userId = currentUserId

    const message = await this.messagesService.addReaction(reactionDto)

    return {
      success: true,
      message: 'Reaction added successfully',
      data: message,
    }
  }

  /**
   * Remove reaction from a message
   */
  @Delete(':id/reactions')
  @UseGuards(MessageAccessGuard)
  @ApiOperation({
    summary: 'Remove reaction from message',
    description:
      'Removes an emoji reaction from a message. User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Reaction removed successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message or reaction not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in conversation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeReaction(
    @Param('id') messageId: string,
    @Body() reactionDto: RemoveReactionDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Removing reaction from message ${messageId}`)

    // Override IDs
    reactionDto.messageId = messageId
    reactionDto.userId = currentUserId

    const message = await this.messagesService.removeReaction(reactionDto)

    return {
      success: true,
      message: 'Reaction removed successfully',
      data: message,
    }
  }

  /**
   * Bookmark a message
   */
  @Post(':id/bookmark')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bookmark a message',
    description:
      'Adds a message to user bookmarks for easy access. User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Message bookmarked successfully',
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in conversation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async bookmarkMessage(@Param('id') messageId: string, @CurrentUser('id') currentUserId: string) {
    this.logger.log(`Bookmarking message ${messageId}`)

    const bookmarkDto: BookmarkMessageDto = {
      messageId,
      userId: currentUserId,
    }

    await this.messagesService.bookmarkMessage(bookmarkDto)

    return {
      success: true,
      message: 'Message bookmarked successfully',
    }
  }

  /**
   * Remove bookmark from a message
   */
  @Delete(':id/bookmark')
  @UseGuards(MessageAccessGuard)
  @ApiOperation({
    summary: 'Remove bookmark from message',
    description:
      'Removes a message from user bookmarks. User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Bookmark removed successfully',
  })
  @ApiResponse({ status: 404, description: 'Message or bookmark not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in conversation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unbookmarkMessage(
    @Param('id') messageId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Removing bookmark from message ${messageId}`)

    const unbookmarkDto: UnbookmarkMessageDto = {
      messageId,
      userId: currentUserId,
    }

    await this.messagesService.unbookmarkMessage(unbookmarkDto)

    return {
      success: true,
      message: 'Bookmark removed successfully',
    }
  }

  /**
   * PHASE 6: Get all bookmarked messages for current user
   */
  @Get('bookmarks')
  @ApiOperation({
    summary: 'Get bookmarked messages',
    description: 'Retrieves all messages bookmarked by the current user',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Bookmarked messages retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBookmarkedMessages(
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Getting bookmarked messages for user ${currentUserId}`)

    const bookmarks = await this.messagesService.getBookmarkedMessages(currentUserId, limit, cursor)

    return {
      success: true,
      message: 'Bookmarked messages retrieved successfully',
      data: bookmarks,
    }
  }

  /**
   * Pin a message in a conversation
   */
  @Post(':id/pin')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pin a message',
    description:
      'Pins a message to the top of the conversation. User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Message pinned successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in conversation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async pinMessage(
    @Param('id') messageId: string,
    @Body() pinDto: PinMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Pinning message ${messageId}`)

    // Override IDs
    pinDto.messageId = messageId
    pinDto.userId = currentUserId

    const message = await this.messagesService.pinMessage(pinDto)

    return {
      success: true,
      message: 'Message pinned successfully',
      data: message,
    }
  }

  /**
   * Unpin a message from a conversation
   */
  @Delete(':id/pin')
  @UseGuards(MessageAccessGuard)
  @ApiOperation({
    summary: 'Unpin a message',
    description: 'Removes the pin from a message. User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Message unpinned successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in conversation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unpinMessage(@Param('id') messageId: string, @CurrentUser('id') currentUserId: string) {
    this.logger.log(`Unpinning message ${messageId}`)

    const unpinDto: UnpinMessageDto = {
      messageId,
      userId: currentUserId,
    }

    const message = await this.messagesService.unpinMessage(unpinDto)

    return {
      success: true,
      message: 'Message unpinned successfully',
      data: message,
    }
  }

  /**
   * Forward a message to another conversation
   */
  @Post(':id/forward')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Forward a message',
    description:
      'Forwards a message to another conversation. User must be a participant in the source conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Message forwarded successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in conversation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async forwardMessage(
    @Param('id') messageId: string,
    @Body() forwardDto: ForwardMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(
      `Forwarding message ${messageId} to conversation ${forwardDto.toConversationId}`
    )

    // Override IDs
    forwardDto.messageId = messageId
    forwardDto.forwardedBy = currentUserId

    const message = await this.messagesService.forwardMessage(forwardDto)

    return {
      success: true,
      message: 'Message forwarded successfully',
      data: message,
    }
  }

  /**
   * PHASE 6.9: Schedule a message for later
   */
  @Post('schedule')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Schedule a message',
    description: 'Schedules a message to be sent at a specific time in the future',
  })
  @ApiResponse({
    status: 201,
    description: 'Message scheduled successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid scheduled time' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async scheduleMessage(
    @Body() scheduleDto: ScheduleMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Scheduling message for ${scheduleDto.scheduledFor}`)

    // Override IDs
    scheduleDto.senderId = currentUserId
    scheduleDto.scheduledBy = currentUserId

    const scheduledMessage = await this.messagesService.scheduleMessage(scheduleDto)

    return {
      success: true,
      message: 'Message scheduled successfully',
      data: scheduledMessage,
    }
  }

  /**
   * PHASE 6.9: Get scheduled messages for current user
   */
  @Get('scheduled')
  @ApiOperation({
    summary: 'Get scheduled messages',
    description: 'Retrieves all pending scheduled messages for the current user',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Scheduled messages retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getScheduledMessages(
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Getting scheduled messages for user ${currentUserId}`)

    const scheduledMessages = await this.messagesService.getScheduledMessages(
      currentUserId,
      limit,
      cursor
    )

    return {
      success: true,
      message: 'Scheduled messages retrieved successfully',
      data: scheduledMessages,
    }
  }

  /**
   * PHASE 6.9: Cancel a scheduled message
   */
  @Delete('scheduled/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel scheduled message',
    description: 'Cancels a scheduled message before it is sent',
  })
  @ApiParam({ name: 'id', description: 'Scheduled message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Scheduled message cancelled successfully',
  })
  @ApiResponse({ status: 404, description: 'Scheduled message not found' })
  @ApiResponse({ status: 400, description: 'Cannot cancel message' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async cancelScheduledMessage(
    @Param('id') messageId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Cancelling scheduled message ${messageId}`)

    const result = await this.messagesService.cancelScheduledMessage(messageId, currentUserId)

    return {
      success: true,
      message: result.message,
    }
  }

  /**
   * Report a message
   */
  @Post(':id/report')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Report a message',
    description:
      'Reports a message for inappropriate content or behavior. User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Message reported successfully',
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in conversation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async reportMessage(
    @Param('id') messageId: string,
    @Body() reportDto: ReportMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Reporting message ${messageId} for ${reportDto.reason}`)

    // Override IDs
    reportDto.messageId = messageId
    reportDto.reportedBy = currentUserId

    await this.messagesService.reportMessage(reportDto)

    return {
      success: true,
      message: 'Message reported successfully',
    }
  }
}
