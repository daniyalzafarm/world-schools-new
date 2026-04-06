import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { Public } from '../../core/auth/decorators/public.decorator'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { ResponseUtil } from '../../../common/utils/response.util'
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto'
import { SyncCampWishlistsDto } from './dto/sync-camp-wishlists.dto'
import { CreateWishlistDto } from './dto/create-wishlist.dto'
import { ShareWishlistDto } from './dto/share-wishlist.dto'
import { ToggleLinkSharingDto } from './dto/toggle-link-sharing.dto'
import { UpdateShareRoleDto } from './dto/update-share-role.dto'
import { UpdateWishlistDto } from './dto/update-wishlist.dto'
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto'
import { UserWishlistsService } from './wishlists.service'

@ApiTags('User Wishlists')
@ApiBearerAuth()
@Controller('user/wishlists')
@UseGuards(RolesOrPermissionsGuard)
@Roles('Parent')
export class UserWishlistsController {
  constructor(private readonly wishlistsService: UserWishlistsService) {}

  // ============================================
  // Static routes first (must be before :id)
  // ============================================

  @Get('shared')
  @ApiOperation({
    summary: 'Get wishlists shared with me',
    description: 'Retrieve all wishlists shared with you via email',
  })
  async findSharedWithMe(@CurrentUser() user: any) {
    const data = await this.wishlistsService.findSharedWithMe(user.id)
    return ResponseUtil.success(data)
  }

  @Public()
  @Get('shared/:token')
  @ApiOperation({
    summary: 'View a wishlist by share token',
    description: 'Public endpoint — view a wishlist shared via link (no auth required)',
  })
  async findByShareToken(@Param('token') token: string) {
    const data = await this.wishlistsService.findByShareToken(token)
    return ResponseUtil.success(data)
  }

  // ============================================
  // My Wishlists
  // ============================================

  @Get()
  @ApiOperation({ summary: 'Get all my wishlists' })
  async findAll(@CurrentUser() user: any) {
    const data = await this.wishlistsService.findAll(user.id)
    return ResponseUtil.success(data)
  }

  @Post()
  @ApiOperation({ summary: 'Create a new wishlist' })
  async create(@CurrentUser() user: any, @Body() dto: CreateWishlistDto) {
    const data = await this.wishlistsService.create(user.id, dto)
    return ResponseUtil.success(data)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a wishlist by ID (with full item details)' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.wishlistsService.findOne(user.id, id)
    return ResponseUtil.success(data)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update wishlist name, icon, or children' })
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateWishlistDto) {
    const data = await this.wishlistsService.update(user.id, id, dto)
    return ResponseUtil.success(data)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a wishlist' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.wishlistsService.remove(user.id, id)
    return ResponseUtil.success(result)
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a wishlist with all its items and children' })
  async duplicate(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.wishlistsService.duplicate(user.id, id)
    return ResponseUtil.success(data)
  }

  // ============================================
  // Wishlist Items
  // ============================================

  @Post('items/sync')
  @ApiOperation({ summary: 'Sync a camp across wishlists — adds/removes based on desired list' })
  async syncCampWishlists(@CurrentUser() user: any, @Body() dto: SyncCampWishlistsDto) {
    const data = await this.wishlistsService.syncCampWishlists(user.id, dto)
    return ResponseUtil.success(data)
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add a camp to a wishlist' })
  async addItem(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: AddWishlistItemDto
  ) {
    const data = await this.wishlistsService.addItem(user.id, id, dto)
    return ResponseUtil.success(data)
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Update the selected session for a wishlist item' })
  async updateItem(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateWishlistItemDto
  ) {
    const data = await this.wishlistsService.updateItem(user.id, id, itemId, dto)
    return ResponseUtil.success(data)
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove a camp from a wishlist' })
  async removeItem(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string
  ) {
    const result = await this.wishlistsService.removeItem(user.id, id, itemId)
    return ResponseUtil.success(result)
  }

  // ============================================
  // Sharing
  // ============================================

  @Post(':id/shares')
  @ApiOperation({ summary: 'Share a wishlist with someone by email' })
  async addShare(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ShareWishlistDto) {
    const data = await this.wishlistsService.addShare(user.id, id, dto)
    return ResponseUtil.success(data)
  }

  @Patch(':id/shares/:shareId')
  @ApiOperation({ summary: 'Update the role of a share' })
  async updateShareRole(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('shareId') shareId: string,
    @Body() dto: UpdateShareRoleDto
  ) {
    const data = await this.wishlistsService.updateShareRole(user.id, id, shareId, dto)
    return ResponseUtil.success(data)
  }

  @Delete(':id/shares/:shareId')
  @ApiOperation({ summary: 'Remove a share' })
  async removeShare(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('shareId') shareId: string
  ) {
    const result = await this.wishlistsService.removeShare(user.id, id, shareId)
    return ResponseUtil.success(result)
  }

  @Patch(':id/link-sharing')
  @ApiOperation({ summary: 'Enable or disable link sharing for a wishlist' })
  async toggleLinkSharing(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ToggleLinkSharingDto
  ) {
    const data = await this.wishlistsService.toggleLinkSharing(user.id, id, dto)
    return ResponseUtil.success(data)
  }
}
