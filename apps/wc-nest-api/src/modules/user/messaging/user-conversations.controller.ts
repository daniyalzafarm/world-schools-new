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
import { ConversationAccessGuard } from '../../messaging/guards/conversation-access.guard'
import { ConversationsService } from '../../messaging/services/conversations.service'
import {
  AddLabelDto,
  AssignConversationDto,
  CreateConversationDto,
  GetConversationsDto,
  RemoveLabelDto,
  UpdateConversationSettingsDto,
  UpdateConversationStatusDto,
} from '../../messaging/dto/conversation.dto'
import {
  ConversationMetricsResponseDto,
  ConversationResponseDto,
  PaginatedConversationsResponseDto,
} from '../../messaging/dto/response.dto'

/**
 * User Conversations Controller
 *
 * App-specific wrapper for conversation endpoints used by wc-booking (user) app.
 * All endpoints are prefixed with /user/messaging/conversations
 *
 * This controller delegates to the shared ConversationsService but ensures:
 * - JWT strategy uses wc_user_access_token cookie (based on /user/* path)
 * - Proper token isolation between apps
 * - Consistent API structure with other user endpoints
 */
@ApiTags('User Messaging - Conversations')
@ApiBearerAuth()
@Controller('user/messaging/conversations')
export class UserConversationsController {
  private readonly logger = new Logger(UserConversationsController.name)

  constructor(private readonly conversationsService: ConversationsService) {}

  /**
   * Create a new conversation or return existing one
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new conversation',
    description:
      'Creates a new conversation between a user and a provider/superadmin. Returns existing conversation if one already exists.',
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createConversation(
    @Body() createDto: CreateConversationDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Creating conversation for user ${currentUserId}`)

    // Override userId with current user for security
    createDto.userId = currentUserId

    const conversation = await this.conversationsService.createConversation(createDto)

    return {
      success: true,
      message: 'Conversation created successfully',
      data: conversation,
    }
  }

  /**
   * Get all conversations for the current user
   */
  @Get()
  @ApiOperation({
    summary: 'Get all conversations',
    description:
      'Retrieves all conversations for the authenticated user with optional filters. The userId is automatically extracted from the JWT token and should NOT be sent in query parameters.',
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['all', 'unread', 'archived', 'starred', 'pinned'],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
    type: PaginatedConversationsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid query parameters' })
  async getConversations(
    @Query() query: GetConversationsDto,
    @CurrentUser('id') currentUserId: string
  ) {
    if (!currentUserId) {
      throw new Error('User ID is required')
    }

    // ALWAYS override userId with authenticated user (ignore any userId from query params)
    query.userId = currentUserId
    // Exclude support-ticket-backed conversations from the regular user inbox
    query.excludeSupportTicketContext = true

    this.logger.log(`Getting conversations for user ${currentUserId}`)

    // Remove 'pinned' from filter if present (not supported by service)
    if (query.filter === 'pinned') {
      query.filter = 'all'
    }

    const conversations = await this.conversationsService.getConversations(query)

    // Get total count for pagination
    const total = await this.conversationsService.getConversationsCount(query)

    // Build paginated response
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0
    const hasMore = offset + conversations.length < total

    return {
      success: true,
      message: 'Conversations retrieved successfully',
      data: conversations,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
    }
  }

  /**
   * Get unread conversation count (excluding support tickets)
   */
  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread conversation count',
    description:
      'Returns the number of conversations with unread messages, excluding support ticket conversations.',
  })
  @ApiResponse({ status: 200, description: 'Unread conversation count retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadConversationsCount(@CurrentUser('id') currentUserId: string) {
    const count = await this.conversationsService.getPersonalUnreadConversationsCount(currentUserId)
    return { success: true, data: { count } }
  }

  /**
   * Get a single conversation by ID
   */
  @Get(':id')
  @UseGuards(ConversationAccessGuard)
  @ApiOperation({
    summary: 'Get conversation by ID',
    description: 'Retrieves a single conversation with all details. User must be a participant.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getConversationById(
    @Param('id') conversationId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Getting conversation ${conversationId}`)

    const conversation = await this.conversationsService.getConversationById(
      conversationId,
      currentUserId
    )

    return {
      success: true,
      message: 'Conversation retrieved successfully',
      data: conversation,
    }
  }

  /**
   * Update conversation settings (pin, star, mute, archive)
   */
  @Patch(':id/settings')
  @UseGuards(ConversationAccessGuard)
  @ApiOperation({
    summary: 'Update conversation settings',
    description:
      'Updates user-specific conversation settings like pinned, starred, muted, archived. User must be a participant.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Conversation settings updated successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateConversationSettings(
    @Param('id') conversationId: string,
    @Body() updateDto: UpdateConversationSettingsDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Updating settings for conversation ${conversationId}`)

    // Merge userId into DTO
    updateDto.conversationId = conversationId
    updateDto.userId = currentUserId

    const conversation = await this.conversationsService.updateConversationSettings(updateDto)

    return {
      success: true,
      message: 'Conversation settings updated successfully',
      data: conversation,
    }
  }

  /**
   * Mark all messages in a conversation as read
   */
  @Post(':id/mark-read')
  @UseGuards(ConversationAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all messages as read',
    description:
      'Marks all messages in the conversation as read for the current user. User must be a participant.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'All messages marked as read successfully',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markConversationAsRead(
    @Param('id') conversationId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Marking conversation ${conversationId} as read`)

    await this.conversationsService.markAllAsRead(conversationId, currentUserId)

    return {
      success: true,
      message: 'All messages marked as read successfully',
    }
  }

  /**
   * Assign a conversation to a user (admin/support feature)
   */
  @Post(':id/assign')
  @UseGuards(ConversationAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign conversation to a user',
    description:
      'Assigns a conversation to a specific user (typically for support/admin workflows). User must be a participant.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Conversation assigned successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async assignConversation(
    @Param('id') conversationId: string,
    @Body() assignDto: AssignConversationDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Assigning conversation ${conversationId}`)

    // Merge userId into DTO
    assignDto.conversationId = conversationId
    assignDto.assignedBy = currentUserId

    const conversation = await this.conversationsService.assignConversation(assignDto)

    return {
      success: true,
      message: 'Conversation assigned successfully',
      data: conversation,
    }
  }

  /**
   * Update conversation status (open, resolved, closed)
   */
  @Patch(':id/status')
  @UseGuards(ConversationAccessGuard)
  @ApiOperation({
    summary: 'Update conversation status',
    description:
      'Updates the conversation status (OPEN, RESOLVED, CLOSED). User must be a participant.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Conversation status updated successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateConversationStatus(
    @Param('id') conversationId: string,
    @Body() updateDto: UpdateConversationStatusDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Updating status for conversation ${conversationId}`)

    // Merge userId into DTO
    updateDto.conversationId = conversationId
    updateDto.userId = currentUserId

    const conversation = await this.conversationsService.updateConversationStatus(updateDto)

    return {
      success: true,
      message: 'Conversation status updated successfully',
      data: conversation,
    }
  }

  /**
   * Add a label to a conversation
   */
  @Post(':id/labels')
  @UseGuards(ConversationAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add label to conversation',
    description: 'Adds a label to the conversation for organization. User must be a participant.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Label added successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addLabel(
    @Param('id') conversationId: string,
    @Body() addLabelDto: AddLabelDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Adding label to conversation ${conversationId}`)

    // Merge conversationId into DTO
    addLabelDto.conversationId = conversationId

    const conversation = await this.conversationsService.addLabel(addLabelDto, currentUserId)

    return {
      success: true,
      message: 'Label added successfully',
      data: conversation,
    }
  }

  /**
   * Remove a label from a conversation
   */
  @Delete(':id/labels/:labelId')
  @UseGuards(ConversationAccessGuard)
  @ApiOperation({
    summary: 'Remove label from conversation',
    description: 'Removes a label from the conversation. User must be a participant.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiParam({ name: 'labelId', description: 'Label ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Label removed successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation or label not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeLabel(
    @Param('id') conversationId: string,
    @Param('labelId') labelId: string,
    @Body() removeLabelDto: RemoveLabelDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Removing label ${labelId} from conversation ${conversationId}`)

    // Merge conversationId and labelId into DTO
    removeLabelDto.conversationId = conversationId
    removeLabelDto.labelId = labelId

    const conversation = await this.conversationsService.removeLabel(removeLabelDto)

    return {
      success: true,
      message: 'Label removed successfully',
      data: conversation,
    }
  }

  /**
   * Get conversation metrics
   */
  @Get(':id/metrics')
  @UseGuards(ConversationAccessGuard)
  @ApiOperation({
    summary: 'Get conversation metrics',
    description:
      'Retrieves metrics for a conversation (total messages, unread count, etc.). User must be a participant.',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Conversation metrics retrieved successfully',
    type: ConversationMetricsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getConversationMetrics(
    @Param('id') conversationId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Getting metrics for conversation ${conversationId}`)

    const metrics = await this.conversationsService.getConversationMetrics(conversationId)

    return {
      success: true,
      message: 'Conversation metrics retrieved successfully',
      data: metrics,
    }
  }
}
