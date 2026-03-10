import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { SupportTicketsService } from '../services/support-tickets.service'
import { CreateSupportTicketDto, GetSupportTicketsDto, UpdateSupportTicketStatusDto } from '../dto'
import {
  SupportTicketRequesterType,
  SupportTicketSourceApp,
} from '../../../generated/client/client'

@ApiTags('Support Tickets (Provider)')
@ApiBearerAuth()
@Controller('provider/support-tickets')
@UseGuards(RolesOrPermissionsGuard)
export class ProviderSupportTicketsController {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  private accessContext(user: { id: string; providerId?: string | null; permissions?: string[] }) {
    return {
      currentUserId: user.id,
      providerId: user.providerId ?? null,
      hasSupportTicketsRead: user.permissions?.includes('support_tickets.read') ?? false,
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Create a support ticket (provider)',
    description: 'Creates a support ticket with sourceApp=WC_PROVIDER and requesterType=PROVIDER.',
  })
  async createTicket(
    @Body() dto: CreateSupportTicketDto,
    @CurrentUser() user: { id: string; providerId?: string | null }
  ) {
    const providerId = user.providerId ?? undefined
    const payload = {
      ...dto,
      sourceApp: SupportTicketSourceApp.WC_PROVIDER,
      requesterType: SupportTicketRequesterType.PROVIDER,
      requesterUserId: user.id,
      requesterProviderId: providerId,
    }
    const ticket = await this.supportTicketsService.createTicket(
      payload,
      user.id,
      user.providerId ?? null
    )
    return ResponseUtil.success(ticket)
  }

  @Get('my')
  @ApiOperation({
    summary: 'List my support tickets',
  })
  async listMyTickets(
    @Query() query: GetSupportTicketsDto,
    @CurrentUser() user: { id: string; providerId?: string | null }
  ) {
    const result = await this.supportTicketsService.listMyTickets(
      user.id,
      user.providerId ?? null,
      query
    )
    return ResponseUtil.success(result.data, result.meta)
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a support ticket by ID or ticket number',
  })
  async getTicketById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; providerId?: string | null; permissions?: string[] }
  ) {
    const ticket = await this.supportTicketsService.getTicketById(id, this.accessContext(user))
    return ResponseUtil.success(ticket)
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update my ticket status (provider)',
    description:
      'Allows the requester to change their own ticket status. Currently constrained to resolved/closed flows.',
  })
  async updateMyTicketStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketStatusDto,
    @CurrentUser() user: { id: string; providerId?: string | null; permissions?: string[] }
  ) {
    // Ensure the ticket belongs to the current user or their provider
    await this.supportTicketsService.getTicketById(id, this.accessContext(user))
    const updated = await this.supportTicketsService.updateTicketStatus(id, dto, user.id)
    return ResponseUtil.success(updated)
  }
}
