import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateReviewResponseDto } from './dto/create-review-response.dto'

@Injectable()
export class ProviderReviewsService {
  constructor(private readonly prisma: PrismaService) {}

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
