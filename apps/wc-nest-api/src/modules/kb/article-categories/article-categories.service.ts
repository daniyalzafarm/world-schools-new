import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateCategoryDto } from './dto/create-category.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'
import { QueryCategoriesDto } from './dto/query-categories.dto'
import { Prisma } from '../../../generated/client/client'

/** Audience type for filtering categories by published articles. */
type AudienceFilter = Array<'parents' | 'providers' | 'staff'>

@Injectable()
export class ArticleCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new article category
   */
  async create(dto: CreateCategoryDto) {
    // Check if slug already exists
    const existingSlug = await this.prisma.articleCategory.findUnique({
      where: { slug: dto.slug },
    })

    if (existingSlug) {
      throw new BadRequestException('This slug is already taken. Please choose a different one.')
    }

    // Check if name already exists
    const existingName = await this.prisma.articleCategory.findUnique({
      where: { name: dto.name },
    })

    if (existingName) {
      throw new BadRequestException(
        'This category name already exists. Please choose a different one.'
      )
    }

    return this.prisma.articleCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        icon: dto.icon,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    })
  }

  /**
   * Find all categories with filters and pagination
   */
  async findAll(query: QueryCategoriesDto) {
    const {
      isActive,
      search,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
    } = query

    const where: Prisma.ArticleCategoryWhereInput = {}

    // Filter by active status
    if (isActive !== undefined) {
      where.isActive = isActive
    }

    // Search by name or description
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Execute query
    const [categories, total] = await Promise.all([
      this.prisma.articleCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { articles: true },
          },
        },
      }),
      this.prisma.articleCategory.count({ where }),
    ])

    return {
      data: categories,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + categories.length < total,
      },
    }
  }

  /**
   * Find one category by ID
   */
  async findOne(id: string) {
    const category = await this.prisma.articleCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    })

    if (!category) {
      throw new NotFoundException('Category not found')
    }

    return category
  }

  /**
   * Update a category
   */
  async update(id: string, dto: UpdateCategoryDto) {
    // Check if category exists
    await this.findOne(id)

    // Check if slug is being updated and if it's already taken
    if (dto.slug) {
      const existingSlug = await this.prisma.articleCategory.findUnique({
        where: { slug: dto.slug },
      })

      if (existingSlug && existingSlug.id !== id) {
        throw new BadRequestException('This slug is already taken by another category.')
      }
    }

    // Check if name is being updated and if it's already taken
    if (dto.name) {
      const existingName = await this.prisma.articleCategory.findUnique({
        where: { name: dto.name },
      })

      if (existingName && existingName.id !== id) {
        throw new BadRequestException('This category name already exists.')
      }
    }

    return this.prisma.articleCategory.update({
      where: { id },
      data: dto,
      include: {
        _count: {
          select: { articles: true },
        },
      },
    })
  }

  /**
   * Delete a category (only if no articles)
   */
  async remove(id: string) {
    // Check if category exists
    const category = await this.findOne(id)

    // Check if category has articles
    if (category._count.articles > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.articles} article(s). Please reassign or delete the articles first.`
      )
    }

    return this.prisma.articleCategory.delete({
      where: { id },
    })
  }

  /**
   * Update sort order
   */
  async updateSortOrder(id: string, sortOrder: number) {
    // Check if category exists
    await this.findOne(id)

    return this.prisma.articleCategory.update({
      where: { id },
      data: { sortOrder },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    })
  }

  /**
   * Check if slug is available
   */
  async checkSlugAvailability(slug: string, categoryId?: string) {
    const existingCategory = await this.prisma.articleCategory.findUnique({
      where: { slug },
      select: { id: true },
    })

    // If no category found with this slug, it's available
    if (!existingCategory) {
      return { available: true }
    }

    // If a categoryId is provided and it matches the existing category, it's available (same category)
    if (categoryId && existingCategory.id === categoryId) {
      return { available: true }
    }

    // Slug is taken by another category
    return { available: false }
  }

  /**
   * Get active categories for public use (with article counts).
   * When audience is provided, only returns categories that have at least one
   * published article targeting that audience; counts only those articles.
   */
  async findAllPublic(audience?: AudienceFilter) {
    const where: Prisma.ArticleCategoryWhereInput = { isActive: true }
    const articleFilter: Prisma.ArticleWhereInput = { status: 'published' }
    if (audience && audience.length > 0) {
      articleFilter.audience = { hasSome: audience }
      where.articles = { some: articleFilter }
    }

    return this.prisma.articleCategory.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        sortOrder: true,
        _count: {
          select: {
            articles: {
              where: articleFilter,
            },
          },
        },
      },
    })
  }
}
