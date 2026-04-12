import {
  BadRequestException,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SuperAdminSessionsService } from './sessions.service'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

@ApiTags('SuperAdmin Sessions')
@ApiBearerAuth()
@Controller('superadmin/providers/:providerId/camps/:campId/sessions')
@UseGuards(RolesOrPermissionsGuard)
export class SuperAdminSessionsController {
  constructor(private readonly sessionsService: SuperAdminSessionsService) {}

  @Post('import')
  @Permissions('providers.update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import sessions for a camp from CSV',
    description:
      'Upload a CSV file to create multiple draft sessions for the given camp. Max 50 sessions (per-camp limit), 5 MB.',
  })
  async importSessions(
    @Param('providerId') providerId: string,
    @Param('campId') campId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded')
    }

    const isCsv =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv')

    if (!isCsv) {
      throw new BadRequestException('Only CSV files are accepted')
    }

    const maxBytes = 5 * 1024 * 1024 // 5 MB
    if (file.size > maxBytes) {
      throw new BadRequestException('File size exceeds the 5 MB limit')
    }

    const result = await this.sessionsService.importFromCsv(file.buffer, campId, providerId)
    return ResponseUtil.success(result)
  }
}
