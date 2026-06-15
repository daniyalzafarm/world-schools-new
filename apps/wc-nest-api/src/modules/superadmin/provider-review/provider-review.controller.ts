import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from '../../../common/utils/response.util'
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/auth/decorators/current-user.decorator'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { ListProviderReviewsDto } from './dto/list-provider-reviews.dto'
import { ResolveProviderReviewDto } from './dto/resolve-provider-review.dto'
import { ProviderAdminReviewQueueService } from './provider-admin-review.service'

/**
 * Superadmin surface for the provider admin-review queue (Payments revamp, Spec
 * v2.3 §4). Provider cancellations and other risk signals open a review here;
 * an admin triages and resolves. There is NO auto-suspension anywhere — this
 * queue is the human-in-the-loop.
 */
@ApiTags('SuperAdmin Provider Review')
@ApiBearerAuth()
@Controller('superadmin/provider-reviews')
@UseGuards(RolesOrPermissionsGuard)
export class ProviderReviewController {
  constructor(private readonly reviewService: ProviderAdminReviewQueueService) {}

  @Get()
  @Permissions('providers.read')
  @ApiOperation({ summary: 'List provider reviews, newest first, with optional status filter.' })
  async list(@Query() query: ListProviderReviewsDto) {
    return ResponseUtil.success(await this.reviewService.list(query))
  }

  @Get(':id')
  @Permissions('providers.read')
  @ApiOperation({ summary: 'Provider review detail (includes provider context).' })
  async getById(@Param('id') id: string) {
    return ResponseUtil.success(await this.reviewService.getById(id))
  }

  @Post(':id/resolve')
  @Permissions('providers.write')
  @ApiOperation({
    summary: 'Move a review to under_review (picked up) or resolved (closed with a decision).',
  })
  async resolve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ResolveProviderReviewDto
  ) {
    const row = await this.reviewService.resolve(id, {
      reviewedByUserId: user.id,
      status: dto.status,
      decision: dto.decision,
      decisionNotes: dto.decisionNotes,
    })
    return ResponseUtil.success(row)
  }
}
