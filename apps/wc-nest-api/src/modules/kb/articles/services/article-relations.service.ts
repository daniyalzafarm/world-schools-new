import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { AddRelatedArticleDto } from '../dto/add-related-article.dto'
import { ReorderRelatedArticlesDto } from '../dto/reorder-related-articles.dto'

@Injectable()
export class ArticleRelationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get related articles for an article
   */
  async getRelatedArticles(articleId: string, publishedOnly = false) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
    })

    if (!article) {
      throw new NotFoundException('Article not found')
    }

    const where = publishedOnly ? { relatedArticle: { status: 'published' as const } } : {}

    const relations = await this.prisma.articleRelation.findMany({
      where: {
        articleId,
        ...where,
      },
      include: {
        relatedArticle: {
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
            articleType: true,
            status: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return relations.map(r => ({
      ...r.relatedArticle,
      relationId: r.id,
      sortOrder: r.sortOrder,
    }))
  }

  /**
   * Add a related article
   */
  async addRelatedArticle(articleId: string, dto: AddRelatedArticleDto) {
    // Check if both articles exist
    const [article, relatedArticle] = await Promise.all([
      this.prisma.article.findUnique({ where: { id: articleId } }),
      this.prisma.article.findUnique({ where: { id: dto.relatedArticleId } }),
    ])

    if (!article) {
      throw new NotFoundException('Article not found')
    }

    if (!relatedArticle) {
      throw new NotFoundException('Related article not found')
    }

    // Prevent self-referencing
    if (articleId === dto.relatedArticleId) {
      throw new BadRequestException('An article cannot be related to itself')
    }

    // Check if relation already exists
    const existingRelation = await this.prisma.articleRelation.findFirst({
      where: {
        articleId,
        relatedArticleId: dto.relatedArticleId,
      },
    })

    if (existingRelation) {
      throw new BadRequestException('This article is already in the related articles list')
    }

    // Create relation
    return this.prisma.articleRelation.create({
      data: {
        articleId,
        relatedArticleId: dto.relatedArticleId,
        sortOrder: dto.sortOrder ?? 0,
      },
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
    })
  }

  /**
   * Remove a related article
   */
  async removeRelatedArticle(articleId: string, relatedArticleId: string) {
    const relation = await this.prisma.articleRelation.findFirst({
      where: {
        articleId,
        relatedArticleId,
      },
    })

    if (!relation) {
      throw new NotFoundException('Related article not found')
    }

    return this.prisma.articleRelation.delete({
      where: { id: relation.id },
    })
  }

  /**
   * Reorder related articles
   */
  async reorderRelatedArticles(articleId: string, dto: ReorderRelatedArticlesDto) {
    // Check if article exists
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
    })

    if (!article) {
      throw new NotFoundException('Article not found')
    }

    // Update sort orders in a transaction
    await this.prisma.$transaction(
      dto.relatedArticles.map(item =>
        this.prisma.articleRelation.updateMany({
          where: {
            articleId,
            relatedArticleId: item.relatedArticleId,
          },
          data: {
            sortOrder: item.sortOrder,
          },
        })
      )
    )

    return { success: true, message: 'Related articles reordered successfully' }
  }
}
