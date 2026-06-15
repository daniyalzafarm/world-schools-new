import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from '../../../common/utils/response.util'
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/auth/decorators/current-user.decorator'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { ListPaymentReviewsDto } from './dto/list-payment-reviews.dto'
import { ResolvePaymentReviewDto } from './dto/resolve-payment-review.dto'
import { PaymentReviewService } from './payment-review.service'

/**
 * Superadmin surface for the payment-review queue (Payments revamp, Spec v2.3
 * §7). Bookings whose scheduled capture exhausted its retries land here — never
 * auto-cancelled. An admin cancels+refunds or marks them resolved offline.
 */
@ApiTags('SuperAdmin Payment Review')
@ApiBearerAuth()
@Controller('superadmin/payment-reviews')
@UseGuards(RolesOrPermissionsGuard)
export class PaymentReviewController {
  constructor(private readonly paymentReviewService: PaymentReviewService) {}

  @Get()
  @Permissions('billing.read')
  @ApiOperation({ summary: 'List open payment reviews (oldest-flagged first).' })
  async list(@Query() query: ListPaymentReviewsDto) {
    return ResponseUtil.success(await this.paymentReviewService.list(query))
  }

  @Post(':bookingGroupId/resolve')
  @Permissions('billing.write')
  @ApiOperation({
    summary: 'Resolve a payment review — `cancel` (refund + cancel) or `mark_resolved` (offline).',
  })
  async resolve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('bookingGroupId') bookingGroupId: string,
    @Body() dto: ResolvePaymentReviewDto
  ) {
    const row = await this.paymentReviewService.resolve(bookingGroupId, user.id, {
      action: dto.action,
      notes: dto.notes,
    })
    return ResponseUtil.success(row)
  }
}
