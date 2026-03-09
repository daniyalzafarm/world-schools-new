import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { SubmitFeedbackDto } from '../dto/submit-feedback.dto'

@Injectable()
export class ArticleFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit helpful/not helpful feedback
   */
  async submitFeedback(
    articleId: string,
    dto: SubmitFeedbackDto,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Check if article exists
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
    })

    if (!article) {
      throw new NotFoundException('Article not found')
    }

    // Ensure either userId or sessionId is provided
    if (!userId && !dto.sessionId) {
      throw new BadRequestException('Either userId or sessionId must be provided')
    }

    // Check if user already voted
    const existingFeedback = await this.prisma.articleFeedback.findFirst({
      where: {
        articleId,
        OR: [userId ? { userId } : {}, dto.sessionId ? { sessionId: dto.sessionId } : {}].filter(
          obj => Object.keys(obj).length > 0
        ),
      },
    })

    if (existingFeedback) {
      // Same vote: no-op
      if (existingFeedback.isHelpful === dto.helpful) {
        return {
          success: true,
          message: 'Thank you for your feedback!',
          feedback: existingFeedback,
        }
      }
      // Change vote: update record and adjust denormalized counters
      const [feedback] = await this.prisma.$transaction([
        this.prisma.articleFeedback.update({
          where: { id: existingFeedback.id },
          data: { isHelpful: dto.helpful },
        }),
        this.prisma.article.update({
          where: { id: articleId },
          data: {
            helpfulCount: dto.helpful ? { increment: 1 } : { decrement: 1 },
            notHelpfulCount: dto.helpful ? { decrement: 1 } : { increment: 1 },
          },
        }),
      ])
      return {
        success: true,
        message: 'Thank you for your feedback!',
        feedback,
      }
    }

    // Create feedback record
    const feedback = await this.prisma.articleFeedback.create({
      data: {
        articleId,
        userId,
        sessionId: dto.sessionId,
        isHelpful: dto.helpful,
        ipAddress,
        userAgent,
      },
    })

    // Update denormalized counter
    await this.prisma.article.update({
      where: { id: articleId },
      data: {
        [dto.helpful ? 'helpfulCount' : 'notHelpfulCount']: {
          increment: 1,
        },
      },
    })

    return {
      success: true,
      message: 'Thank you for your feedback!',
      feedback,
    }
  }

  /**
   * Check if user has already voted
   */
  async checkFeedbackStatus(articleId: string, userId?: string, sessionId?: string) {
    if (!userId && !sessionId) {
      return { hasVoted: false }
    }

    const existingFeedback = await this.prisma.articleFeedback.findFirst({
      where: {
        articleId,
        OR: [userId ? { userId } : {}, sessionId ? { sessionId } : {}].filter(
          obj => Object.keys(obj).length > 0
        ),
      },
      select: {
        isHelpful: true,
        createdAt: true,
      },
    })

    if (!existingFeedback) {
      return { hasVoted: false }
    }

    return {
      hasVoted: true,
      isHelpful: existingFeedback.isHelpful,
      votedAt: existingFeedback.createdAt,
    }
  }

  /**
   * Get feedback statistics for an article
   */
  async getFeedbackStats(articleId: string) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: {
        helpfulCount: true,
        notHelpfulCount: true,
      },
    })

    if (!article) {
      throw new NotFoundException('Article not found')
    }

    const total = article.helpfulCount + article.notHelpfulCount
    const helpfulPercentage = total > 0 ? Math.round((article.helpfulCount / total) * 100) : 0

    return {
      helpfulCount: article.helpfulCount,
      notHelpfulCount: article.notHelpfulCount,
      total,
      helpfulPercentage,
    }
  }
}
