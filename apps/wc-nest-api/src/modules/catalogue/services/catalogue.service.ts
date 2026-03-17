import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { ActivityCategoryStatus } from '../../../generated/client/enums'
import {
  AdminActivityDto,
  AdminCategoryWithActivitiesDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../dto/catalogue-category.dto'
import { ActivityScaleLevelDto, ActivityScaleWithUsageDto } from '../dto/catalogue-scale.dto'
import { CreateActivityDto, UpdateActivityDto } from '../dto/catalogue-activity.dto'
import { CreateScaleDto, UpdateScaleDto } from '../dto/catalogue-scale-admin.dto'

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Helpers ----------

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
  }

  private assertSlugFormat(slug: string) {
    const trimmed = slug.trim()
    if (!trimmed) {
      throw new BadRequestException('Slug is required')
    }
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!slugRegex.test(trimmed)) {
      throw new BadRequestException('Slug must be lowercase alphanumeric with hyphens only')
    }
  }

  private normalizeScaleLevels(levels: { value: string; label?: string | null }[]) {
    const normalized = levels.map((l, i) => {
      const value = (l.value ?? '').trim()
      const label = (l.label ?? '').trim() || value
      if (!value) {
        throw new BadRequestException('Scale level value is required')
      }
      return { value, label, order: i + 1 }
    })

    if (normalized.length < 2) {
      throw new BadRequestException('A scale needs at least 2 levels')
    }

    const seen = new Set<string>()
    for (const lvl of normalized) {
      const key = lvl.value.toLowerCase()
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate scale level value: "${lvl.value}"`)
      }
      seen.add(key)
    }

    return normalized
  }

  async checkCategorySlugAvailability(
    slug: string,
    categoryId?: string
  ): Promise<{ available: boolean }> {
    const normalized = slug.trim()
    this.assertSlugFormat(normalized)
    const existing = await this.prisma.activityCategory.findFirst({
      where: {
        slug: normalized,
        ...(categoryId ? { NOT: { id: categoryId } } : {}),
      },
      select: { id: true },
    })
    return { available: !existing }
  }

  async checkActivitySlugAvailability(
    slug: string,
    categoryId: string,
    activityId?: string
  ): Promise<{ available: boolean }> {
    const normalized = slug.trim()
    this.assertSlugFormat(normalized)
    if (!categoryId?.trim()) {
      throw new BadRequestException('categoryId is required')
    }

    const existing = await this.prisma.activity.findFirst({
      where: {
        categoryId: categoryId.trim(),
        slug: normalized,
        ...(activityId ? { NOT: { id: activityId } } : {}),
      },
      select: { id: true },
    })

    return { available: !existing }
  }

  // ---------- Admin: Categories ----------

  async getAdminCategories(): Promise<AdminCategoryWithActivitiesDto[]> {
    const categories = await this.prisma.activityCategory.findMany({
      // Ensure stable ordering when multiple categories share same `order`
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      include: {
        activities: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return categories.map(cat => ({
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      emoji: cat.emoji,
      status: cat.status,
      surfaceParentInterests: cat.surfaceParentInterests,
      surfaceCampFocus: cat.surfaceCampFocus,
      surfaceCampInterests: cat.surfaceCampInterests,
      order: cat.order,
      activities: cat.activities.map<AdminActivityDto>(act => ({
        id: act.id,
        slug: act.slug,
        name: act.name,
        emoji: act.emoji,
        scaleId: act.scaleId ?? null,
        order: act.order,
        isActive: act.isActive,
      })),
    }))
  }

  async createCategory(dto: CreateCategoryDto): Promise<AdminCategoryWithActivitiesDto> {
    const slug = (dto.slug?.trim() || this.generateSlug(dto.name)).trim()
    this.assertSlugFormat(slug)

    const availability = await this.checkCategorySlugAvailability(slug)
    if (!availability.available) {
      throw new ConflictException('Slug already in use')
    }

    const created = await this.prisma.activityCategory.create({
      data: {
        slug,
        name: dto.name,
        emoji: dto.emoji,
        status: dto.status ?? ActivityCategoryStatus.DRAFT,
        surfaceParentInterests: dto.surfaceParentInterests ?? true,
        surfaceCampFocus: dto.surfaceCampFocus ?? true,
        surfaceCampInterests: dto.surfaceCampInterests ?? true,
        order: dto.order ?? 0,
      },
      include: {
        activities: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return {
      id: created.id,
      slug: created.slug,
      name: created.name,
      emoji: created.emoji,
      status: created.status,
      surfaceParentInterests: created.surfaceParentInterests,
      surfaceCampFocus: created.surfaceCampFocus,
      surfaceCampInterests: created.surfaceCampInterests,
      order: created.order,
      activities: [],
    }
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto
  ): Promise<AdminCategoryWithActivitiesDto> {
    const existing = await this.prisma.activityCategory.findUnique({
      where: { id },
      include: { activities: { orderBy: { order: 'asc' } } },
    })

    if (!existing) {
      throw new NotFoundException('Category not found')
    }

    const nextSlug = dto.slug?.trim()
    if (nextSlug !== undefined) {
      this.assertSlugFormat(nextSlug)
      const availability = await this.checkCategorySlugAvailability(nextSlug, id)
      if (!availability.available) {
        throw new ConflictException('Slug already in use')
      }
    }

    const updated = await this.prisma.activityCategory.update({
      where: { id },
      data: {
        slug: nextSlug ?? existing.slug,
        name: dto.name ?? existing.name,
        emoji: dto.emoji ?? existing.emoji,
        status: dto.status ?? existing.status,
        surfaceParentInterests: dto.surfaceParentInterests ?? existing.surfaceParentInterests,
        surfaceCampFocus: dto.surfaceCampFocus ?? existing.surfaceCampFocus,
        surfaceCampInterests: dto.surfaceCampInterests ?? existing.surfaceCampInterests,
        order: dto.order ?? existing.order,
      },
      include: {
        activities: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      emoji: updated.emoji,
      status: updated.status,
      surfaceParentInterests: updated.surfaceParentInterests,
      surfaceCampFocus: updated.surfaceCampFocus,
      surfaceCampInterests: updated.surfaceCampInterests,
      order: updated.order,
      activities: updated.activities.map<AdminActivityDto>(act => ({
        id: act.id,
        slug: act.slug,
        name: act.name,
        emoji: act.emoji,
        scaleId: act.scaleId ?? null,
        order: act.order,
        isActive: act.isActive,
      })),
    }
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.prisma.activityCategory.findUnique({
      where: { id },
    })
    if (!category) {
      throw new NotFoundException('Category not found')
    }

    const [childRefs, campRefs] = await Promise.all([
      this.prisma.childInterest.count({ where: { categoryId: id } }),
      this.prisma.campInterest.count({ where: { categoryId: id } }),
    ])

    if (childRefs > 0 || campRefs > 0) {
      throw new ConflictException(
        `Category is in use by ${childRefs} child interests and ${campRefs} camp interests`
      )
    }

    await this.prisma.activityCategory.delete({
      where: { id },
    })
  }

  // ---------- Admin: Activities ----------

  async addActivityToCategory(
    categoryId: string,
    dto: CreateActivityDto
  ): Promise<AdminActivityDto> {
    const category = await this.prisma.activityCategory.findUnique({
      where: { id: categoryId },
    })
    if (!category) {
      throw new NotFoundException('Category not found')
    }

    const slug = (dto.slug?.trim() || this.generateSlug(dto.name)).trim()
    this.assertSlugFormat(slug)
    const availability = await this.checkActivitySlugAvailability(slug, categoryId)
    if (!availability.available) {
      throw new ConflictException('Slug already in use in this category')
    }

    const orderHint = await this.prisma.activity.count({
      where: { categoryId },
    })

    const created = await this.prisma.activity.create({
      data: {
        categoryId,
        slug,
        name: dto.name,
        emoji: dto.emoji,
        scaleId: dto.scaleId,
        order: orderHint,
      },
    })

    return {
      id: created.id,
      slug: created.slug,
      name: created.name,
      emoji: created.emoji,
      scaleId: created.scaleId ?? null,
      order: created.order,
      isActive: created.isActive,
    }
  }

  async updateActivity(id: string, dto: UpdateActivityDto): Promise<AdminActivityDto> {
    const existing = await this.prisma.activity.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Activity not found')
    }

    const nextCategoryId = dto.categoryId?.trim()
    if (nextCategoryId !== undefined) {
      const category = await this.prisma.activityCategory.findUnique({
        where: { id: nextCategoryId },
        select: { id: true },
      })
      if (!category) {
        throw new NotFoundException('Category not found')
      }
    }

    const nextSlug = dto.slug?.trim()
    if (nextSlug !== undefined) {
      this.assertSlugFormat(nextSlug)
    }

    const targetCategoryId = nextCategoryId ?? existing.categoryId
    const targetSlug = nextSlug ?? existing.slug
    if (targetCategoryId !== existing.categoryId || targetSlug !== existing.slug) {
      const availability = await this.checkActivitySlugAvailability(
        targetSlug,
        targetCategoryId,
        id
      )
      if (!availability.available) {
        throw new ConflictException('Slug already in use in this category')
      }
    }

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        categoryId: targetCategoryId,
        slug: targetSlug,
        name: dto.name ?? existing.name,
        emoji: dto.emoji ?? existing.emoji,
        scaleId: dto.scaleId === undefined ? existing.scaleId : dto.scaleId,
        isActive: dto.isActive ?? existing.isActive,
      },
    })

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      emoji: updated.emoji,
      scaleId: updated.scaleId ?? null,
      order: updated.order,
      isActive: updated.isActive,
    }
  }

  async deleteActivity(id: string): Promise<void> {
    const existing = await this.prisma.activity.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Activity not found')
    }

    const [childSkillRefs, eligibilityRefs] = await Promise.all([
      this.prisma.childSkill.count({ where: { activityId: id } }),
      this.prisma.campEligibilityRequirement.count({ where: { activityId: id } }),
    ])

    if (childSkillRefs > 0 || eligibilityRefs > 0) {
      throw new ConflictException(
        `Activity is in use by ${childSkillRefs} child skill records and ${eligibilityRefs} camp eligibility requirements`
      )
    }

    await this.prisma.activity.delete({ where: { id } })
  }

  // ---------- Admin & Public: Scales ----------

  async checkScaleIdAvailability(id: string): Promise<{ available: boolean }> {
    const normalized = id.trim()
    this.assertSlugFormat(normalized)
    const existing = await this.prisma.activityScale.findUnique({
      where: { id: normalized },
      select: { id: true },
    })
    return { available: !existing }
  }

  async getScalesWithUsage(): Promise<ActivityScaleWithUsageDto[]> {
    const scales = await this.prisma.activityScale.findMany({
      include: {
        levels: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { activities: true },
        },
      },
      orderBy: { id: 'asc' },
    })

    return scales.map(scale => ({
      id: scale.id,
      name: scale.name,
      description: scale.description,
      visualType: scale.visualType,
      colorKey: scale.colorKey,
      levels: scale.levels.map<ActivityScaleLevelDto>(lvl => ({
        id: lvl.id,
        value: lvl.value,
        label: lvl.label,
        order: lvl.order,
      })),
      usedByCount: scale._count.activities,
    }))
  }

  async getScaleWithUsage(id: string): Promise<ActivityScaleWithUsageDto> {
    const scale = await this.prisma.activityScale.findUnique({
      where: { id },
      include: {
        levels: { orderBy: { order: 'asc' } },
        _count: { select: { activities: true } },
      },
    })

    if (!scale) {
      throw new NotFoundException('Scale not found')
    }

    return {
      id: scale.id,
      name: scale.name,
      description: scale.description,
      visualType: scale.visualType,
      colorKey: scale.colorKey,
      levels: scale.levels.map<ActivityScaleLevelDto>(lvl => ({
        id: lvl.id,
        value: lvl.value,
        label: lvl.label,
        order: lvl.order,
      })),
      usedByCount: scale._count.activities,
    }
  }

  async createScale(dto: CreateScaleDto): Promise<ActivityScaleWithUsageDto> {
    const scaleId = dto.id.trim()
    this.assertSlugFormat(scaleId)

    const existing = await this.prisma.activityScale.findUnique({ where: { id: scaleId } })
    if (existing) {
      throw new ConflictException('Scale ID already in use')
    }

    const levels = this.normalizeScaleLevels(dto.levels)

    const created = await this.prisma.activityScale.create({
      data: {
        id: scaleId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        visualType: dto.visualType,
        colorKey: dto.colorKey,
        levels: {
          create: levels.map(l => ({ value: l.value, label: l.label, order: l.order })),
        },
      },
      include: {
        levels: { orderBy: { order: 'asc' } },
        _count: { select: { activities: true } },
      },
    })

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      visualType: created.visualType,
      colorKey: created.colorKey,
      levels: created.levels.map<ActivityScaleLevelDto>(lvl => ({
        id: lvl.id,
        value: lvl.value,
        label: lvl.label,
        order: lvl.order,
      })),
      usedByCount: created._count.activities,
    }
  }

  async updateScale(id: string, dto: UpdateScaleDto): Promise<ActivityScaleWithUsageDto> {
    const existing = await this.prisma.activityScale.findUnique({
      where: { id },
      include: {
        levels: { orderBy: { order: 'asc' } },
        _count: { select: { activities: true } },
      },
    })

    if (!existing) {
      throw new NotFoundException('Scale not found')
    }

    const shouldReplaceLevels = dto.levels !== undefined
    const nextLevels = shouldReplaceLevels ? this.normalizeScaleLevels(dto.levels!) : null

    const updated = await this.prisma.$transaction(async tx => {
      if (shouldReplaceLevels && nextLevels) {
        await tx.activityScaleLevel.deleteMany({ where: { scaleId: id } })
      }

      return tx.activityScale.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? existing.name,
          description:
            dto.description === undefined
              ? existing.description
              : dto.description === null
                ? null
                : dto.description.trim(),
          visualType: dto.visualType ?? existing.visualType,
          colorKey: dto.colorKey ?? existing.colorKey,
          ...(shouldReplaceLevels && nextLevels
            ? {
                levels: {
                  create: nextLevels.map(l => ({ value: l.value, label: l.label, order: l.order })),
                },
              }
            : {}),
        },
        include: {
          levels: { orderBy: { order: 'asc' } },
          _count: { select: { activities: true } },
        },
      })
    })

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      visualType: updated.visualType,
      colorKey: updated.colorKey,
      levels: updated.levels.map<ActivityScaleLevelDto>(lvl => ({
        id: lvl.id,
        value: lvl.value,
        label: lvl.label,
        order: lvl.order,
      })),
      usedByCount: updated._count.activities,
    }
  }

  async deleteScale(id: string): Promise<void> {
    const existing = await this.prisma.activityScale.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      throw new NotFoundException('Scale not found')
    }

    await this.prisma.$transaction(async tx => {
      // Activities will be set to NULL via FK on delete, but we explicitly unlink first
      // so the behaviour is deterministic (and avoids surprises with constraints).
      await tx.activity.updateMany({
        where: { scaleId: id },
        data: { scaleId: null },
      })

      await tx.activityScale.delete({ where: { id } })
    })
  }

  // ---------- Public read endpoints ----------

  async getPublicCategories(params: {
    status?: ActivityCategoryStatus
    surface?: 'parentInterests' | 'campFocus' | 'campInterests'
  }) {
    const where: any = {}

    if (params.status) {
      where.status = params.status
    } else {
      where.status = ActivityCategoryStatus.ACTIVE
    }

    if (params.surface === 'parentInterests') {
      where.surfaceParentInterests = true
    } else if (params.surface === 'campFocus') {
      where.surfaceCampFocus = true
    } else if (params.surface === 'campInterests') {
      where.surfaceCampInterests = true
    }

    const categories = await this.prisma.activityCategory.findMany({
      where,
      // Ensure stable ordering when multiple categories share same `order`
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      include: {
        activities: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    })

    return categories.map(cat => ({
      id: cat.slug,
      name: cat.name,
      emoji: cat.emoji,
      order: cat.order,
      activities: cat.activities.map(act => ({
        id: act.slug,
        name: act.name,
        emoji: act.emoji,
        scaleId: act.scaleId,
      })),
    }))
  }

  async getActivitiesWithScale() {
    const activities = await this.prisma.activity.findMany({
      where: {
        isActive: true,
        NOT: { scaleId: null },
      },
      include: {
        category: true,
      },
      orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }],
    })

    return activities.map(act => ({
      id: act.slug,
      name: act.name,
      emoji: act.emoji,
      scaleId: act.scaleId,
      category: {
        id: act.category.slug,
        name: act.category.name,
        emoji: act.category.emoji,
        order: act.category.order,
      },
    }))
  }

  async getPublicActivities(params: {
    hasScale?: boolean
    surface?: 'parentInterests' | 'campFocus' | 'campInterests'
  }) {
    const categoryWhere: any = {
      status: ActivityCategoryStatus.ACTIVE,
    }

    if (params.surface === 'parentInterests') {
      categoryWhere.surfaceParentInterests = true
    } else if (params.surface === 'campFocus') {
      categoryWhere.surfaceCampFocus = true
    } else if (params.surface === 'campInterests') {
      categoryWhere.surfaceCampInterests = true
    }

    const activities = await this.prisma.activity.findMany({
      where: {
        isActive: true,
        ...(params.hasScale ? { NOT: { scaleId: null } } : {}),
        category: categoryWhere,
      },
      include: {
        category: true,
      },
      orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }],
    })

    return activities.map(act => ({
      id: act.slug,
      name: act.name,
      emoji: act.emoji,
      scaleId: act.scaleId,
      category: {
        id: act.category.slug,
        name: act.category.name,
        emoji: act.category.emoji,
        order: act.category.order,
      },
    }))
  }

  async getPublicScales() {
    const scales = await this.prisma.activityScale.findMany({
      include: {
        levels: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    })

    return scales.map(scale => ({
      id: scale.id,
      name: scale.name,
      description: scale.description,
      visualType: scale.visualType,
      colorKey: scale.colorKey,
      levels: scale.levels.map<ActivityScaleLevelDto>(lvl => ({
        id: lvl.id,
        value: lvl.value,
        label: lvl.label,
        order: lvl.order,
      })),
    }))
  }
}
