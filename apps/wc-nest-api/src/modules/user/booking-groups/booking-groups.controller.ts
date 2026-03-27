import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from '../../../common/utils/response.util'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { BookingGroupsService } from '../../booking-groups/booking-groups.service'
import { CreateDraftBookingGroupDto } from './dto/create-draft-booking-group.dto'
import { SaveBookingGroupAddOnsDto } from './dto/save-booking-group-addons.dto'
import { UpdateDraftBookingGroupDto } from './dto/update-draft-booking-group.dto'

@ApiTags('User Booking Groups')
@ApiBearerAuth()
@Controller('user/booking-groups')
@UseGuards(RolesOrPermissionsGuard)
@Roles('Parent')
export class UserBookingGroupsController {
  constructor(private readonly bookingGroupsService: BookingGroupsService) {}

  @Post('draft')
  @ApiOperation({ summary: 'Create draft booking group' })
  async createDraft(@CurrentUser() user: any, @Body() dto: CreateDraftBookingGroupDto) {
    const result = await this.bookingGroupsService.createDraftForParent({
      userId: user.id,
      campId: dto.campId,
      sessionId: dto.sessionId,
      childIds: dto.childIds,
      specialRequest: dto.specialRequest,
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

  @Get(':id')
  @ApiOperation({ summary: 'Get booking group details' })
  async getById(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.bookingGroupsService.getForParent(user.id, id)
    return ResponseUtil.success(result)
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit draft booking group as request' })
  async submit(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.bookingGroupsService.submitForParent(user.id, id)
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
}
