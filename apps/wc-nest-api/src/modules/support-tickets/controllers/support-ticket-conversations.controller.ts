import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { SupportTicketsService } from '../services/support-tickets.service'
import { SupportTicketConversationService } from '../services/support-ticket-conversation.service'
import { CreateTicketReplyDto } from '../dto'

@ApiTags('Support Ticket Conversations (Superadmin)')
@ApiBearerAuth()
@Controller('superadmin/support-tickets/:id')
@UseGuards(RolesOrPermissionsGuard)
export class SupportTicketConversationsController {
  constructor(
    private readonly supportTicketsService: SupportTicketsService,
    private readonly conversationService: SupportTicketConversationService
  ) {}

  @Get('conversation')
  @Permissions('support_tickets.read')
  @ApiOperation({
    summary: 'Get conversation messages for a support ticket (admin)',
  })
  async getConversation(
    @Param('id') ticketId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ) {
    await this.supportTicketsService.getTicketById(ticketId, {
      currentUserId: '',
      providerId: null,
      hasSupportTicketsRead: true,
    })
    const result = await this.conversationService.getTicketConversationMessages(ticketId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor: cursor || undefined,
    })
    return ResponseUtil.success(result.data, result.meta)
  }

  @Post('replies')
  @Permissions('support_tickets.update')
  @ApiOperation({
    summary: 'Add a reply to a support ticket conversation (admin)',
  })
  async addReply(
    @Param('id') ticketId: string,
    @Body() dto: CreateTicketReplyDto,
    @CurrentUser('id') currentUserId: string
  ) {
    await this.supportTicketsService.getTicketById(ticketId, {
      currentUserId: '',
      providerId: null,
      hasSupportTicketsRead: true,
    })
    const reply = await this.conversationService.addReply(ticketId, dto, currentUserId)
    // Auto-assign on first superadmin reply if ticket is unassigned
    const ticket = await this.supportTicketsService.getTicketById(ticketId, {
      currentUserId: '',
      providerId: null,
      hasSupportTicketsRead: true,
    })
    if (!ticket.assignedToUser) {
      await this.supportTicketsService.assignTicket(
        ticketId,
        { assignedToUserId: currentUserId },
        currentUserId
      )
    }
    return ResponseUtil.success(reply)
  }
}
