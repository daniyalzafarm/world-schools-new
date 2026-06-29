import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { SearchMessagesDto } from '../interfaces/message.interface'

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)

  constructor(private prisma: PrismaService) {}

  /**
   * Search messages using PostgreSQL full-text search
   * Enhanced with additional filters (contentType, senderId, date range)
   */
  async searchMessages(dto: SearchMessagesDto) {
    const {
      userId,
      query,
      conversationId,
      limit = 50,
      offset = 0,
      contentType,
      senderId,
      startDate,
      endDate,
    } = dto

    // Build where clause
    const where: any = {
      isDeleted: false,
      content: {
        contains: query,
        mode: 'insensitive',
      },
      conversation: {
        participants: {
          some: {
            userId,
          },
        },
      },
    }

    // Apply additional filters
    if (conversationId) {
      where.conversationId = conversationId
    }

    if (contentType) {
      where.contentType = contentType
    }

    if (senderId) {
      where.senderId = senderId
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = startDate
      }
      if (endDate) {
        where.createdAt.lte = endDate
      }
    }

    const messages = await this.prisma.message.findMany({
      where,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        conversation: {
          select: {
            id: true,
            type: true,
            participants: {
              where: { userId: { not: userId } },
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                provider: { select: { id: true, legalCompanyName: true, email: true } },
              },
            },
          },
        },
        reactions: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })

    this.logger.debug(
      `Search found ${messages.length} messages for query: "${query}" with filters: ${JSON.stringify({ conversationId, contentType, senderId, startDate, endDate })}`
    )
    return messages
  }

  /**
   * Search messages using full-text search with ranking
   * This uses the search_vector column and PostgreSQL ts_rank
   * Enhanced with additional filters
   */
  async searchMessagesFullText(dto: SearchMessagesDto) {
    const {
      userId,
      query,
      conversationId,
      limit = 50,
      offset = 0,
      contentType,
      senderId,
      startDate,
      endDate,
    } = dto

    // Build dynamic WHERE conditions
    const conditions: string[] = [
      'cp.user_id = $2',
      'm.is_deleted = false',
      "m.search_vector @@ plainto_tsquery('english', $1)",
    ]

    const params: any[] = [query, userId]
    let paramIndex = 3

    // Add optional filters
    if (conversationId) {
      conditions.push(`m.conversation_id = $${paramIndex}`)
      params.push(conversationId)
      paramIndex++
    }

    if (contentType) {
      conditions.push(`m.content_type = $${paramIndex}`)
      params.push(contentType)
      paramIndex++
    }

    if (senderId) {
      conditions.push(`m.sender_id = $${paramIndex}`)
      params.push(senderId)
      paramIndex++
    }

    if (startDate) {
      conditions.push(`m.created_at >= $${paramIndex}`)
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      conditions.push(`m.created_at <= $${paramIndex}`)
      params.push(endDate)
      paramIndex++
    }

    // Add limit and offset
    params.push(limit, offset)

    // Use raw SQL for full-text search with ranking
    const sql = `
      SELECT
        m.*,
        ts_rank(m.search_vector, plainto_tsquery('english', $1)) as rank
      FROM messages m
      INNER JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY rank DESC, m.created_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `

    const results = await this.prisma.$queryRawUnsafe(sql, ...params)

    this.logger.debug(
      `Full-text search found ${(results as any[]).length} messages for query: "${query}" with filters: ${JSON.stringify({ conversationId, contentType, senderId, startDate, endDate })}`
    )
    return results
  }
}
