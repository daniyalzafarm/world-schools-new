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
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ConversationAccessGuard } from '../guards/conversation-access.guard'
import { ConversationsService } from '../services/conversations.service'
import {
  AddLabelDto,
  AssignConversationDto,
  CreateConversationDto,
  GetConversationsDto,
  RemoveLabelDto,
  UpdateConversationSettingsDto,
  UpdateConversationStatusDto,
} from '../dto/conversation.dto'
import {
  ConversationMetricsResponseDto,
  ConversationResponseDto,
  PaginatedConversationsResponseDto,
} from '../dto/response.dto'

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('messaging/conversations')
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name)

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

    // Ensure the user can only create conversations for themselves
    if (createDto.userId !== currentUserId) {
      createDto.userId = currentUserId
    }

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
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'RESOLVED', 'CLOSED'] })
  @ApiQuery({ name: 'type', required: false, enum: ['USER_PROVIDER', 'USER_SUPERADMIN'] })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
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
    this.logger.log(`Getting conversation ${conversationId} for user ${currentUserId}`)

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
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateConversationSettings(
    @Param('id') conversationId: string,
    @Body() updateDto: UpdateConversationSettingsDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Updating settings for conversation ${conversationId}`)

    // Override IDs with current user and conversation
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
    description: 'Messages marked as read successfully',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(
    @Param('id') conversationId: string,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Marking all messages as read in conversation ${conversationId}`)

    await this.conversationsService.markAllAsRead(conversationId, currentUserId)

    return {
      success: true,
      message: 'All messages marked as read',
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
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async assignConversation(
    @Param('id') conversationId: string,
    @Body() assignDto: AssignConversationDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Assigning conversation ${conversationId} to user ${assignDto.assignedToId}`)

    // Override IDs
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
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateConversationStatus(
    @Param('id') conversationId: string,
    @Body() statusDto: UpdateConversationStatusDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Updating status for conversation ${conversationId} to ${statusDto.status}`)

    // Override IDs
    statusDto.conversationId = conversationId
    statusDto.userId = currentUserId

    const conversation = await this.conversationsService.updateConversationStatus(statusDto)

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
  @ApiResponse({ status: 404, description: 'Conversation or label not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not a participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addLabel(
    @Param('id') conversationId: string,
    @Body() labelDto: AddLabelDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Adding label ${labelDto.labelId} to conversation ${conversationId}`)

    // Override conversation ID
    labelDto.conversationId = conversationId

    const conversation = await this.conversationsService.addLabel(labelDto, currentUserId)

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
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(
      `Removing label ${labelId} from conversation ${conversationId} by user ${currentUserId}`
    )

    const labelDto: RemoveLabelDto = {
      conversationId,
      labelId,
    }

    const conversation = await this.conversationsService.removeLabel(labelDto)

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
    this.logger.log(`Getting metrics for conversation ${conversationId} for user ${currentUserId}`)

    const metrics = await this.conversationsService.getConversationMetrics(conversationId)

    return {
      success: true,
      message: 'Conversation metrics retrieved successfully',
      data: metrics,
    }
  }

  /**
   * ✅ PHASE 5 FIX: Get cache metrics for monitoring
   * Admin-only endpoint for monitoring Redis cache health
   */
  @Get('cache/metrics')
  @UseGuards(RolesOrPermissionsGuard)
  @Roles('Super Admin', 'Provider Admin')
  @ApiOperation({
    summary: 'Get cache metrics',
    description: 'Get Redis cache metrics for monitoring (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache metrics retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCacheMetrics() {
    this.logger.log('Getting cache metrics')

    const metrics = await this.conversationsService.getCacheMetrics()

    return {
      success: true,
      message: 'Cache metrics retrieved successfully',
      data: {
        memory: {
          used: metrics.usedMemory,
          max: metrics.maxMemory,
          usagePercent: ((metrics.usedMemory / metrics.maxMemory) * 100).toFixed(2),
        },
        keys: {
          total: metrics.keyCount,
          evicted: metrics.evictedKeys,
        },
        fragmentation: metrics.memoryFragmentationRatio,
        status: metrics.usedMemory / metrics.maxMemory > 0.8 ? 'WARNING' : 'OK',
      },
    }
  }
}
