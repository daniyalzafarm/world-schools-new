import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from '../../../common/utils/response.util'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { BookingGroupsService } from '../../booking-groups/booking-groups.service'
import { PatchProviderBookingGroupDto } from './dto/patch-provider-booking-group.dto'
import { QueryProviderBookingGroupsDto } from './dto/query-provider-booking-groups.dto'
import { RespondBookingGroupDto } from './dto/respond-booking-group.dto'

@ApiTags('Provider Booking Groups')
@ApiBearerAuth()
@Controller('provider/booking-groups')
@UseGuards(RolesOrPermissionsGuard)
export class ProviderBookingGroupsController {
  constructor(private readonly bookingGroupsService: BookingGroupsService) {}

  @Get()
  @Permissions('bookings.read')
  @ApiOperation({ summary: 'List booking requests for provider (paginated)' })
  async list(@CurrentUser() user: any, @Query() query: QueryProviderBookingGroupsDto) {
    const result = await this.bookingGroupsService.listForProvider(user.providerId, query)
    return ResponseUtil.success(result.data, result.meta)
  }

  @Get(':id')
  @Permissions('bookings.read')
  @ApiOperation({ summary: 'Get booking request details for provider' })
  async getById(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.bookingGroupsService.getForProvider(user.providerId, id)
    return ResponseUtil.success(result)
  }

  @Post(':id/accept')
  @Permissions('bookings.write')
  @ApiOperation({ summary: 'Accept booking request' })
  async accept(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RespondBookingGroupDto
  ) {
    const result = await this.bookingGroupsService.acceptForProvider(
      user.providerId,
      id,
      dto.providerNote
    )
    return ResponseUtil.success(result)
  }

  @Post(':id/decline')
  @Permissions('bookings.write')
  @ApiOperation({ summary: 'Decline booking request' })
  async decline(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RespondBookingGroupDto
  ) {
    const result = await this.bookingGroupsService.declineForProvider(
      user.providerId,
      id,
      dto.providerNote
    )
    return ResponseUtil.success(result)
  }

  @Patch(':id')
  @Permissions('bookings.write')
  @ApiOperation({ summary: 'Update provider-only booking fields (e.g. internal notes)' })
  async patch(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: PatchProviderBookingGroupDto
  ) {
    const result = await this.bookingGroupsService.updateInternalNotesForProvider(
      user.providerId,
      id,
      dto.internalNotes
    )
    return ResponseUtil.success(result)
  }

  @Post(':id/request-extension')
  @Permissions('bookings.write')
  @ApiOperation({ summary: 'Extend request deadline by 24 hours (need more time)' })
  async requestExtension(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.bookingGroupsService.requestExtensionForProvider(user.providerId, id)
    return ResponseUtil.success(result)
  }
}
