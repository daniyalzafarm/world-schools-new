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
import { SuperAdminCampsService } from './camps.service'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

@ApiTags('SuperAdmin Camps')
@ApiBearerAuth()
@Controller('superadmin/providers/:providerId/camps')
@UseGuards(RolesOrPermissionsGuard)
export class SuperAdminCampsController {
  constructor(private readonly campsService: SuperAdminCampsService) {}

  @Post('import')
  @Permissions('providers.update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import camps for a provider from CSV',
    description:
      'Upload a CSV file to create multiple draft camps for the given provider. Sessions are not created; providers complete the rest of the profile via the portal. Max 500 camps, 5 MB.',
  })
  async importCamps(
    @Param('providerId') providerId: string,
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

    const result = await this.campsService.importFromCsv(file.buffer, providerId)
    return ResponseUtil.success(result)
  }
}
