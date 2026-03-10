import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { SupportTicketsService } from '../services/support-tickets.service'
import {
  AssignSupportTicketDto,
  CreateSupportTicketDto,
  GetSupportTicketsDto,
  ReopenSupportTicketDto,
  UpdateSupportTicketDto,
  UpdateSupportTicketStatusDto,
} from '../dto'

@ApiTags('Support Tickets (Superadmin)')
@ApiBearerAuth()
@Controller('superadmin/support-tickets')
@UseGuards(RolesOrPermissionsGuard)
export class SupportTicketsController {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  @Post()
  @Permissions('support_tickets.read')
  @ApiOperation({
    summary: 'Create a support ticket (admin)',
    description: 'Creates a support ticket on behalf of a requester.',
  })
  async createTicket(
    @Body() dto: CreateSupportTicketDto,
    @CurrentUser() user: { id: string; providerId?: string | null }
  ) {
    const ticket = await this.supportTicketsService.createTicket(
      dto,
      user.id,
      user.providerId ?? null
    )
    return ResponseUtil.success(ticket)
  }

  @Get()
  @Permissions('support_tickets.read')
  @ApiOperation({
    summary: 'List support tickets (admin)',
    description:
      'Lists support tickets with filtering and pagination options. Requires support_tickets.read.',
  })
  async listTickets(
    @Query() query: GetSupportTicketsDto,
    @CurrentUser('id') currentUserId: string
  ) {
    const result = await this.supportTicketsService.listTickets(query, currentUserId)
    return ResponseUtil.success(result.data, result.meta)
  }

  @Get('stats')
  @Permissions('support_tickets.read')
  @ApiOperation({
    summary: 'Get ticket counts by status (admin)',
  })
  async getTicketStats(@CurrentUser('id') _currentUserId: string) {
    const stats = await this.supportTicketsService.getTicketCountsByStatus()
    return ResponseUtil.success(stats)
  }

  @Get(':id')
  @Permissions('support_tickets.read')
  @ApiOperation({
    summary: 'Get a support ticket by ID or ticket number (admin)',
  })
  async getTicketById(@Param('id') id: string) {
    const ticket = await this.supportTicketsService.getTicketById(id, {
      currentUserId: '',
      providerId: null,
      hasSupportTicketsRead: true,
    })
    return ResponseUtil.success(ticket)
  }

  @Patch(':id')
  @Permissions('support_tickets.update')
  @ApiOperation({
    summary: 'Update a support ticket',
  })
  async updateTicket(@Param('id') id: string, @Body() dto: UpdateSupportTicketDto) {
    const ticket = await this.supportTicketsService.updateTicket(id, dto)
    return ResponseUtil.success(ticket)
  }

  @Patch(':id/status')
  @Permissions('support_tickets.update')
  @ApiOperation({
    summary: 'Update support ticket status',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketStatusDto,
    @CurrentUser('id') currentUserId: string
  ) {
    const ticket = await this.supportTicketsService.updateTicketStatus(id, dto, currentUserId)
    return ResponseUtil.success(ticket)
  }

  @Patch(':id/assign')
  @Permissions('support_tickets.assign')
  @ApiOperation({
    summary: 'Assign or reassign a support ticket',
  })
  async assignTicket(
    @Param('id') id: string,
    @Body() dto: AssignSupportTicketDto,
    @CurrentUser('id') currentUserId: string
  ) {
    const ticket = await this.supportTicketsService.assignTicket(id, dto, currentUserId)
    return ResponseUtil.success(ticket)
  }

  @Post(':id/reopen')
  @Permissions('support_tickets.update')
  @ApiOperation({
    summary: 'Reopen a resolved or closed support ticket',
  })
  async reopenTicket(
    @Param('id') id: string,
    @Body() dto: ReopenSupportTicketDto,
    @CurrentUser('id') currentUserId: string
  ) {
    const ticket = await this.supportTicketsService.reopenTicket(id, dto, currentUserId)
    return ResponseUtil.success(ticket)
  }

  @Delete(':id')
  @Permissions('support_tickets.delete')
  @ApiOperation({
    summary: 'Soft delete a support ticket',
  })
  async softDeleteTicket(@Param('id') id: string, @CurrentUser('id') currentUserId: string) {
    const result = await this.supportTicketsService.softDeleteTicket(id, currentUserId)
    return ResponseUtil.success(result)
  }
}
