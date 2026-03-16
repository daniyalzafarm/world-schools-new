import {
  Body,
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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger'
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

/**
 * Shared base for app-specific message controllers (user and provider).
 * Subclasses must add @Controller(path) and @ApiTags(tag). All route handlers
 * and logic are identical; only the path and JWT context differ.
 */
@ApiBearerAuth()
export abstract class BaseAppMessagesController {
  protected readonly logger: Logger

  constructor(
    protected readonly messagesService: MessagesService,
    loggerContext: string
  ) {
    this.logger = new Logger(loggerContext)
  }

  @Post()
  @UseGuards(RateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a new message',
    description:
      'Sends a new message in a conversation with idempotency support. Rate limited to 60 messages per minute.',
  })
  @ApiResponse({ status: 201, description: 'Message sent successfully', type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too Many Requests - Rate limit exceeded' })
  async sendMessage(@Body() sendDto: SendMessageDto, @CurrentUser('id') currentUserId: string) {
    this.logger.log(`Sending message in conversation ${sendDto.conversationId}`)
    sendDto.senderId = currentUserId
    const message = await this.messagesService.sendMessage(sendDto)
    return { success: true, message: 'Message sent successfully', data: message }
  }

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
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant in this conversation' })
  async getMessages(@Query() query: GetMessagesDto, @CurrentUser('id') currentUserId: string) {
    this.logger.log(`Getting messages for conversation ${query.conversationId}`)
    const messages = await this.messagesService.getMessages(query, currentUserId)
    return { success: true, message: 'Messages retrieved successfully', data: messages }
  }

  @Patch(':id')
  @UseGuards(MessageAccessGuard)
  @ApiOperation({
    summary: 'Edit a message',
    description: 'Edits the content of a message. User must be the sender.',
  })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({
    status: 200,
    description: 'Message edited successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not the sender' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async editMessage(
    @Param('id') messageId: string,
    @Body() editDto: EditMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Editing message ${messageId}`)
    editDto.messageId = messageId
    editDto.userId = currentUserId
    const message = await this.messagesService.editMessage(editDto)
    return { success: true, message: 'Message edited successfully', data: message }
  }

  @Delete(':id')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a message',
    description: 'Deletes a message. User must be the sender.',
  })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not the sender' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteMessage(
    @Param('id') messageId: string,
    @Body() deleteDto: DeleteMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Deleting message ${messageId}`)
    deleteDto.messageId = messageId
    deleteDto.userId = currentUserId
    await this.messagesService.deleteMessage(deleteDto)
    return { success: true, message: 'Message deleted successfully' }
  }

  @Get(':id')
  @UseGuards(MessageAccessGuard)
  @ApiOperation({
    summary: 'Get message by ID',
    description: 'Retrieves a single message. User must be a participant in the conversation.',
  })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({
    status: 200,
    description: 'Message retrieved successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMessageById(@Param('id') messageId: string) {
    this.logger.log(`Getting message ${messageId}`)
    const message = await this.messagesService.getMessageById(messageId)
    return { success: true, message: 'Message retrieved successfully', data: message }
  }

  @Post(':id/reactions')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add reaction to message',
    description: 'Adds an emoji reaction to a message',
  })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 201, description: 'Reaction added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addReaction(
    @Param('id') messageId: string,
    @Body() reactionDto: AddReactionDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Adding reaction to message ${messageId}`)
    reactionDto.messageId = messageId
    reactionDto.userId = currentUserId
    await this.messagesService.addReaction(reactionDto)
    return { success: true, message: 'Reaction added successfully' }
  }

  @Delete(':id/reactions')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove reaction from message',
    description: 'Removes an emoji reaction from a message',
  })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Reaction removed successfully' })
  @ApiResponse({ status: 404, description: 'Message or reaction not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeReaction(
    @Param('id') messageId: string,
    @Body() reactionDto: RemoveReactionDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Removing reaction from message ${messageId}`)
    reactionDto.messageId = messageId
    reactionDto.userId = currentUserId
    await this.messagesService.removeReaction(reactionDto)
    return { success: true, message: 'Reaction removed successfully' }
  }

  @Post(':id/bookmark')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bookmark a message', description: 'Adds a message to bookmarks' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message bookmarked successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async bookmarkMessage(
    @Param('id') messageId: string,
    @Body() bookmarkDto: BookmarkMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Bookmarking message ${messageId}`)
    bookmarkDto.messageId = messageId
    bookmarkDto.userId = currentUserId
    await this.messagesService.bookmarkMessage(bookmarkDto)
    return { success: true, message: 'Message bookmarked successfully' }
  }

  @Delete(':id/bookmark')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove bookmark from message',
    description: 'Removes a message from bookmarks',
  })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Bookmark removed successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unbookmarkMessage(
    @Param('id') messageId: string,
    @Body() unbookmarkDto: UnbookmarkMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Removing bookmark from message ${messageId}`)
    unbookmarkDto.messageId = messageId
    unbookmarkDto.userId = currentUserId
    await this.messagesService.unbookmarkMessage(unbookmarkDto)
    return { success: true, message: 'Bookmark removed successfully' }
  }

  @Post(':id/pin')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pin a message', description: 'Pins a message in the conversation' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message pinned successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async pinMessage(
    @Param('id') messageId: string,
    @Body() pinDto: PinMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Pinning message ${messageId}`)
    pinDto.messageId = messageId
    pinDto.userId = currentUserId
    await this.messagesService.pinMessage(pinDto)
    return { success: true, message: 'Message pinned successfully' }
  }

  @Delete(':id/pin')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpin a message', description: 'Unpins a message in the conversation' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message unpinned successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unpinMessage(@Param('id') messageId: string, @Body() unpinDto: UnpinMessageDto) {
    this.logger.log(`Unpinning message ${messageId}`)
    unpinDto.messageId = messageId
    await this.messagesService.unpinMessage(unpinDto)
    return { success: true, message: 'Message unpinned successfully' }
  }

  @Post(':id/forward')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Forward a message',
    description: 'Forwards a message to another conversation',
  })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 201, description: 'Message forwarded successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async forwardMessage(
    @Param('id') messageId: string,
    @Body() forwardDto: ForwardMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Forwarding message ${messageId}`)
    forwardDto.messageId = messageId
    forwardDto.forwardedBy = currentUserId
    const message = await this.messagesService.forwardMessage(forwardDto)
    return { success: true, message: 'Message forwarded successfully', data: message }
  }

  @Post('schedule')
  @UseGuards(RateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Schedule a message',
    description: 'Schedules a message to be sent at a specific time',
  })
  @ApiResponse({ status: 201, description: 'Message scheduled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async scheduleMessage(
    @Body() scheduleDto: ScheduleMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Scheduling message for conversation ${scheduleDto.conversationId}`)
    scheduleDto.senderId = currentUserId
    const message = await this.messagesService.scheduleMessage(scheduleDto)
    return { success: true, message: 'Message scheduled successfully', data: message }
  }

  @Post('mark-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark messages as read (batch)',
    description: 'Marks one or more messages as read',
  })
  @ApiResponse({ status: 200, description: 'Messages marked as read successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsRead(@Body() markAsReadDto: MarkAsReadDto, @CurrentUser('id') currentUserId: string) {
    this.logger.log(`Marking messages as read for user ${currentUserId}`)
    markAsReadDto.userId = currentUserId
    await this.messagesService.markAsRead(markAsReadDto)
    return { success: true, message: 'Messages marked as read successfully' }
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark message as read',
    description: 'Marks a message as read for the current user',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({ status: 200, description: 'Message marked as read' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markMessageAsRead(
    @Param('id') messageId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Marking message ${messageId} as read`)
    await this.messagesService.markAsRead({ messageId, userId: currentUserId })
    return { success: true, message: 'Message marked as read' }
  }

  @Post('mark-delivered')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark messages as delivered (batch)',
    description: 'Marks one or more messages as delivered',
  })
  @ApiResponse({ status: 200, description: 'Messages marked as delivered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsDelivered(
    @Body() markAsDeliveredDto: MarkAsDeliveredDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Marking messages as delivered for user ${currentUserId}`)
    markAsDeliveredDto.userId = currentUserId
    await this.messagesService.markAsDelivered(markAsDeliveredDto)
    return { success: true, message: 'Messages marked as delivered successfully' }
  }

  @Post(':id/delivered')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark message as delivered',
    description: 'Marks a message as delivered to the current user',
  })
  @ApiParam({ name: 'id', description: 'Message ID', type: String })
  @ApiResponse({ status: 200, description: 'Message marked as delivered' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markMessageAsDelivered(
    @Param('id') messageId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Marking message ${messageId} as delivered`)
    await this.messagesService.markAsDelivered({ messageId, userId: currentUserId })
    return { success: true, message: 'Message marked as delivered' }
  }

  @Post(':id/report')
  @UseGuards(MessageAccessGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Report a message',
    description: 'Reports a message for violating community guidelines',
  })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 201, description: 'Message reported successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async reportMessage(
    @Param('id') messageId: string,
    @Body() reportDto: ReportMessageDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Reporting message ${messageId}`)
    reportDto.messageId = messageId
    reportDto.reportedBy = currentUserId
    await this.messagesService.reportMessage(reportDto)
    return { success: true, message: 'Message reported successfully' }
  }
}
