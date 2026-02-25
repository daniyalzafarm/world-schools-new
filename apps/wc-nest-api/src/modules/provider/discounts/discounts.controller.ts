import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { DiscountsService } from './discounts.service'
import {
  AddDiscountEntryDto,
  CreateGlobalDiscountDto,
  UpdateDiscountEntryDto,
  UpdateGlobalDiscountDto,
} from './dto/global-discount.dto'

@ApiTags('Provider Discounts')
@ApiBearerAuth()
@Controller('provider/camps/:campId/discounts')
@UseGuards(RolesOrPermissionsGuard)
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  /**
   * GET /provider/camps/:campId/discounts
   * Get all global discounts for a camp
   */
  @Get()
  @Permissions('camps.read')
  @ApiOperation({ summary: 'Get all global discounts for a camp' })
  @ApiResponse({ status: 200, description: 'Global discounts retrieved successfully' })
  async getGlobalDiscounts(@Param('campId') campId: string, @CurrentUser() user: any) {
    return this.discountsService.getGlobalDiscounts(campId, user.providerId)
  }

  /**
   * POST /provider/camps/:campId/discounts
   * Create a new global discount (lazy creation)
   * Creates discount with empty entries array - entries added via separate API
   */
  @Post()
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Create a new global discount' })
  @ApiResponse({ status: 201, description: 'Global discount created successfully' })
  async createGlobalDiscount(
    @Param('campId') campId: string,
    @Body() dto: CreateGlobalDiscountDto,
    @CurrentUser() user: any
  ) {
    return this.discountsService.createGlobalDiscount(
      campId,
      user.providerId,
      dto.category,
      dto.sortOrder
    )
  }

  /**
   * PUT /provider/camps/:campId/discounts/:discountId
   * Update a global discount (category level - entries array or isEnabled)
   */
  @Put(':discountId')
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Update a global discount' })
  @ApiResponse({ status: 200, description: 'Global discount updated successfully' })
  async updateGlobalDiscount(
    @Param('campId') campId: string,
    @Param('discountId') discountId: string,
    @Body() dto: UpdateGlobalDiscountDto,
    @CurrentUser() user: any
  ) {
    return this.discountsService.updateGlobalDiscount(discountId, campId, user.providerId, dto)
  }

  /**
   * POST /provider/camps/:campId/discounts/:discountId/entries
   * Add a new entry to a discount category
   */
  @Post(':discountId/entries')
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Add a new entry to a discount category' })
  @ApiResponse({ status: 201, description: 'Discount entry added successfully' })
  async addDiscountEntry(
    @Param('campId') campId: string,
    @Param('discountId') discountId: string,
    @Body() dto: AddDiscountEntryDto,
    @CurrentUser() user: any
  ) {
    return this.discountsService.addDiscountEntry(discountId, campId, user.providerId, dto)
  }

  /**
   * PUT /provider/camps/:campId/discounts/:discountId/entries/:entryId
   * Update an existing entry in a discount category
   */
  @Put(':discountId/entries/:entryId')
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Update an existing discount entry' })
  @ApiResponse({ status: 200, description: 'Discount entry updated successfully' })
  async updateDiscountEntry(
    @Param('campId') campId: string,
    @Param('discountId') discountId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateDiscountEntryDto,
    @CurrentUser() user: any
  ) {
    return this.discountsService.updateDiscountEntry(
      discountId,
      entryId,
      campId,
      user.providerId,
      dto
    )
  }

  /**
   * DELETE /provider/camps/:campId/discounts/:discountId/entries/:entryId
   * Remove an entry from a discount category
   */
  @Delete(':discountId/entries/:entryId')
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Remove a discount entry' })
  @ApiResponse({ status: 200, description: 'Discount entry removed successfully' })
  async removeDiscountEntry(
    @Param('campId') campId: string,
    @Param('discountId') discountId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: any
  ) {
    return this.discountsService.removeDiscountEntry(discountId, entryId, campId, user.providerId)
  }
}
