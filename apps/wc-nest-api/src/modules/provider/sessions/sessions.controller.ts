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
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SessionsService } from './sessions.service'
import { CreateFlexibleSessionDto } from './dto/create-flexible-session.dto'
import { CreateFixedSessionDto } from './dto/create-fixed-session.dto'
import { UpdateFlexibleSessionDto } from './dto/update-flexible-session.dto'
import { UpdateFixedSessionDto } from './dto/update-fixed-session.dto'
import { UpdateSessionTypeDto } from './dto/update-session-type.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'

@ApiTags('Provider Sessions')
@ApiBearerAuth()
@Controller('provider/camps/:campId/sessions')
@UseGuards(RolesOrPermissionsGuard)
@Permissions('camps.manage')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * Get session type for a camp
   */
  @Get('type')
  @ApiOperation({ summary: 'Get session type for a camp' })
  @ApiResponse({ status: 200, description: 'Session type retrieved successfully' })
  async getSessionType(@Param('campId') campId: string, @CurrentUser() user: any) {
    return this.sessionsService.getSessionType(campId, user.providerId)
  }

  /**
   * Set session type for a camp
   */
  @Put('type')
  @ApiOperation({ summary: 'Set session type for a camp' })
  @ApiResponse({ status: 200, description: 'Session type updated successfully' })
  async setSessionType(
    @Param('campId') campId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateSessionTypeDto
  ) {
    return this.sessionsService.setSessionType(campId, user.providerId, dto)
  }

  /**
   * Get all flexible sessions
   */
  @Get('flexible')
  @ApiOperation({ summary: 'Get all flexible sessions for a camp' })
  @ApiResponse({ status: 200, description: 'Flexible sessions retrieved successfully' })
  async getFlexibleSessions(@Param('campId') campId: string, @CurrentUser() user: any) {
    return this.sessionsService.getFlexibleSessions(campId, user.providerId)
  }

  /**
   * Get all fixed sessions
   */
  @Get('fixed')
  @ApiOperation({ summary: 'Get all fixed sessions for a camp' })
  @ApiResponse({ status: 200, description: 'Fixed sessions retrieved successfully' })
  async getFixedSessions(@Param('campId') campId: string, @CurrentUser() user: any) {
    return this.sessionsService.getFixedSessions(campId, user.providerId)
  }

  /**
   * Create a flexible session
   */
  @Post('flexible')
  @ApiOperation({ summary: 'Create a flexible session' })
  @ApiResponse({ status: 201, description: 'Flexible session created successfully' })
  async createFlexibleSession(
    @Param('campId') campId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateFlexibleSessionDto
  ) {
    return this.sessionsService.createFlexibleSession(campId, user.providerId, dto)
  }

  /**
   * Create a fixed session
   */
  @Post('fixed')
  @ApiOperation({ summary: 'Create a fixed session' })
  @ApiResponse({ status: 201, description: 'Fixed session created successfully' })
  async createFixedSession(
    @Param('campId') campId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateFixedSessionDto
  ) {
    return this.sessionsService.createFixedSession(campId, user.providerId, dto)
  }

  /**
   * Update a flexible session
   */
  @Put('flexible/:sessionId')
  @ApiOperation({ summary: 'Update a flexible session' })
  @ApiResponse({ status: 200, description: 'Flexible session updated successfully' })
  async updateFlexibleSession(
    @Param('campId') campId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateFlexibleSessionDto
  ) {
    return this.sessionsService.updateFlexibleSession(campId, sessionId, user.providerId, dto)
  }

  /**
   * Update a fixed session
   */
  @Put('fixed/:sessionId')
  @ApiOperation({ summary: 'Update a fixed session' })
  @ApiResponse({ status: 200, description: 'Fixed session updated successfully' })
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
   * Duplicate a fixed session
   */
  @Post('fixed/:sessionId/duplicate')
  @ApiOperation({ summary: 'Duplicate a fixed session' })
  @ApiResponse({ status: 201, description: 'Session duplicated successfully' })
  async duplicateFixedSession(
    @Param('campId') campId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any
  ) {
    return this.sessionsService.duplicateFixedSession(campId, sessionId, user.providerId)
  }
}
