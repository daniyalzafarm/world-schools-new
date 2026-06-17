import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from '../../../common/utils/response.util'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { BookingGroupsService } from '../../booking-groups/booking-groups.service'
import { CancelBookingGroupDto } from './dto/cancel-booking-group.dto'
import { CheckEligibilityDto } from './dto/check-eligibility.dto'
import { CreateDraftBookingGroupDto } from './dto/create-draft-booking-group.dto'
import { QueryParentBookingGroupsDto } from './dto/query-parent-booking-groups.dto'
import { RescheduleConsentDto, RescheduleDeclineDto } from './dto/reschedule-consent.dto'
import { SaveBookingGroupAddOnsDto } from './dto/save-booking-group-addons.dto'
import { SubmitBookingGroupDto } from './dto/submit-booking-group.dto'
import { UpdateDraftBookingGroupDto } from './dto/update-draft-booking-group.dto'

@ApiTags('User Booking Groups')
@ApiBearerAuth()
@Controller('user/booking-groups')
@UseGuards(RolesOrPermissionsGuard)
@Roles('Parent')
export class UserBookingGroupsController {
  constructor(private readonly bookingGroupsService: BookingGroupsService) {}

  @Post('eligibility-check')
  @ApiOperation({ summary: 'Pre-validate children against a camp/session (non-mutating)' })
  async checkEligibility(@CurrentUser() user: any, @Body() dto: CheckEligibilityDto) {
    const result = await this.bookingGroupsService.checkEligibilityForParent(user.id, {
      campId: dto.campId,
      sessionId: dto.sessionId,
      childIds: dto.childIds,
    })
    return ResponseUtil.success(result)
  }

  @Post('draft')
  @ApiOperation({ summary: 'Create draft booking group' })
  async createDraft(@CurrentUser() user: any, @Body() dto: CreateDraftBookingGroupDto) {
    const result = await this.bookingGroupsService.createDraftForParent({
      userId: user.id,
      campId: dto.campId,
      sessionId: dto.sessionId,
      childIds: dto.childIds,
      specialRequest: dto.specialRequest,
      guardianConsent: dto.guardianConsent,
      forceNew: dto.forceNew,
    })
    return ResponseUtil.success(result)
  }

  @Get('draft-previews/latest')
  @ApiOperation({ summary: 'Get latest draft booking previews for a camp' })
  async getLatestDraftPreviews(@CurrentUser() user: any, @Query('campId') campId: string) {
    const result = await this.bookingGroupsService.getLatestDraftPreviewsForParent(user.id, campId)
    return ResponseUtil.success(result)
  }

  // Declared before `@Get(':id')` so the static path isn't swallowed by the
  // id param route.
  @Get('child-booking-ranges')
  @ApiOperation({
    summary: "Date windows of the parent's children's capacity-consuming bookings",
  })
  async getChildBookingRanges(@CurrentUser() user: any) {
    const result = await this.bookingGroupsService.getChildBookingRangesForParent(user.id)
    return ResponseUtil.success(result)
  }

  // Declared before `@Get(':id')` so the static prefix isn't swallowed by the
  // id param route.
  @Get('by-camp/:campId')
  @ApiOperation({
    summary: "The parent's primary booking with a camp (messaging context panel)",
  })
  async getByCamp(@CurrentUser() user: any, @Param('campId') campId: string) {
    const result = await this.bookingGroupsService.getPrimaryForParentByCamp(user.id, campId)
    return ResponseUtil.success(result)
  }

  @Get()
  @ApiOperation({ summary: 'List booking groups for the current parent' })
  async list(@CurrentUser() user: any, @Query() query: QueryParentBookingGroupsDto) {
    const { data, meta } = await this.bookingGroupsService.listForParent(user.id, query)
    return ResponseUtil.success(data, meta)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking group details' })
  async getById(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.bookingGroupsService.getForParent(user.id, id)
    return ResponseUtil.success(result)
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit draft booking group as request' })
  async submit(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SubmitBookingGroupDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    const result = await this.bookingGroupsService.submitForParent(user.id, id, {
      consentAcknowledged: dto.consentAcknowledged ?? false,
      policyTextShown: dto.policyTextShown ?? null,
      schemaVersion: dto.schemaVersion ?? 1,
      ipAddress: ip ?? null,
      userAgent: userAgent ?? null,
    })
    return ResponseUtil.success(result)
  }

  @Post(':id/sync-payment')
  @ApiOperation({
    summary: 'Sync the booking-group payments with Stripe',
    description:
      'Frontend calls this immediately after `stripe.confirmPayment` resolves so the ' +
      'Payment row state advances from `requires_payment_method` → `requires_capture` ' +
      '(or further) without depending on the Stripe webhook arriving. Idempotent: runs ' +
      'the same handler logic that webhooks invoke.',
  })
  async syncPayment(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.bookingGroupsService.syncPaymentForParent(user.id, id)
    return ResponseUtil.success(result)
  }

  @Post(':id/addons')
  @ApiOperation({ summary: 'Save selected add-ons for each booking' })
  async saveAddOns(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SaveBookingGroupAddOnsDto
  ) {
    const result = await this.bookingGroupsService.saveAddOnsForParent({
      userId: user.id,
      bookingGroupId: id,
      addOns: dto.addOns,
      specialRequest: dto.specialRequest,
    })
    return ResponseUtil.success(result)
  }

  @Post(':id/draft')
  @ApiOperation({ summary: 'Update draft booking group session/children selections' })
  async updateDraft(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateDraftBookingGroupDto
  ) {
    const result = await this.bookingGroupsService.updateDraftForParent({
      userId: user.id,
      bookingGroupId: id,
      sessionId: dto.sessionId,
      childIds: dto.childIds,
    })
    return ResponseUtil.success(result)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a draft booking group' })
  async deleteDraft(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.bookingGroupsService.deleteDraftForParent(user.id, id)
    return ResponseUtil.success(result)
  }

  @Get(':id/refund-preview')
  @ApiOperation({
    summary: 'Preview the refund the parent would receive if they cancelled right now (read-only).',
  })
  async refundPreview(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query() query: CancelBookingGroupDto
  ) {
    const result = await this.bookingGroupsService.previewParentCancel(user.id, id, {
      circumstance: query.circumstance ?? null,
    })
    return ResponseUtil.success(result)
  }

  @Get(':id/reschedule/pending')
  @ApiOperation({
    summary: 'The pending provider reschedule proposal + a preview of the recomputed schedule.',
  })
  async pendingReschedule(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.bookingGroupsService.getPendingReschedule(id, user.id)
    return ResponseUtil.success(result)
  }

  @Post(':id/reschedule/consent')
  @ApiOperation({
    summary: 'Consent to a provider reschedule — recomputes the capture schedule + re-snapshots.',
  })
  async consentReschedule(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RescheduleConsentDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    const result = await this.bookingGroupsService.consentReschedule(id, user.id, {
      proposalId: dto.proposalId,
      policyTextShown: dto.policyTextShown ?? null,
      schemaVersion: dto.schemaVersion ?? 1,
      ipAddress: ip ?? null,
      userAgent: userAgent ?? null,
    })
    return ResponseUtil.success(result)
  }

  @Post(':id/reschedule/decline')
  @ApiOperation({ summary: 'Decline a provider reschedule — the original dates stand.' })
  async declineReschedule(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RescheduleDeclineDto
  ) {
    const result = await this.bookingGroupsService.declineReschedule(id, user.id, dto.proposalId)
    return ResponseUtil.success(result)
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary:
      'Cancel a booking. Routes server-side to grace / policy / void-auth based on live state.',
  })
  async cancel(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CancelBookingGroupDto
  ) {
    const result = await this.bookingGroupsService.cancelForParent(user.id, id, {
      circumstance: dto.circumstance ?? null,
    })
    return ResponseUtil.success(result)
  }
}
