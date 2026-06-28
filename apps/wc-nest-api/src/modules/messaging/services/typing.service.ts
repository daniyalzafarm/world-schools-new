import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../../redis/redis.service'

/**
 * Typing indicator data structure
 */
export interface TypingIndicator {
  userId: string
  conversationId: string
  startedAt: Date
  userName?: string
}

/**
 * Typing Service for managing typing indicators in conversations
 * Uses Redis with short TTL (5 seconds) for ephemeral typing data
 */
@Injectable()
export class TypingService {
  private readonly logger = new Logger(TypingService.name)
  private readonly TYPING_TTL = 5 // 5 seconds - typing indicators are ephemeral

  constructor(private redis: RedisService) {}

  /**
   * Start typing indicator for a user in a conversation
   * Should be called when user starts typing
   */
  async startTyping(conversationId: string, userId: string, userName?: string): Promise<boolean> {
    const key = `typing:${conversationId}:${userId}`

    const typingData: TypingIndicator = {
      userId,
      conversationId,
      startedAt: new Date(),
      userName,
    }

    try {
      // Set typing indicator with short TTL (auto-expires after 5 seconds)
      await this.redis.setex(key, this.TYPING_TTL, JSON.stringify(typingData))

      this.logger.debug(`User ${userId} started typing in conversation ${conversationId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to set typing indicator for user ${userId}:`, error)
      return false
    }
  }

  /**
   * Stop typing indicator for a user in a conversation
   * Should be called when user stops typing or sends a message
   */
  async stopTyping(conversationId: string, userId: string): Promise<boolean> {
    const key = `typing:${conversationId}:${userId}`

    try {
      await this.redis.del(key)

      this.logger.debug(`User ${userId} stopped typing in conversation ${conversationId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to clear typing indicator for user ${userId}:`, error)
      return false
    }
  }

  /**
   * Get list of users currently typing in a conversation
   * Returns array of user IDs who are actively typing
   */
  async getTypingUsers(conversationId: string): Promise<TypingIndicator[]> {
    try {
      // Use SCAN instead of KEYS (non-blocking)
      const client = this.redis.getClient()
      const pattern = `typing:${conversationId}:*`
      const keys: string[] = []
      let cursor = '0'

      // Scan for all matching keys
      do {
        const [newCursor, matchedKeys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100 // Scan 100 keys per iteration
        )
        cursor = newCursor
        keys.push(...matchedKeys)
      } while (cursor !== '0')

      if (keys.length === 0) {
        return []
      }

      // ✅ GOOD: Pipeline for batch reads (keep existing code)
      const pipeline = client.pipeline()
      keys.forEach(key => pipeline.get(key))
      const results = await pipeline.exec()

      if (!results) {
        return []
      }

      // Parse and return typing indicators
      const typingUsers: TypingIndicator[] = []
      results.forEach(result => {
        if (result?.[1]) {
          const data = JSON.parse(result[1] as string)
          data.startedAt = new Date(data.startedAt)
          typingUsers.push(data)
        }
      })

      this.logger.debug(
        `Found ${typingUsers.length} users typing in conversation ${conversationId}`
      )
      return typingUsers
    } catch (error) {
      this.logger.error(`Failed to get typing users for conversation ${conversationId}:`, error)
      return []
    }
  }

  /**
   * Check if a specific user is typing in a conversation
   */
  async isUserTyping(conversationId: string, userId: string): Promise<boolean> {
    const key = `typing:${conversationId}:${userId}`

    try {
      const exists = await this.redis.exists(key)
      return exists
    } catch (error) {
      this.logger.error(`Failed to check typing status for user ${userId}:`, error)
      return false
    }
  }

  /**
   * Clear all typing indicators for a conversation
   * Useful for cleanup or testing
   */
  async clearConversationTyping(conversationId: string): Promise<boolean> {
    try {
      // ✅ ISSUE #14 FIX: Use SCAN instead of KEYS (non-blocking)
      const client = this.redis.getClient()
      const pattern = `typing:${conversationId}:*`
      const keys: string[] = []
      let cursor = '0'

      // Scan for all matching keys
      do {
        const [newCursor, matchedKeys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100 // Scan 100 keys per iteration
        )
        cursor = newCursor
        keys.push(...matchedKeys)
      } while (cursor !== '0')

      if (keys.length === 0) {
        return true
      }

      // Delete all typing indicators for this conversation
      await client.del(...keys)

      this.logger.debug(
        `Cleared ${keys.length} typing indicators for conversation ${conversationId}`
      )
      return true
    } catch (error) {
      this.logger.error(
        `Failed to clear typing indicators for conversation ${conversationId}:`,
        error
      )
      return false
    }
  }
}
