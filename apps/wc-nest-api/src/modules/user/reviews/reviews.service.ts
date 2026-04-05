import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AzureStorageService } from '@world-schools/wc-utils/backend'
import { PrismaService } from '../../../prisma/prisma.service'
import { ConfigService } from '../../../config/config.service'
import { CreateReviewDto } from './dto/create-review.dto'
import { UpdateReviewDto } from './dto/update-review.dto'

const REVIEW_INCLUDE = {
  camp: {
    select: {
      id: true,
      name: true,
      locationName: true,
      photos: true,
      slug: true,
    },
  },
  tags: {
    select: { id: true, dimension: true, tagValue: true },
  },
  response: {
    select: { id: true, responseText: true, createdAt: true, updatedAt: true },
  },
} as const

@Injectable()
export class UserReviewsService {
  private azureStorage: AzureStorageService | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  /** Same SAS URL rules as {@link UserCampsService.getCampBySlug} / get camp API. */
  private getAzureStorage(): AzureStorageService {
    if (!this.azureStorage) {
      const config = this.configService.azureStorageConfig
      if (!config.accountName || !config.accountKey || !config.containerName) {
        throw new Error('Azure Storage is not configured. Please contact the administrator.')
      }
      this.azureStorage = new AzureStorageService(config)
    }
    return this.azureStorage
  }

  private async generatePhotoUrls(photos: any[]): Promise<any[]> {
    const azureStorage = this.getAzureStorage()
    return Promise.all(
      photos.map(async photo => {
        try {
          const sasUrl = await azureStorage.generateSasUrl(photo.url, 24)
          return {
            ...photo,
            url: sasUrl,
            thumbnail: sasUrl,
          }
        } catch {
          return photo
        }
      })
    )
  }

  private async withSasUrlsOnCampPhotos<T extends { photos?: unknown }>(camp: T): Promise<T> {
    const photos = camp.photos
    if (photos && Array.isArray(photos) && (photos as any[]).length > 0) {
      const photosWithUrls = await this.generatePhotoUrls(photos as any[])
      return { ...camp, photos: photosWithUrls }
    }
    return camp
  }

  private async withSasUrlsOnReviewCamp<T extends { camp?: { photos?: unknown } | null }>(
    review: T | null
  ): Promise<T | null> {
    if (!review?.camp) return review
    const camp = await this.withSasUrlsOnCampPhotos(review.camp as { photos?: unknown })
    return { ...review, camp }
  }

  private async getParentId(userId: string): Promise<string> {
    const parent = await this.prisma.parent.findUnique({ where: { userId } })
    if (!parent) throw new NotFoundException('Parent profile not found')
    return parent.id
  }

  async findAll(userId: string) {
    const parentId = await this.getParentId(userId)

    const [published, pendingModeration] = await Promise.all([
      this.prisma.campReview.findMany({
        where: { parentId, status: 'published' },
        include: REVIEW_INCLUDE,
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.campReview.findMany({
        where: { parentId, status: 'pending' },
        include: REVIEW_INCLUDE,
        orderBy: { submittedAt: 'desc' },
      }),
    ])

    return {
      published: await Promise.all(published.map(r => this.withSasUrlsOnReviewCamp(r))),
      pendingModeration: await Promise.all(
        pendingModeration.map(r => this.withSasUrlsOnReviewCamp(r))
      ),
    }
  }

  async findOne(userId: string, reviewId: string) {
    const parentId = await this.getParentId(userId)
    const review = await this.prisma.campReview.findFirst({
      where: { id: reviewId, parentId },
      include: REVIEW_INCLUDE,
    })
    if (!review) throw new NotFoundException('Review not found')
    return this.withSasUrlsOnReviewCamp(review)
  }

  async findEligible(userId: string) {
    const parentId = await this.getParentId(userId)

    // Bookings from completed or at_camp booking groups where no review exists
    const bookingsWithoutReview = await this.prisma.booking.findMany({
      where: {
        parentId,
        bookingGroup: {
          status: { in: ['at_camp', 'completed'] },
        },
        review: { is: null },
      },
      select: {
        id: true,
        campId: true,
        bookingGroupId: true,
        endDate: true,
        camp: {
          select: {
            id: true,
            name: true,
            locationName: true,
            photos: true,
            slug: true,
          },
        },
      },
      orderBy: { endDate: 'desc' },
    })

    // All published camps for "Browse All" section
    const allCamps = await this.prisma.camp.findMany({
      where: { status: 'published' },
      select: {
        id: true,
        name: true,
        locationName: true,
        photos: true,
        slug: true,
      },
      orderBy: { name: 'asc' },
    })

    const campIds = [
      ...new Set([...allCamps.map(c => c.id), ...bookingsWithoutReview.map(b => b.camp.id)]),
    ]
    const reviewStatsByCampId = await this.getPublishedReviewStatsForCamps(campIds)

    const attachStats = <T extends { id: string }>(camp: T) => {
      const s = reviewStatsByCampId.get(camp.id)
      return {
        ...camp,
        reviewCount: s?.reviewCount ?? 0,
        avgRating: s?.avgRating ?? null,
      }
    }

    const eligibleFromBookings = await Promise.all(
      bookingsWithoutReview.map(b =>
        this.withSasUrlsOnCampPhotos(
          attachStats({
            id: b.camp.id,
            name: b.camp.name,
            locationName: b.camp.locationName,
            photos: b.camp.photos,
            slug: b.camp.slug,
            attended: {
              date: b.endDate.toISOString(),
              bookingGroupId: b.bookingGroupId,
              bookingId: b.id,
            },
          })
        )
      )
    )

    const allCampsOut = await Promise.all(
      allCamps.map(c => this.withSasUrlsOnCampPhotos(attachStats(c)))
    )

    return {
      attended: eligibleFromBookings,
      allCamps: allCampsOut,
    }
  }

  /** Aggregated published review counts and a simple average of dimension means per camp (for list cards). */
  private async getPublishedReviewStatsForCamps(
    campIds: string[]
  ): Promise<Map<string, { reviewCount: number; avgRating: number | null }>> {
    const map = new Map<string, { reviewCount: number; avgRating: number | null }>()
    if (campIds.length === 0) return map

    const rows = await this.prisma.campReview.groupBy({
      by: ['campId'],
      where: { status: 'published', campId: { in: campIds } },
      _count: { _all: true },
      _avg: {
        happinessRating: true,
        safetyRating: true,
        communicationRating: true,
        asDescribedRating: true,
        growthRating: true,
        valueRating: true,
      },
    })

    for (const row of rows) {
      const dims = [
        row._avg.happinessRating,
        row._avg.safetyRating,
        row._avg.communicationRating,
        row._avg.asDescribedRating,
        row._avg.growthRating,
        row._avg.valueRating,
      ]
        .map(v => (v == null ? null : Number(v)))
        .filter((v): v is number => v != null && !Number.isNaN(v))

      const avgRating =
        dims.length > 0
          ? Math.round((dims.reduce((a, b) => a + b, 0) / dims.length) * 100) / 100
          : null

      map.set(row.campId, {
        reviewCount: row._count._all,
        avgRating,
      })
    }

    return map
  }

  async create(userId: string, dto: CreateReviewDto) {
    const parentId = await this.getParentId(userId)

    // Prevent duplicate reviews per booking
    if (dto.bookingId) {
      const existing = await this.prisma.campReview.findUnique({
        where: { bookingId: dto.bookingId },
      })
      if (existing) {
        throw new BadRequestException('A review for this booking already exists')
      }
    }

    const { tags = [], ...reviewFields } = dto

    const review = await this.prisma.$transaction(async tx => {
      const created = await tx.campReview.create({
        data: {
          campId: reviewFields.campId,
          parentId,
          bookingGroupId: reviewFields.bookingGroupId ?? null,
          bookingId: reviewFields.bookingId ?? null,
          visitMonth: reviewFields.visitMonth ?? null,
          visitYear: reviewFields.visitYear ?? null,
          kidCount: reviewFields.kidCount ?? null,
          kidAges: reviewFields.kidAges ?? [],
          kidTags: reviewFields.kidTags ?? [],
          happinessRating: reviewFields.happinessRating ?? null,
          safetyRating: reviewFields.safetyRating ?? null,
          communicationRating: reviewFields.communicationRating ?? null,
          asDescribedRating: reviewFields.asDescribedRating ?? null,
          growthRating: reviewFields.growthRating ?? null,
          valueRating: reviewFields.valueRating ?? null,
          reviewText: reviewFields.reviewText ?? null,
          photos: reviewFields.photos ?? [],
          returnChoice: reviewFields.returnChoice ?? null,
          outcomes: reviewFields.outcomes ?? [],
          status: 'published',
          submittedAt: new Date(),
          publishedAt: new Date(),
        },
      })

      if (tags.length > 0) {
        await tx.campReviewTag.createMany({
          data: tags.map(t => ({
            reviewId: created.id,
            dimension: t.dimension,
            tagValue: t.tagValue,
          })),
        })
      }

      return tx.campReview.findUnique({
        where: { id: created.id },
        include: REVIEW_INCLUDE,
      })
    })

    return this.withSasUrlsOnReviewCamp(review)
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const parentId = await this.getParentId(userId)

    const existing = await this.prisma.campReview.findUnique({
      where: { id: reviewId },
    })
    if (!existing) throw new NotFoundException('Review not found')
    if (existing.parentId !== parentId) throw new ForbiddenException('Access denied')

    const { tags, ...fields } = dto

    const review = await this.prisma.$transaction(async tx => {
      const updated = await tx.campReview.update({
        where: { id: reviewId },
        data: {
          ...(fields.visitMonth !== undefined && { visitMonth: fields.visitMonth }),
          ...(fields.visitYear !== undefined && { visitYear: fields.visitYear }),
          ...(fields.kidCount !== undefined && { kidCount: fields.kidCount }),
          ...(fields.kidAges !== undefined && { kidAges: fields.kidAges }),
          ...(fields.kidTags !== undefined && { kidTags: fields.kidTags }),
          ...(fields.happinessRating !== undefined && { happinessRating: fields.happinessRating }),
          ...(fields.safetyRating !== undefined && { safetyRating: fields.safetyRating }),
          ...(fields.communicationRating !== undefined && {
            communicationRating: fields.communicationRating,
          }),
          ...(fields.asDescribedRating !== undefined && {
            asDescribedRating: fields.asDescribedRating,
          }),
          ...(fields.growthRating !== undefined && { growthRating: fields.growthRating }),
          ...(fields.valueRating !== undefined && { valueRating: fields.valueRating }),
          ...(fields.reviewText !== undefined && { reviewText: fields.reviewText }),
          ...(fields.photos !== undefined && { photos: fields.photos }),
          ...(fields.returnChoice !== undefined && { returnChoice: fields.returnChoice }),
          ...(fields.outcomes !== undefined && { outcomes: fields.outcomes }),
          ...(existing.status !== 'draft' && { editedAt: new Date() }),
          ...(fields.status !== undefined && {
            status: fields.status === 'pending' ? 'published' : fields.status,
            submittedAt: fields.status === 'pending' ? new Date() : existing.submittedAt,
            ...(fields.status === 'pending' && { publishedAt: new Date() }),
          }),
        },
      })

      if (tags !== undefined) {
        await tx.campReviewTag.deleteMany({ where: { reviewId: updated.id } })
        if (tags.length > 0) {
          await tx.campReviewTag.createMany({
            data: tags.map(t => ({
              reviewId: updated.id,
              dimension: t.dimension,
              tagValue: t.tagValue,
            })),
          })
        }
      }

      return tx.campReview.findUnique({
        where: { id: updated.id },
        include: REVIEW_INCLUDE,
      })
    })

    return this.withSasUrlsOnReviewCamp(review)
  }

  async remove(userId: string, reviewId: string) {
    const parentId = await this.getParentId(userId)

    const existing = await this.prisma.campReview.findUnique({
      where: { id: reviewId },
    })
    if (!existing) throw new NotFoundException('Review not found')
    if (existing.parentId !== parentId) throw new ForbiddenException('Access denied')
    if (existing.status !== 'draft') {
      throw new BadRequestException('Only draft reviews can be deleted')
    }

    await this.prisma.campReview.delete({ where: { id: reviewId } })
    return { message: 'Review deleted' }
  }
}
