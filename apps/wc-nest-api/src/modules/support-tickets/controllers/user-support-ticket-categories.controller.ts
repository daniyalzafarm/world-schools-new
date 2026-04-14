import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { ResponseUtil } from '../../../common/utils/response.util'
import { SupportTicketsService } from '../services/support-tickets.service'

@ApiTags('Support Tickets (User)')
@ApiBearerAuth()
@Controller('user/support-ticket-categories')
@UseGuards(RolesOrPermissionsGuard)
export class UserSupportTicketCategoriesController {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  @Get()
  @ApiOperation({
    summary: 'List support ticket categories for parents',
    description: 'Returns active categories with audience PARENT or BOTH, ordered by sortOrder.',
  })
  async listCategories() {
    const categories = await this.supportTicketsService.listCategories('PARENT')
    return ResponseUtil.success(categories)
  }
}
