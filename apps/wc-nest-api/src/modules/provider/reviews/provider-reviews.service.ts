import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateReviewResponseDto } from './dto/create-review-response.dto'

interface ListReviewsParams {
  status?: 'draft' | 'pending' | 'published' | 'rejected'
  limit?: number
  cursor?: string | null
}

@Injectable()
export class ProviderReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProvider(providerId: string, params: ListReviewsParams = {}) {
    const status = params.status ?? 'published'
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 50)

    const where = { camp: { providerId }, status } as const

    const [rows, total, unresponded] = await Promise.all([
      this.prisma.campReview.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        select: {
          id: true,
          campId: true,
          status: true,
          reviewText: true,
          helpfulCount: true,
          publishedAt: true,
          createdAt: true,
          happinessRating: true,
          safetyRating: true,
          communicationRating: true,
          asDescribedRating: true,
          growthRating: true,
          valueRating: true,
          camp: { select: { name: true } },
          parent: {
            select: {
              user: {
                select: { firstName: true, lastName: true, profilePhotoUrl: true },
              },
            },
          },
          response: {
            select: { id: true, responseText: true, createdAt: true },
          },
        },
      }),
      this.prisma.campReview.count({ where }),
      this.prisma.campReview.count({
        where: { camp: { providerId }, status: 'published', response: { is: null } },
      }),
    ])

    const data = rows.map(r => {
      const ratings = [
        r.happinessRating,
        r.safetyRating,
        r.communicationRating,
        r.asDescribedRating,
        r.growthRating,
        r.valueRating,
      ].filter((v): v is number => typeof v === 'number')
      const averageRating =
        ratings.length > 0
          ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
          : 0
      const u = r.parent.user
      const displayName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'Anonymous'
      return {
        id: r.id,
        campId: r.campId,
        campName: r.camp.name,
        parent: {
          displayName,
          profilePhotoUrl: u.profilePhotoUrl,
        },
        averageRating,
        reviewText: r.reviewText,
        status: r.status,
        helpfulCount: r.helpfulCount,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        response: r.response
          ? {
              id: r.response.id,
              responseText: r.response.responseText,
              createdAt: r.response.createdAt.toISOString(),
            }
          : null,
      }
    })

    return {
      data,
      meta: { total, unresponded },
    }
  }

  async respondToReview(
    userId: string,
    providerId: string,
    reviewId: string,
    dto: CreateReviewResponseDto
  ) {
    const review = await this.prisma.campReview.findUnique({
      where: { id: reviewId },
      select: { id: true, campId: true, status: true, camp: { select: { providerId: true } } },
    })

    if (!review) throw new NotFoundException('Review not found')
    if (review.camp.providerId !== providerId) {
      throw new ForbiddenException('This review does not belong to your camp')
    }
    if (review.status !== 'published') {
      throw new ForbiddenException('Can only respond to published reviews')
    }

    const response = await this.prisma.campReviewResponse.upsert({
      where: { reviewId },
      create: {
        reviewId,
        campId: review.campId,
        providerId,
        userId,
        responseText: dto.responseText,
      },
      update: {
        userId,
        responseText: dto.responseText,
      },
    })

    return response
  }

  async deleteResponse(userId: string, providerId: string, reviewId: string) {
    const response = await this.prisma.campReviewResponse.findUnique({
      where: { reviewId },
      include: { review: { select: { camp: { select: { providerId: true } } } } },
    })

    if (!response) throw new NotFoundException('Response not found')
    if (response.review.camp.providerId !== providerId) {
      throw new ForbiddenException('This response does not belong to your camp')
    }

    await this.prisma.campReviewResponse.delete({ where: { reviewId } })
    return { message: 'Response deleted' }
  }
}
