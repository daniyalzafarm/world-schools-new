import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { CreateArticleDto } from '../dto/create-article.dto'
import { UpdateArticleDto } from '../dto/update-article.dto'
import { QueryArticlesDto } from '../dto/query-articles.dto'
import { Prisma } from '../../../../generated/client/client'
import { validateArticleHtml } from '../utils/html-sanitizer.util'

/** Transaction client type from Prisma $transaction (for syncRelatedArticles). */
type PrismaTxClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0]

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveAuthorName(user?: {
    firstName?: string | null
    lastName?: string | null
    email?: string | null
  }): string {
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()

    if (fullName) {
      return fullName
    }

    if (user?.email) {
      return user.email
    }

    return 'System'
  }

  /** Return trimmed value if non-empty, otherwise undefined. */
  private pickNonEmpty(value?: string | null): string | undefined {
    if (value == null) return undefined
    return value.trim().length > 0 ? value : undefined
  }

  /** Strip HTML tags and collapse whitespace for deriving a plain-text meta description. */
  private stripHtmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Derive SEO fields with fallbacks when incoming values are missing or empty:
   * - metaTitle: incoming → title (truncated to 255)
   * - metaDescription: incoming → summary → stripped contentHtml (truncated to 500)
   */
  private deriveSeoFields(input: {
    title?: string
    summary?: string | null
    contentHtml?: string
    metaTitle?: string
    metaDescription?: string
  }): { metaTitle: string; metaDescription: string } {
    const titleFallback = (input.title ?? '').slice(0, 255)
    const metaTitle = this.pickNonEmpty(input.metaTitle) ?? titleFallback

    const summaryFallback = this.pickNonEmpty(input.summary)
    const contentFallback = input.contentHtml ? this.stripHtmlToText(input.contentHtml) : ''
    const metaDescription =
      this.pickNonEmpty(input.metaDescription) ?? summaryFallback ?? contentFallback

    return {
      metaTitle: metaTitle.slice(0, 255),
      metaDescription: metaDescription.slice(0, 500),
    }
  }

  private hasContentFieldChanges(
    dto: UpdateArticleDto,
    existingArticle: {
      title: string
      slug: string
      articleType: string
      audience: string[]
      categoryId: string
      contentHtml: string
      summary: string | null
      metaTitle: string
      metaDescription: string
    }
  ): boolean {
    if (dto.title !== undefined && dto.title !== existingArticle.title) return true
    if (dto.slug !== undefined && dto.slug !== existingArticle.slug) return true
    if (dto.articleType !== undefined && dto.articleType !== existingArticle.articleType)
      return true
    if (dto.categoryId !== undefined && dto.categoryId !== existingArticle.categoryId) return true
    if (dto.contentHtml !== undefined && dto.contentHtml !== existingArticle.contentHtml)
      return true
    if (dto.summary !== undefined && dto.summary !== existingArticle.summary) return true
    if (dto.metaTitle !== undefined && dto.metaTitle !== existingArticle.metaTitle) return true
    if (
      dto.metaDescription !== undefined &&
      dto.metaDescription !== existingArticle.metaDescription
    )
      return true

    if (dto.audience !== undefined) {
      const incomingAudience = [...dto.audience].sort()
      const currentAudience = [...existingArticle.audience].sort()

      if (
        incomingAudience.length !== currentAudience.length ||
        incomingAudience.some((value, index) => value !== currentAudience[index])
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Validate relatedArticleIds and create ArticleRelation records (sortOrder = index).
   * Throws BadRequestException for self-reference or invalid IDs; NotFoundException if an ID is not an article.
   * When tx is provided, all DB operations use it (for use inside $transaction).
   */
  private async syncRelatedArticles(
    articleId: string,
    relatedArticleIds: string[],
    tx?: PrismaTxClient
  ) {
    const uniqueIds = [...new Set(relatedArticleIds)]
    if (uniqueIds.length === 0) return

    for (const relatedId of uniqueIds) {
      if (relatedId === articleId) {
        throw new BadRequestException('An article cannot be related to itself')
      }
    }

    const client = tx ?? this.prisma
    const existingArticles = await client.article.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    })
    const foundIds = new Set(existingArticles.map(a => a.id))
    const missing = uniqueIds.filter(id => !foundIds.has(id))
    if (missing.length > 0) {
      throw new NotFoundException(`Related article(s) not found: ${missing.join(', ')}`)
    }

    await client.articleRelation.deleteMany({ where: { articleId } })
    await client.articleRelation.createMany({
      data: uniqueIds.map((relatedArticleId, index) => ({
        articleId,
        relatedArticleId,
        sortOrder: index,
      })),
    })
  }

  /**
   * Create a new article
   */
  async create(
    dto: CreateArticleDto,
    currentUser?: { firstName?: string | null; lastName?: string | null; email?: string | null }
  ) {
    // Check if slug already exists
    const existingSlug = await this.prisma.article.findUnique({
      where: { slug: dto.slug },
    })

    if (existingSlug) {
      throw new BadRequestException('This slug is already taken. Please choose a different one.')
    }

    // Check if category exists
    const category = await this.prisma.articleCategory.findUnique({
      where: { id: dto.categoryId },
    })

    if (!category) {
      throw new NotFoundException('Category not found')
    }

    // Validate HTML content (do not modify it)
    const validationResult = validateArticleHtml(dto.contentHtml)
    if (!validationResult.isValid) {
      throw new BadRequestException(
        `HTML validation failed:\n${validationResult.errors.join('\n')}`
      )
    }

    const { relatedArticleIds, ...articleData } = dto
    const seo = this.deriveSeoFields({
      title: articleData.title,
      summary: articleData.summary,
      contentHtml: articleData.contentHtml,
      metaTitle: articleData.metaTitle,
      metaDescription: articleData.metaDescription,
    })
    return await this.prisma.$transaction(async tx => {
      const article = await tx.article.create({
        data: {
          ...articleData,
          metaTitle: seo.metaTitle,
          metaDescription: seo.metaDescription,
          status: articleData.status || 'draft',
          author: this.resolveAuthorName(currentUser),
          lastUpdatedAt: new Date(),
        },
        include: {
          category: true,
        },
      })
      if (relatedArticleIds?.length) {
        await this.syncRelatedArticles(article.id, relatedArticleIds, tx)
      }
      return article
    })
  }

  /** Allowed fields for searchBy (must match Article model) */
  private static readonly SEARCHABLE_FIELDS = ['title', 'summary', 'contentHtml'] as const

  /**
   * Find all articles with filters and pagination
   */
  async findAll(query: QueryArticlesDto) {
    const {
      status,
      audience,
      categoryId,
      articleType,
      search,
      searchBy,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query

    const where: Prisma.ArticleWhereInput = {}

    // Filter by status
    if (status) {
      where.status = status
    }

    // Filter by audience (articles that include any of the specified audiences)
    if (audience && audience.length > 0) {
      where.audience = {
        hasSome: audience,
      }
    }

    // Filter by category
    if (categoryId) {
      where.categoryId = categoryId
    }

    // Filter by article type
    if (articleType) {
      where.articleType = articleType
    }

    // Search: use searchBy if provided, otherwise default to title, summary, contentHtml
    if (search) {
      const allowedLower = ArticlesService.SEARCHABLE_FIELDS.map(f => f.toLowerCase())
      const fields = searchBy
        ? searchBy
            .split(',')
            .map(f => f.trim().toLowerCase())
            .filter(f => allowedLower.includes(f))
        : allowedLower
      const orConditions: Prisma.ArticleWhereInput[] = []
      if (fields.includes('title')) {
        orConditions.push({ title: { contains: search, mode: 'insensitive' } })
      }
      if (fields.includes('summary')) {
        orConditions.push({ summary: { contains: search, mode: 'insensitive' } })
      }
      if (fields.includes('contenthtml')) {
        orConditions.push({ contentHtml: { contains: search, mode: 'insensitive' } })
      }
      if (orConditions.length > 0) {
        where.OR = orConditions
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Build orderBy
    const orderBy: Prisma.ArticleOrderByWithRelationInput = {}
    if (sortBy === 'title') {
      orderBy.title = sortOrder
    } else if (sortBy === 'publishedAt') {
      orderBy.publishedAt = sortOrder
    } else if (sortBy === 'views') {
      orderBy.views = sortOrder
    } else if (sortBy === 'updatedAt') {
      orderBy.updatedAt = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    // Execute query
    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
        },
      }),
      this.prisma.article.count({ where }),
    ])

    return {
      data: articles,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + articles.length < total,
      },
    }
  }

  /**
   * Find one article by ID
   */
  async findOne(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        category: true,
        relatedFrom: {
          include: {
            relatedArticle: {
              select: {
                id: true,
                title: true,
                slug: true,
                summary: true,
                articleType: true,
                status: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!article) {
      throw new NotFoundException('Article not found')
    }

    return article
  }

  /**
   * Find one article by slug (for public access)
   */
  async findBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        relatedFrom: {
          where: {
            relatedArticle: { status: 'published' },
          },
          include: {
            relatedArticle: {
              select: {
                id: true,
                title: true,
                slug: true,
                summary: true,
                articleType: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
          take: 4,
        },
      },
    })

    if (!article) {
      throw new NotFoundException('Article not found')
    }

    // Only return published articles for public access
    if (article.status !== 'published') {
      throw new NotFoundException('Article not found')
    }

    return article
  }

  /**
   * Increment view count for an article. Used only when serving the main article page (GET :slug).
   * Dedupes by viewer key (IP + articleId) within a short window to avoid double-counting from
   * duplicate requests (e.g. React Strict Mode, or slug + related both hitting the backend).
   */
  private static viewDedupeMap = new Map<string, number>()
  private static VIEW_DEDUPE_MS = 60_000 // 1 minute

  async incrementArticleViews(articleId: string, viewerKey?: string) {
    if (viewerKey) {
      const key = `${viewerKey}:${articleId}`
      const now = Date.now()
      const last = ArticlesService.viewDedupeMap.get(key)
      if (last != null && now - last < ArticlesService.VIEW_DEDUPE_MS) {
        return // already counted recently for this viewer + article
      }
      ArticlesService.viewDedupeMap.set(key, now)
      // Prune old entries to avoid unbounded growth
      if (ArticlesService.viewDedupeMap.size > 10_000) {
        const cutoff = now - ArticlesService.VIEW_DEDUPE_MS
        for (const [k, v] of ArticlesService.viewDedupeMap.entries()) {
          if (v < cutoff) ArticlesService.viewDedupeMap.delete(k)
        }
      }
    }
    await this.prisma.article.update({
      where: { id: articleId },
      data: { views: { increment: 1 } },
    })
  }

  /**
   * Find popular published articles by helpful percentage (for public help center).
   * Orders by helpfulCount/(helpfulCount+notHelpfulCount) desc, then by total votes.
   */
  async findPopularPublic(limit = 8, audience?: Array<'parents' | 'providers' | 'staff'>) {
    const where: Prisma.ArticleWhereInput = {
      status: 'published',
      OR: [{ helpfulCount: { gt: 0 } }, { notHelpfulCount: { gt: 0 } }],
    }
    if (audience && audience.length > 0) {
      where.audience = { hasSome: audience }
    }
    const articles = await this.prisma.article.findMany({
      where,
      take: 100,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
      },
    })
    const withPct = articles.map(a => {
      const total = a.helpfulCount + a.notHelpfulCount
      const helpfulPercentage = total > 0 ? a.helpfulCount / total : 0
      return { ...a, _helpfulPercentage: helpfulPercentage, _totalVotes: total }
    })
    withPct.sort((a, b) => {
      if (b._helpfulPercentage !== a._helpfulPercentage)
        return b._helpfulPercentage - a._helpfulPercentage
      return b._totalVotes - a._totalVotes
    })
    const top = withPct.slice(0, limit)
    return top.map(({ _helpfulPercentage, _totalVotes, ...a }) => a)
  }

  /**
   * Update an article
   */
  async update(id: string, dto: UpdateArticleDto) {
    // Check if article exists and retrieve current values for lastUpdatedAt comparison
    const existingArticle = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        articleType: true,
        audience: true,
        categoryId: true,
        contentHtml: true,
        summary: true,
        metaTitle: true,
        metaDescription: true,
      },
    })

    if (!existingArticle) {
      throw new NotFoundException('Article not found')
    }

    // Check if slug is being updated and if it's already taken
    if (dto.slug) {
      const existingSlug = await this.prisma.article.findUnique({
        where: { slug: dto.slug },
      })

      if (existingSlug && existingSlug.id !== id) {
        throw new BadRequestException('This slug is already taken by another article.')
      }
    }

    // Check if category exists (if being updated)
    if (dto.categoryId) {
      const category = await this.prisma.articleCategory.findUnique({
        where: { id: dto.categoryId },
      })

      if (!category) {
        throw new NotFoundException('Category not found')
      }
    }

    // Validate HTML content if provided (do not modify it)
    if (dto.contentHtml) {
      const validationResult = validateArticleHtml(dto.contentHtml)
      if (!validationResult.isValid) {
        throw new BadRequestException(
          `HTML validation failed:\n${validationResult.errors.join('\n')}`
        )
      }
    }

    const { relatedArticleIds, ...restDto } = dto

    // If the caller explicitly sent empty/whitespace SEO values, derive fallbacks
    // from the incoming payload (or existing article values as a last resort) so
    // the non-nullable DB columns never receive blank strings.
    const metaTitleProvided = restDto.metaTitle !== undefined
    const metaDescriptionProvided = restDto.metaDescription !== undefined
    if (metaTitleProvided || metaDescriptionProvided) {
      const derived = this.deriveSeoFields({
        title: restDto.title ?? existingArticle.title,
        summary: restDto.summary ?? existingArticle.summary,
        contentHtml: restDto.contentHtml ?? existingArticle.contentHtml,
        metaTitle: restDto.metaTitle,
        metaDescription: restDto.metaDescription,
      })
      if (metaTitleProvided) restDto.metaTitle = derived.metaTitle
      if (metaDescriptionProvided) restDto.metaDescription = derived.metaDescription
    }

    const contentChanged = this.hasContentFieldChanges(restDto, existingArticle)
    const updateData: Prisma.ArticleUpdateInput = {
      ...restDto,
      ...(contentChanged ? { lastUpdatedAt: new Date() } : {}),
    }

    return await this.prisma.$transaction(async tx => {
      const article = await tx.article.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
        },
      })
      if (relatedArticleIds !== undefined) {
        await this.syncRelatedArticles(id, relatedArticleIds ?? [], tx)
      }
      return article
    })
  }

  /**
   * Delete an article
   */
  async remove(id: string) {
    // Check if article exists
    await this.findOne(id)

    return this.prisma.article.delete({
      where: { id },
    })
  }

  /**
   * Get global stats for all articles (unfiltered)
   */
  async getGlobalStats() {
    const [total, published, drafts, feedbackAgg] = await Promise.all([
      this.prisma.article.count(),
      this.prisma.article.count({ where: { status: 'published' } }),
      this.prisma.article.count({ where: { status: 'draft' } }),
      this.prisma.article.aggregate({
        _sum: {
          helpfulCount: true,
          notHelpfulCount: true,
        },
      }),
    ])

    const helpful = feedbackAgg._sum.helpfulCount ?? 0
    const notHelpful = feedbackAgg._sum.notHelpfulCount ?? 0
    const totalVotes = helpful + notHelpful
    const avgHelpfulness = totalVotes > 0 ? Math.round((helpful / totalVotes) * 100) : 0

    return {
      total,
      published,
      drafts,
      avgHelpfulness,
    }
  }
}
