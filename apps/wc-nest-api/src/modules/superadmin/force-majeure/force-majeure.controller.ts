import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from '../../../common/utils/response.util'
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../core/auth/decorators/current-user.decorator'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { ForceMajeureExecuteDto, ForceMajeurePreviewDto } from './dto/force-majeure.dto'
import { ForceMajeureService } from './force-majeure.service'

/**
 * Force Majeure bulk tool (Payments revamp, Spec v2.3 §8). `preview` counts the
 * affected bookings (dry run); `execute` cancels them all with a FM cash refund
 * and records a force-majeure event. Both are gated behind `billing.write`.
 */
@ApiTags('SuperAdmin Force Majeure')
@ApiBearerAuth()
@Controller('superadmin/force-majeure')
@UseGuards(RolesOrPermissionsGuard)
export class ForceMajeureController {
  constructor(private readonly forceMajeureService: ForceMajeureService) {}

  @Post('preview')
  @Permissions('billing.write')
  @ApiOperation({ summary: 'Count the bookings a force-majeure scope would cancel (dry run).' })
  async preview(@Body() dto: ForceMajeurePreviewDto) {
    const result = await this.forceMajeureService.preview({
      dateFrom: new Date(dto.dateFrom),
      dateTo: new Date(dto.dateTo),
      providerId: dto.providerId,
      region: dto.region,
    })
    return ResponseUtil.success(result)
  }

  @Post('execute')
  @Permissions('billing.write')
  @ApiOperation({
    summary: 'Cancel all matching bookings with a force-majeure cash refund (captured minus fee).',
  })
  async execute(@CurrentUser() user: CurrentUserPayload, @Body() dto: ForceMajeureExecuteDto) {
    const result = await this.forceMajeureService.execute(user.id, dto.description, {
      dateFrom: new Date(dto.dateFrom),
      dateTo: new Date(dto.dateTo),
      providerId: dto.providerId,
      region: dto.region,
    })
    return ResponseUtil.success(result)
  }
}
