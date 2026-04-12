import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../../redis/redis.service'

/**
 * User presence status
 */
export enum PresenceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  AWAY = 'AWAY',
}

/**
 * Presence data structure
 */
export interface PresenceData {
  userId: string
  status: PresenceStatus
  lastSeen: Date
  deviceInfo?: string
}

/**
 * Presence Service for managing user online/offline/away status
 * Uses Redis for caching with TTL to automatically expire stale presence data
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name)
  private readonly PRESENCE_TTL = 300 // 5 minutes - auto-expire if not refreshed
  private readonly LAST_SEEN_TTL = 86400 // 24 hours - keep last seen for longer

  constructor(private redis: RedisService) {}

  /**
   * Set user status to ONLINE
   * Should be called when user connects via WebSocket
   */
  async setOnline(userId: string, deviceInfo?: string): Promise<boolean> {
    const presenceKey = `presence:${userId}`
    const lastSeenKey = `presence:lastseen:${userId}`

    const presenceData: PresenceData = {
      userId,
      status: PresenceStatus.ONLINE,
      lastSeen: new Date(),
      deviceInfo,
    }

    try {
      // Set presence with TTL - will auto-expire if not refreshed
      await this.redis.setex(presenceKey, this.PRESENCE_TTL, JSON.stringify(presenceData))

      // Update last seen timestamp (longer TTL)
      await this.redis.setex(lastSeenKey, this.LAST_SEEN_TTL, new Date().toISOString())

      this.logger.debug(`User ${userId} is now ONLINE`)
      return true
    } catch (error) {
      this.logger.error(`Failed to set user ${userId} online:`, error)
      return false
    }
  }

  /**
   * Set user status to OFFLINE
   * Should be called when user disconnects from WebSocket
   */
  async setOffline(userId: string): Promise<boolean> {
    const presenceKey = `presence:${userId}`
    const lastSeenKey = `presence:lastseen:${userId}`

    const presenceData: PresenceData = {
      userId,
      status: PresenceStatus.OFFLINE,
      lastSeen: new Date(),
    }

    try {
      // Set offline status with shorter TTL
      await this.redis.setex(presenceKey, 60, JSON.stringify(presenceData))

      // Update last seen timestamp
      await this.redis.setex(lastSeenKey, this.LAST_SEEN_TTL, new Date().toISOString())

      this.logger.debug(`User ${userId} is now OFFLINE`)
      return true
    } catch (error) {
      this.logger.error(`Failed to set user ${userId} offline:`, error)
      return false
    }
  }

  /**
   * Set user status to AWAY
   * Should be called when user is inactive for a period
   */
  async setAway(userId: string): Promise<boolean> {
    const presenceKey = `presence:${userId}`

    const presenceData: PresenceData = {
      userId,
      status: PresenceStatus.AWAY,
      lastSeen: new Date(),
    }

    try {
      // Set away status with normal TTL
      await this.redis.setex(presenceKey, this.PRESENCE_TTL, JSON.stringify(presenceData))

      this.logger.debug(`User ${userId} is now AWAY`)
      return true
    } catch (error) {
      this.logger.error(`Failed to set user ${userId} away:`, error)
      return false
    }
  }

  /**
   * Get presence status for a single user
   */
  async getPresence(userId: string): Promise<PresenceData | null> {
    const presenceKey = `presence:${userId}`
    const lastSeenKey = `presence:lastseen:${userId}`

    try {
      const presenceStr = await this.redis.get(presenceKey)

      if (presenceStr) {
        const presence = JSON.parse(presenceStr)
        // Convert lastSeen string back to Date
        presence.lastSeen = new Date(presence.lastSeen)
        return presence
      }

      // If no presence data, check last seen
      const lastSeenStr = await this.redis.get(lastSeenKey)
      if (lastSeenStr) {
        return {
          userId,
          status: PresenceStatus.OFFLINE,
          lastSeen: new Date(lastSeenStr),
        }
      }

      // No data available
      return null
    } catch (error) {
      this.logger.error(`Failed to get presence for user ${userId}:`, error)
      return null
    }
  }

  /**
   * Get presence status for multiple users (bulk operation)
   * More efficient than calling getPresence() multiple times
   */
  async getBulkPresence(userIds: string[]): Promise<Map<string, PresenceData>> {
    const presenceMap = new Map<string, PresenceData>()

    if (userIds.length === 0) {
      return presenceMap
    }

    try {
      // Use pipeline for efficient bulk operations
      const client = this.redis.getClient()
      const pipeline = client.pipeline()

      // Queue all GET operations
      userIds.forEach(userId => {
        pipeline.get(`presence:${userId}`)
        pipeline.get(`presence:lastseen:${userId}`)
      })

      // Execute all operations at once
      const results = await pipeline.exec()

      if (!results) {
        return presenceMap
      }

      // Process results (pairs of presence and lastSeen)
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i]
        const presenceResult = results[i * 2]
        const lastSeenResult = results[i * 2 + 1]

        if (presenceResult?.[1]) {
          // Has active presence data
          const presence = JSON.parse(presenceResult[1] as string)
          presence.lastSeen = new Date(presence.lastSeen)
          presenceMap.set(userId, presence)
        } else if (lastSeenResult?.[1]) {
          // Has last seen data but no active presence
          presenceMap.set(userId, {
            userId,
            status: PresenceStatus.OFFLINE,
            lastSeen: new Date(lastSeenResult[1] as string),
          })
        }
      }

      this.logger.debug(`Retrieved presence for ${presenceMap.size}/${userIds.length} users`)
      return presenceMap
    } catch (error) {
      this.logger.error('Failed to get bulk presence:', error)
      return presenceMap
    }
  }

  /**
   * Refresh user's online status (extend TTL)
   * Should be called periodically (e.g., every 60 seconds) while user is active
   */
  async refreshPresence(userId: string): Promise<boolean> {
    const presenceKey = `presence:${userId}`

    try {
      const presenceStr = await this.redis.get(presenceKey)

      if (!presenceStr) {
        // No existing presence, set as online
        return await this.setOnline(userId)
      }

      const presence = JSON.parse(presenceStr)

      // Update lastSeen and extend TTL
      presence.lastSeen = new Date()
      await this.redis.setex(presenceKey, this.PRESENCE_TTL, JSON.stringify(presence))

      this.logger.debug(`Refreshed presence for user ${userId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to refresh presence for user ${userId}:`, error)
      return false
    }
  }

  /**
   * Clear presence data for a user
   * Useful for testing or manual cleanup
   */
  async clearPresence(userId: string): Promise<boolean> {
    const presenceKey = `presence:${userId}`
    const lastSeenKey = `presence:lastseen:${userId}`

    try {
      await this.redis.del(presenceKey)
      await this.redis.del(lastSeenKey)

      this.logger.debug(`Cleared presence for user ${userId}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to clear presence for user ${userId}:`, error)
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // Presence subscriber sets — used for targeted presence broadcasting.
  //
  // Instead of broadcasting presence updates to all connected sockets (O(n)),
  // each user maintains a Redis Set of user IDs who care about their presence
  // (i.e., share at least one conversation). Updates are sent only to those
  // subscribers — O(k) where k << n.
  //
  // Key pattern: presence:subscribers:${watchedUserId}
  // TTL: 24 hours (refreshed when conversations are joined/left)
  // ---------------------------------------------------------------------------
  private readonly SUBSCRIBER_TTL = 86400 // 24 hours

  private subscriberKey(userId: string) {
    return `presence:subscribers:${userId}`
  }

  /**
   * Record that watcherUserId is interested in watchedUserId's presence.
   * Called bidirectionally when a user joins a conversation room.
   */
  async addPresenceSubscription(watchedUserId: string, watcherUserId: string): Promise<void> {
    try {
      const key = this.subscriberKey(watchedUserId)
      const client = this.redis.getClient()
      await client.sadd(key, watcherUserId)
      await client.expire(key, this.SUBSCRIBER_TTL)
    } catch (error) {
      this.logger.error(
        `Failed to add presence subscription ${watcherUserId} → ${watchedUserId}:`,
        error
      )
    }
  }

  /**
   * Remove watcherUserId from watchedUserId's subscriber set.
   * Called when a user leaves a conversation room.
   */
  async removePresenceSubscription(watchedUserId: string, watcherUserId: string): Promise<void> {
    try {
      await this.redis.getClient().srem(this.subscriberKey(watchedUserId), watcherUserId)
    } catch (error) {
      this.logger.error(
        `Failed to remove presence subscription ${watcherUserId} → ${watchedUserId}:`,
        error
      )
    }
  }

  /**
   * Get all user IDs that care about userId's presence updates.
   */
  async getPresenceSubscribers(userId: string): Promise<string[]> {
    try {
      return await this.redis.getClient().smembers(this.subscriberKey(userId))
    } catch (error) {
      this.logger.error(`Failed to get presence subscribers for ${userId}:`, error)
      return []
    }
  }
}
