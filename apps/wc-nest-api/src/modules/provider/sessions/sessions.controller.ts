import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SessionsService } from './sessions.service'
import { CreateFixedSessionDto } from './dto/create-fixed-session.dto'
import { UpdateFixedSessionDto } from './dto/update-fixed-session.dto'
import {
  AddSessionDiscountDto,
  ApplyGlobalDiscountDto,
  RemoveGlobalDiscountDto,
} from './dto/session-discount.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'

@ApiTags('Provider Sessions')
@ApiBearerAuth()
@Controller('provider/camps/:campId/sessions')
@UseGuards(RolesOrPermissionsGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * Get all sessions
   */
  @Get()
  @Permissions('camps.read')
  @ApiOperation({ summary: 'Get all sessions for a camp' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  async getFixedSessions(
    @Param('campId') campId: string,
    @Query('sortBy') sortBy: string | undefined,
    @CurrentUser() user: any
  ) {
    return this.sessionsService.getFixedSessions(campId, user.providerId, sortBy)
  }

  /**
   * Create a session
   */
  @Post()
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Create a session' })
  @ApiResponse({ status: 201, description: 'Session created successfully' })
  async createFixedSession(
    @Param('campId') campId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateFixedSessionDto
  ) {
    return this.sessionsService.createFixedSession(campId, user.providerId, dto)
  }

  /**
   * Update a session
   */
  @Put(':sessionId')
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Update a session' })
  @ApiResponse({ status: 200, description: 'Session updated successfully' })
  async updateFixedSession(
    @Param('campId') campId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateFixedSessionDto
  ) {
    return this.sessionsService.updateFixedSession(campId, sessionId, user.providerId, dto)
  }

  /**
   * Delete a session
   */
  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Delete a session' })
  @ApiResponse({ status: 200, description: 'Session deleted successfully' })
  async deleteSession(
    @Param('campId') campId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any
  ) {
    return this.sessionsService.deleteSession(campId, sessionId, user.providerId)
  }

  /**
   * Toggle session active status
   */
  @Patch(':sessionId/toggle')
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Toggle session active status' })
  @ApiResponse({ status: 200, description: 'Session status toggled successfully' })
  async toggleSessionStatus(
    @Param('campId') campId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any
  ) {
    return this.sessionsService.toggleSessionStatus(campId, sessionId, user.providerId)
  }

  /**
   * Duplicate a session
   */
  @Post(':sessionId/duplicate')
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Duplicate a session' })
  @ApiResponse({ status: 201, description: 'Session duplicated successfully' })
  async duplicateFixedSession(
    @Param('campId') campId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any
  ) {
    return this.sessionsService.duplicateFixedSession(campId, sessionId, user.providerId)
  }

  /**
   * Add a session-specific discount
   */
  @Post(':sessionId/discounts')
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Add a session-specific discount' })
  @ApiResponse({ status: 201, description: 'Session discount added successfully' })
  async addSessionDiscount(
    @Param('campId') campId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: AddSessionDiscountDto,
    @CurrentUser() user: any
  ) {
    return this.sessionsService.addSessionDiscount(sessionId, campId, user.providerId, dto)
  }

  /**
   * Remove a session-specific discount
   */
  @Delete(':sessionId/discounts/:discountId')
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Remove a session-specific discount' })
  @ApiResponse({ status: 200, description: 'Session discount removed successfully' })
  async removeSessionDiscount(
    @Param('campId') campId: string,
    @Param('sessionId') sessionId: string,
    @Param('discountId') discountId: string,
    @CurrentUser() user: any
  ) {
    return this.sessionsService.removeSessionDiscount(
      sessionId,
      campId,
      user.providerId,
      discountId
    )
  }

  /**
   * Remove a global discount from this session only
   */
  @Post(':sessionId/discounts/remove-global')
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Remove a global discount from this session' })
  @ApiResponse({ status: 200, description: 'Global discount removed from session successfully' })
  async removeGlobalDiscountFromSession(
    @Param('campId') campId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: RemoveGlobalDiscountDto,
    @CurrentUser() user: any
  ) {
    return this.sessionsService.removeGlobalDiscountFromSession(
      sessionId,
      campId,
      user.providerId,
      dto.globalDiscountId
    )
  }

  /**
   * Re-apply a previously removed global discount to this session
   */
  @Post(':sessionId/discounts/apply-global')
  @Permissions('camps.update')
  @ApiOperation({ summary: 'Re-apply a global discount to this session' })
  @ApiResponse({ status: 200, description: 'Global discount applied to session successfully' })
  async applyGlobalDiscountToSession(
    @Param('campId') campId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: ApplyGlobalDiscountDto,
    @CurrentUser() user: any
  ) {
    return this.sessionsService.applyGlobalDiscountToSession(
      sessionId,
      campId,
      user.providerId,
      dto.globalDiscountId
    )
  }
}
