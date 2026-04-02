import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
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
  constructor(private readonly prisma: PrismaService) {}

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

    return { published, pendingModeration }
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

    const eligibleFromBookings = bookingsWithoutReview.map(b => ({
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
    }))

    return { attended: eligibleFromBookings, allCamps }
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
          status: reviewFields.status,
          submittedAt: reviewFields.status === 'pending' ? new Date() : null,
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

    return review
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const parentId = await this.getParentId(userId)

    const existing = await this.prisma.campReview.findUnique({
      where: { id: reviewId },
    })
    if (!existing) throw new NotFoundException('Review not found')
    if (existing.parentId !== parentId) throw new ForbiddenException('Access denied')
    if (existing.status === 'published') {
      throw new BadRequestException('Published reviews cannot be edited')
    }

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
          ...(fields.status !== undefined && {
            status: fields.status,
            submittedAt: fields.status === 'pending' ? new Date() : existing.submittedAt,
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

    return review
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
