import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { ResponseUtil } from '../../../common/utils/response.util'
import { SupportTicketsService } from '../services/support-tickets.service'

@ApiTags('Support Tickets (Provider)')
@ApiBearerAuth()
@Controller('provider/support-ticket-categories')
@UseGuards(RolesOrPermissionsGuard)
export class ProviderSupportTicketCategoriesController {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  @Get()
  @ApiOperation({
    summary: 'List support ticket categories for providers',
    description: 'Returns active categories with audience PROVIDER or BOTH, ordered by sortOrder.',
  })
  async listCategories() {
    const categories = await this.supportTicketsService.listCategories('PROVIDER')
    return ResponseUtil.success(categories)
  }
}
