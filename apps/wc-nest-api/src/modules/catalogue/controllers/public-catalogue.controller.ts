import { Controller, Get, Query } from '@nestjs/common'
import { CatalogueService } from '../services/catalogue.service'
import { ActivityCategoryStatus } from '../../../generated/client/enums'
import { Public } from '../../core/auth/decorators/public.decorator'

@Controller('catalogue')
@Public()
export class PublicCatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Get('categories')
  async getCategories(
    @Query('status') status?: ActivityCategoryStatus | 'active',
    @Query('surface') surface?: 'parentInterests' | 'campFocus' | 'campInterests'
  ) {
    // Default to ACTIVE when status not provided or "active" string
    const effectiveStatus = !status || status === 'active' ? ActivityCategoryStatus.ACTIVE : status

    return this.catalogueService.getPublicCategories({
      status: effectiveStatus,
      surface,
    })
  }

  @Get('activities')
  async getActivities(
    @Query('hasScale') hasScale?: string,
    @Query('surface') surface?: 'parentInterests' | 'campFocus' | 'campInterests'
  ) {
    return this.catalogueService.getPublicActivities({
      hasScale: hasScale === 'true',
      surface,
    })
  }

  @Get('scales')
  async getScales() {
    return this.catalogueService.getPublicScales()
  }
}
