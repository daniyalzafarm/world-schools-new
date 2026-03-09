import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'

@Injectable()
export class ArticleActionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Publish an article
   */
  async publish(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
    })

    if (!article) {
      throw new NotFoundException('Article not found')
    }

    if (article.status === 'published') {
      throw new BadRequestException('Article is already published')
    }

    return this.prisma.article.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
      include: {
        category: true,
      },
    })
  }

  /**
   * Unpublish an article (revert to draft)
   */
  async unpublish(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
    })

    if (!article) {
      throw new NotFoundException('Article not found')
    }

    if (article.status !== 'published') {
      throw new BadRequestException('Article is not published')
    }

    return this.prisma.article.update({
      where: { id },
      data: {
        status: 'draft',
        publishedAt: null,
      },
      include: {
        category: true,
      },
    })
  }

  /**
   * Duplicate an article
   */
  async duplicate(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
    })

    if (!article) {
      throw new NotFoundException('Article not found')
    }

    // Generate new slug with -copy suffix
    let newSlug = `${article.slug}-copy`
    let counter = 1

    // Ensure slug is unique
    while (await this.prisma.article.findUnique({ where: { slug: newSlug } })) {
      newSlug = `${article.slug}-copy-${counter}`
      counter++
    }

    // Create duplicate
    return this.prisma.article.create({
      data: {
        title: `${article.title} (Copy)`,
        slug: newSlug,
        articleType: article.articleType,
        audience: article.audience,
        categoryId: article.categoryId,
        status: 'draft',
        contentHtml: article.contentHtml,
        summary: article.summary,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        author: article.author,
        publishedAt: null,
      },
      include: {
        category: true,
      },
    })
  }

  /**
   * Check if slug is available
   */
  async checkSlugAvailability(slug: string, articleId?: string) {
    const existingArticle = await this.prisma.article.findUnique({
      where: { slug },
      select: { id: true },
    })

    // If no article found with this slug, it's available
    if (!existingArticle) {
      return { available: true }
    }

    // If an articleId is provided and it matches the existing article, it's available (same article)
    if (articleId && existingArticle.id === articleId) {
      return { available: true }
    }

    // Slug is taken by another article
    return { available: false }
  }
}
