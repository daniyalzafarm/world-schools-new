import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ArticleCategoriesService } from './article-categories.service'
import { CreateCategoryDto } from './dto/create-category.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'
import { QueryCategoriesDto } from './dto/query-categories.dto'
import { ReorderCategoryDto } from './dto/reorder-category.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { Public } from '../../core/auth/decorators/public.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

/** Maps URL context (user | provider | staff) to KB audience for category filtering. */
const CONTEXT_TO_AUDIENCE: Record<string, Array<'parents' | 'providers' | 'staff'>> = {
  user: ['parents'],
  provider: ['providers'],
  staff: ['staff'],
}

function getAudienceFromContext(context: string): Array<'parents' | 'providers' | 'staff'> {
  const audience = CONTEXT_TO_AUDIENCE[context]
  if (!audience) {
    throw new BadRequestException(`Invalid context "${context}". Use one of: user, provider, staff`)
  }
  return audience
}

@ApiTags('Knowledge Base - Categories')
@Controller('superadmin/kb/categories')
@UseGuards(RolesOrPermissionsGuard)
export class ArticleCategoriesController {
  constructor(private readonly categoriesService: ArticleCategoriesService) {}

  @Post()
  @Permissions('kb.categories.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new article category' })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    const category = await this.categoriesService.create(createCategoryDto)
    return ResponseUtil.success(category)
  }

  @Get()
  @Permissions('kb.categories.read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all categories with filters' })
  async findAll(@Query() query: QueryCategoriesDto) {
    const result = await this.categoriesService.findAll(query)
    return ResponseUtil.success(result.data, result.meta)
  }

  @Get('check-slug/:slug')
  @Permissions('kb.categories.create', 'kb.categories.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if slug is available' })
  async checkSlug(@Param('slug') slug: string, @Query('categoryId') categoryId?: string) {
    const result = await this.categoriesService.checkSlugAvailability(slug, categoryId)
    return ResponseUtil.success(result)
  }

  @Get(':id')
  @Permissions('kb.categories.read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get category by ID' })
  async findOne(@Param('id') id: string) {
    const category = await this.categoriesService.findOne(id)
    return ResponseUtil.success(category)
  }

  @Patch(':id')
  @Permissions('kb.categories.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a category' })
  async update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    const category = await this.categoriesService.update(id, updateCategoryDto)
    return ResponseUtil.success(category)
  }

  @Patch(':id/reorder')
  @Permissions('kb.categories.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update category sort order' })
  async reorder(@Param('id') id: string, @Body() reorderDto: ReorderCategoryDto) {
    const category = await this.categoriesService.updateSortOrder(id, reorderDto.sortOrder)
    return ResponseUtil.success(category)
  }

  @Delete(':id')
  @Permissions('kb.categories.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a category' })
  async remove(@Param('id') id: string) {
    await this.categoriesService.remove(id)
    return ResponseUtil.success({ message: 'Category deleted successfully' })
  }
}

// Public categories by context: only categories that have published articles for that audience
@ApiTags('Knowledge Base - Public Categories')
@Controller(':context/kb/categories')
export class PublicContextualArticleCategoriesController {
  constructor(private readonly categoriesService: ArticleCategoriesService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get active categories for app (only those with articles for this audience)',
    description:
      'GET user/kb/categories → parents, provider/kb/categories → providers, staff/kb/categories → staff',
  })
  async findAllPublicByContext(@Param('context') context: string) {
    const audience = getAudienceFromContext(context)
    const categories = await this.categoriesService.findAllPublic(audience)
    return ResponseUtil.success(categories)
  }
}
