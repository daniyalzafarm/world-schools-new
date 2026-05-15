import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from '../../../common/utils/response.util'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { ProviderReviewsService } from './provider-reviews.service'
import { CreateReviewResponseDto } from './dto/create-review-response.dto'

type ReviewStatus = 'draft' | 'pending' | 'published' | 'rejected'

@ApiTags('Provider Reviews')
@ApiBearerAuth()
@Controller('provider/reviews')
@UseGuards(RolesOrPermissionsGuard)
export class ProviderReviewsController {
  constructor(private readonly providerReviewsService: ProviderReviewsService) {}

  @Get()
  @Permissions('camps.read')
  @ApiOperation({ summary: 'List reviews for the current provider' })
  async list(
    @CurrentUser() user: any,
    @Query('status') status?: ReviewStatus,
    @Query('limit') limit?: string
  ) {
    const result = await this.providerReviewsService.listForProvider(user.providerId, {
      status,
      limit: limit ? Number(limit) : undefined,
    })
    return ResponseUtil.success(result.data, result.meta)
  }

  @Put(':reviewId/response')
  @Permissions('camps.manage')
  @ApiOperation({ summary: 'Create or update a camp response to a parent review' })
  async respond(
    @CurrentUser() user: any,
    @Param('reviewId') reviewId: string,
    @Body() dto: CreateReviewResponseDto
  ) {
    const response = await this.providerReviewsService.respondToReview(
      user.id,
      user.providerId,
      reviewId,
      dto
    )
    return ResponseUtil.success({ response })
  }

  @Delete(':reviewId/response')
  @Permissions('camps.manage')
  @ApiOperation({ summary: 'Delete a camp response to a parent review' })
  async deleteResponse(@CurrentUser() user: any, @Param('reviewId') reviewId: string) {
    const result = await this.providerReviewsService.deleteResponse(
      user.id,
      user.providerId,
      reviewId
    )
    return ResponseUtil.success(result)
  }
}
