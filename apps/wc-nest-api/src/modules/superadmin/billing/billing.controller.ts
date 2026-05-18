import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from '../../../common/utils/response.util'
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/auth/decorators/current-user.decorator'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { PaymentIntentsService } from '../../billing/intents/payment-intents.service'
import { RefundsService } from '../../billing/refunds/refunds.service'
import { ReimbursementsService } from '../../billing/reimbursements/reimbursements.service'
import { CancelByCampDto } from './dto/cancel-camp.dto'
import { CancelForceMajeureDto } from './dto/cancel-force-majeure.dto'
import { ListReimbursementsDto } from './dto/list-reimbursements.dto'

/**
 * Admin-side billing endpoints for Phase 4:
 *   - Camp-cancel + force-majeure refund triggers (BookingGroup-scoped).
 *   - Reimbursement list / settle / write-off (the camp's debt to the
 *     platform under Accounts v2 `losses.payments='application'` —
 *     post-payout refunds).
 *
 * All endpoints are gated behind `RolesOrPermissionsGuard`. Permissions are
 * scoped to a new `billing.write` permission for the cancel actions and
 * `billing.read` for the read actions; we follow the existing
 * `parents.read` / `parents.write` style established by the parents
 * controller. (Permission seeding is a one-line add to the seed script
 * and is intentionally out of scope here — superadmins with the wildcard
 * role will work today; granular per-permission rollout is a follow-up.)
 *
 * `voidAuthFn` is wired to `PaymentIntentsService.cancelForBookingGroup`
 * so that pre-capture admin cancellations void the open auth instead of
 * trying (and failing) to refund a non-existent charge.
 */
@ApiTags('SuperAdmin Billing')
@ApiBearerAuth()
@Controller('superadmin')
@UseGuards(RolesOrPermissionsGuard)
export class SuperAdminBillingController {
  constructor(
    private readonly refundsService: RefundsService,
    private readonly reimbursementsService: ReimbursementsService,
    private readonly paymentIntentsService: PaymentIntentsService
  ) {}

  // -------- Booking-group refund actions ---------------------------------

  @Post('booking-groups/:id/refund/camp-cancel')
  @Permissions('billing.write')
  @ApiOperation({
    summary:
      'Cancel a booking on behalf of the camp. 100% refund + Reimbursement row if payout already disbursed.',
  })
  async cancelByCamp(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') bookingGroupId: string,
    @Body() _dto: CancelByCampDto
  ) {
    const result = await this.refundsService.cancelByCamp({
      bookingGroupId,
      adminUserId: user.id,
      voidAuthFn: id =>
        this.paymentIntentsService
          .cancelForBookingGroup(id, 'requested_by_customer')
          .then(() => undefined),
    })
    return ResponseUtil.success({
      bookingGroupId,
      mode: result.mode,
      refundCount: result.refunds.length,
    })
  }

  @Post('booking-groups/:id/refund/force-majeure')
  @Permissions('billing.write')
  @ApiOperation({
    summary:
      'Force-majeure cancellation. Mode `cash` issues a Stripe refund less the app fee; `credit_note` queues for the docs module.',
  })
  async cancelByForceMajeure(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') bookingGroupId: string,
    @Body() dto: CancelForceMajeureDto
  ) {
    const result = await this.refundsService.cancelByForceMajeure({
      bookingGroupId,
      adminUserId: user.id,
      mode: dto.mode,
      voidAuthFn: id =>
        this.paymentIntentsService
          .cancelForBookingGroup(id, 'requested_by_customer')
          .then(() => undefined),
    })
    return ResponseUtil.success({
      bookingGroupId,
      mode: result.mode,
      refundCount: result.refunds.length,
    })
  }

  // -------- Reimbursements -----------------------------------------------

  @Get('reimbursements')
  @Permissions('billing.read')
  @ApiOperation({
    summary: 'List reimbursements with optional status filter, ordered by dueDate ASC.',
  })
  async listReimbursements(@Query() query: ListReimbursementsDto) {
    const result = await this.reimbursementsService.listForAdmin({
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    })
    return ResponseUtil.success(result)
  }

  @Get('reimbursements/:id')
  @Permissions('billing.read')
  @ApiOperation({ summary: 'Reimbursement detail (includes booking + parent context).' })
  async getReimbursement(@Param('id') id: string) {
    const row = await this.reimbursementsService.findByIdForAdmin(id)
    return ResponseUtil.success(row)
  }

  @Post('reimbursements/:id/settle')
  @Permissions('billing.write')
  @ApiOperation({
    summary: 'Mark a reimbursement settled (camp paid). Idempotent — re-settling is a no-op.',
  })
  async settleReimbursement(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const row = await this.reimbursementsService.markSettled({
      reimbursementId: id,
      adminUserId: user.id,
    })
    return ResponseUtil.success(row)
  }

  @Post('reimbursements/:id/write-off')
  @Permissions('billing.write')
  @ApiOperation({
    summary:
      'Write off a reimbursement (uncollectable — provider out of business, etc.). Stops further reminder emails.',
  })
  async writeOffReimbursement(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const row = await this.reimbursementsService.writeOff({
      reimbursementId: id,
      adminUserId: user.id,
    })
    return ResponseUtil.success(row)
  }
}
