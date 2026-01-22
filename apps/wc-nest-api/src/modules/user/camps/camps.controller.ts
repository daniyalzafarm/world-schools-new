import { Controller, Get, HttpCode, HttpStatus, Param, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../core/auth/decorators/public.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { UserCampsService } from './camps.service'

@ApiTags('User Camps')
@Controller('user/camps')
export class UserCampsController {
  constructor(private readonly campsService: UserCampsService) {}

  /**
   * Get all published camps (public endpoint)
   */
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all published camps',
    description: 'Retrieve all published camps for public viewing',
  })
  async getPublishedCamps() {
    const camps = await this.campsService.getPublishedCamps()
    return ResponseUtil.success({ camps })
  }

  /**
   * Get camp by slug (public endpoint)
   * Supports optional preview token for providers to view unpublished camps
   */
  @Public()
  @Get('slug/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get camp by slug',
    description:
      'Retrieve a published camp by its slug for public viewing. Supports preview mode with token.',
  })
  async getCampBySlug(@Param('slug') slug: string, @Query('preview') previewToken?: string) {
    const camp = await this.campsService.getCampBySlug(slug, previewToken)
    return ResponseUtil.success({ camp })
  }
}
