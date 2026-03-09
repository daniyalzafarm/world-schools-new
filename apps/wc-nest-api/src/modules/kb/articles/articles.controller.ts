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
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ArticlesService } from './services/articles.service'
import { ArticleActionsService } from './services/article-actions.service'
import { ArticleFeedbackService } from './services/article-feedback.service'
import { ArticleRelationsService } from './services/article-relations.service'
import { CreateArticleDto } from './dto/create-article.dto'
import { UpdateArticleDto } from './dto/update-article.dto'
import { QueryArticlesDto } from './dto/query-articles.dto'
import { SubmitFeedbackDto } from './dto/submit-feedback.dto'
import { AddRelatedArticleDto } from './dto/add-related-article.dto'
import { ReorderRelatedArticlesDto } from './dto/reorder-related-articles.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { Public } from '../../core/auth/decorators/public.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { Request } from 'express'
import { Audience } from 'apps/wc-nest-api/src/generated/client/enums'

@ApiTags('Knowledge Base - Articles (Admin)')
@Controller('superadmin/kb/articles')
@UseGuards(RolesOrPermissionsGuard)
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly actionsService: ArticleActionsService,
    private readonly relationsService: ArticleRelationsService
  ) {}

  @Post()
  @Permissions('kb.articles.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new article' })
  async create(@Body() createArticleDto: CreateArticleDto, @CurrentUser() user: any) {
    const article = await this.articlesService.create(createArticleDto, user)
    return ResponseUtil.success(article)
  }

  @Get()
  @Permissions('kb.articles.read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all articles with filters' })
  async findAll(@Query() query: QueryArticlesDto) {
    const result = await this.articlesService.findAll(query)
    return ResponseUtil.success(result.data, result.meta)
  }

  @Get('stats')
  @Permissions('kb.articles.read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get global article stats' })
  async getStats() {
    const stats = await this.articlesService.getGlobalStats()
    return ResponseUtil.success(stats)
  }

  @Get('check-slug/:slug')
  @Permissions('kb.articles.create', 'kb.articles.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if slug is available' })
  async checkSlug(@Param('slug') slug: string, @Query('articleId') articleId?: string) {
    const result = await this.actionsService.checkSlugAvailability(slug, articleId)
    return ResponseUtil.success(result)
  }

  @Get(':id')
  @Permissions('kb.articles.read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get article by ID' })
  async findOne(@Param('id') id: string) {
    const article = await this.articlesService.findOne(id)
    return ResponseUtil.success(article)
  }

  @Patch(':id')
  @Permissions('kb.articles.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an article' })
  async update(@Param('id') id: string, @Body() updateArticleDto: UpdateArticleDto) {
    const article = await this.articlesService.update(id, updateArticleDto)
    return ResponseUtil.success(article)
  }

  @Delete(':id')
  @Permissions('kb.articles.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an article' })
  async remove(@Param('id') id: string) {
    await this.articlesService.remove(id)
    return ResponseUtil.success({ message: 'Article deleted successfully' })
  }

  @Post(':id/publish')
  @Permissions('kb.articles.publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish an article' })
  async publish(@Param('id') id: string) {
    const article = await this.actionsService.publish(id)
    return ResponseUtil.success(article)
  }

  @Post(':id/unpublish')
  @Permissions('kb.articles.publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish an article' })
  async unpublish(@Param('id') id: string) {
    const article = await this.actionsService.unpublish(id)
    return ResponseUtil.success(article)
  }

  @Post(':id/duplicate')
  @Permissions('kb.articles.duplicate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Duplicate an article' })
  async duplicate(@Param('id') id: string) {
    const article = await this.actionsService.duplicate(id)
    return ResponseUtil.success(article)
  }

  @Get(':id/related')
  @Permissions('kb.articles.read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get related articles' })
  async getRelatedArticles(@Param('id') id: string) {
    const relatedArticles = await this.relationsService.getRelatedArticles(id)
    return ResponseUtil.success(relatedArticles)
  }

  @Post(':id/related')
  @Permissions('kb.articles.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a related article' })
  async addRelatedArticle(@Param('id') id: string, @Body() dto: AddRelatedArticleDto) {
    const relation = await this.relationsService.addRelatedArticle(id, dto)
    return ResponseUtil.success(relation)
  }

  @Delete(':id/related/:relatedId')
  @Permissions('kb.articles.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a related article' })
  async removeRelatedArticle(@Param('id') id: string, @Param('relatedId') relatedId: string) {
    await this.relationsService.removeRelatedArticle(id, relatedId)
    return ResponseUtil.success({ message: 'Related article removed successfully' })
  }

  @Patch(':id/related/reorder')
  @Permissions('kb.articles.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder related articles' })
  async reorderRelatedArticles(@Param('id') id: string, @Body() dto: ReorderRelatedArticlesDto) {
    const result = await this.relationsService.reorderRelatedArticles(id, dto)
    return ResponseUtil.success(result)
  }
}

/** Maps URL context (user | provider | staff) to KB Audience. Reusable for any route that needs audience from path. */
const CONTEXT_TO_AUDIENCE: Record<string, Audience[]> = {
  user: ['parents'],
  provider: ['providers'],
  staff: ['staff'],
}

function getAudienceFromContext(context: string): Audience[] {
  const audience = CONTEXT_TO_AUDIENCE[context]
  if (!audience) {
    throw new BadRequestException(`Invalid context "${context}". Use one of: user, provider, staff`)
  }
  return audience
}

// Public Controller
@ApiTags('Knowledge Base - Articles (Public)')
@Controller('kb/articles')
export class PublicArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly feedbackService: ArticleFeedbackService,
    private readonly relationsService: ArticleRelationsService
  ) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all published articles (public)' })
  async findAllPublic(@Query() query: QueryArticlesDto) {
    // Force status to published for public access
    const publicQuery = { ...query, status: 'published' as const }
    const result = await this.articlesService.findAll(publicQuery)
    return ResponseUtil.success(result.data, result.meta)
  }

  @Get(':context/popular')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get popular articles by app (audience from URL)',
    description: 'kb/articles/user/popular → parents, provider → providers, staff → staff',
  })
  async findPopularPublicByContext(
    @Param('context') context: string,
    @Query('limit') limit?: number
  ) {
    const audience = getAudienceFromContext(context)
    const safeLimit = Math.min(Math.max(1, Number(limit) || 8), 20)
    const articles = await this.articlesService.findPopularPublic(safeLimit, audience)
    return ResponseUtil.success(articles)
  }

  @Get(':slug')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get article by slug (public)' })
  async findBySlug(@Param('slug') slug: string, @Req() req: Request) {
    const article = await this.articlesService.findBySlug(slug)
    const viewerKey = req.ip || req.socket?.remoteAddress
    await this.articlesService.incrementArticleViews(article.id, viewerKey)
    return ResponseUtil.success(article)
  }

  @Get(':slug/related')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get related articles (public)' })
  async getRelatedArticlesPublic(@Param('slug') slug: string) {
    // First get the article by slug
    const article = await this.articlesService.findBySlug(slug)
    // Then get related articles (published only)
    const relatedArticles = await this.relationsService.getRelatedArticles(article.id, true)
    return ResponseUtil.success(relatedArticles)
  }

  @Post(':id/helpful')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit helpful/not helpful feedback' })
  async submitFeedback(
    @Param('id') id: string,
    @Body() dto: SubmitFeedbackDto,
    @Req() req: Request
  ) {
    // Extract user info from request if authenticated
    const userId = (req as any).user?.id
    const ipAddress = req.ip || req.socket.remoteAddress
    const userAgent = req.headers['user-agent']

    const result = await this.feedbackService.submitFeedback(id, dto, userId, ipAddress, userAgent)
    return ResponseUtil.success(result)
  }

  @Get(':id/feedback-status')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if user has already voted' })
  async checkFeedbackStatus(
    @Param('id') id: string,
    @Query('sessionId') sessionId: string,
    @Req() req: Request
  ) {
    const userId = (req as any).user?.id
    const result = await this.feedbackService.checkFeedbackStatus(id, userId, sessionId)
    return ResponseUtil.success(result)
  }
}
