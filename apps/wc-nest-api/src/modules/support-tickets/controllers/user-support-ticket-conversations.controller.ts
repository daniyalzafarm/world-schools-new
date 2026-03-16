import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { SupportTicketsService } from '../services/support-tickets.service'
import { SupportTicketConversationService } from '../services/support-ticket-conversation.service'
import { AddTicketReplyDto } from '../dto'
import { SenderType } from '../../../generated/client/client'

@ApiTags('Support Ticket Conversations (User)')
@ApiBearerAuth()
@Controller('user/support-tickets/:id')
@UseGuards(RolesOrPermissionsGuard)
export class UserSupportTicketConversationsController {
  constructor(
    private readonly supportTicketsService: SupportTicketsService,
    private readonly conversationService: SupportTicketConversationService
  ) {}

  private accessContext(user: { id: string; providerId?: string | null; permissions?: string[] }) {
    return {
      currentUserId: user.id,
      providerId: user.providerId ?? null,
      hasSupportTicketsRead: user.permissions?.includes('support_tickets.read') ?? false,
    }
  }

  @Get('conversation')
  @ApiOperation({
    summary: 'Get conversation messages for a support ticket',
  })
  async getConversation(
    @Param('id') ticketId: string,
    @CurrentUser() user: { id: string; providerId?: string | null; permissions?: string[] },
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string
  ) {
    await this.supportTicketsService.getTicketById(ticketId, this.accessContext(user))
    const result = await this.conversationService.getTicketConversationMessages(ticketId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor: cursor || undefined,
    })
    return ResponseUtil.success(result.data, result.meta)
  }

  @Post('replies')
  @ApiOperation({
    summary: 'Add a reply to a support ticket conversation',
  })
  async addReply(
    @Param('id') ticketId: string,
    @Body() dto: AddTicketReplyDto,
    @CurrentUser() user: { id: string; providerId?: string | null; permissions?: string[] }
  ) {
    await this.supportTicketsService.getTicketById(ticketId, this.accessContext(user))
    const reply = await this.conversationService.addReply(
      ticketId,
      {
        ticketId,
        senderId: user.id,
        senderType: SenderType.USER,
        content: dto.content,
        attachmentIds: dto.attachmentIds,
      },
      user.id
    )
    return ResponseUtil.success(reply)
  }
}
