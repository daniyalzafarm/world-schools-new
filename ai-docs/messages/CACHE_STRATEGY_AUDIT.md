# Messaging System Cache Strategy Audit

**Date:** 2026-02-16  
**Scope:** `apps/wc-nest-api/src/modules/messaging/services/`  
**Auditor:** AI Agent  
**Version:** HeroUI v3 Beta - Messaging System

---

## Executive Summary

This audit examines the caching strategy across the messaging system services, focusing on Redis cache patterns, invalidation strategies, TTL management, and multi-replica consistency. The system uses **Azure Cache for Redis** in production with horizontal scaling across multiple Container App replicas.

### Key Findings

**Critical Issues (3):**
1. ❌ **Cache invalidation missing `providerId` parameter** - Provider users' cached conversations won't be invalidated
2. ❌ **No cache invalidation across replicas** - Pub/sub messages don't trigger cache invalidation on other replicas
3. ❌ **No conversation cache invalidation after sending messages** - Stale conversation lists after new messages

**High Priority Issues (4):**
4. ⚠️ **KEYS command used in production** - `typing.service.ts` uses blocking KEYS pattern matching
5. ⚠️ **Incomplete cache invalidation** - Only invalidates specific filter/limit/offset combinations
6. ⚠️ **No metrics cache invalidation** - `conversation:metrics:${conversationId}` not invalidated on updates
7. ⚠️ **N+1 query problem** - `getConversations` makes separate database query for each provider organization

**Medium Priority Issues (3):**
8. ⚙️ **No message-level caching** - Always queries database for `getMessages`, `getMessageById`
9. ⚙️ **Idempotency cache not cleaned up on errors** - Failed message sends leave cache entries
10. ⚙️ **No cache warming strategy** - Cold cache on deployment causes latency spikes

**Low Priority Issues (2):**
11. ℹ️ **No cache hit/miss metrics** - Difficult to measure cache effectiveness
12. ℹ️ **No cache size monitoring** - Risk of memory exhaustion

### Overall Assessment

**Cache Coverage:** 60% (3/5 core services use caching)  
**Consistency Risk:** HIGH (multi-replica invalidation issues)  
**Performance Impact:** MEDIUM (N+1 queries, no message caching)  
**Reliability:** MEDIUM (idempotency issues, error handling gaps)

---

## Table of Contents

1. [Current Cache Architecture](#current-cache-architecture)
2. [Service-by-Service Analysis](#service-by-service-analysis)
3. [Industry Best Practices Comparison](#industry-best-practices-comparison)
4. [Actionable Recommendations](#actionable-recommendations)
5. [Implementation Plan](#implementation-plan)
6. [Testing Strategy](#testing-strategy)

---

## Current Cache Architecture

### Cache Infrastructure

**Technology Stack:**
- **Redis Version:** Azure Cache for Redis (Redis 6.x compatible)
- **Deployment:** Horizontal scaling with multiple Container App replicas
- **Connection:** Single Redis instance shared across all replicas
- **Pub/Sub:** Separate publisher/subscriber connections for cross-replica broadcasting

**Cache Patterns Used:**
1. **Cache-Aside (Lazy Loading)** - Primary pattern for conversations, counts, metrics
2. **Write-Through** - Idempotency keys cached immediately after message creation
3. **TTL-Based Expiration** - Presence and typing indicators use auto-expiration
4. **Manual Invalidation** - Conversation cache invalidated on updates

### Cache Key Design

**Current Key Patterns:**
```
message:idempotency:{idempotencyKey}           # 24 hours TTL
conversations:{userId}:{filter}:{limit}:{offset}:{providerId|none}  # 5 minutes TTL
conversations:count:{userId}:{filter}:{providerId|none}  # 5 minutes TTL
conversation:metrics:{conversationId}          # 5 minutes TTL
presence:{userId}                              # 5 minutes TTL (auto-expire)
presence:lastseen:{userId}                     # 24 hours TTL
typing:{conversationId}:{userId}               # 5 seconds TTL (auto-expire)
```

### TTL Strategy

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Idempotency keys | 24 hours | Prevent duplicate sends within reasonable window |
| Conversation lists | 5 minutes | Balance freshness vs. database load |
| Conversation counts | 5 minutes | Same as lists for consistency |
| Conversation metrics | 5 minutes | Metrics change frequently with new messages |
| Presence (online) | 5 minutes | Auto-expire if not refreshed (heartbeat) |
| Presence (offline) | 60 seconds | Short TTL for offline status |
| Last seen | 24 hours | Keep historical data longer |
| Typing indicators | 5 seconds | Ephemeral data, very short-lived |

---

## Service-by-Service Analysis

### 1. messages.service.ts (1288 lines)

**Cache Operations:**
- ✅ Idempotency key caching (write-through)
- ❌ No message-level caching (always queries database)
- ❌ No cache invalidation after edits/deletes
- ❌ No conversation cache invalidation after sending messages

**Current Implementation:**

```typescript
// ✅ GOOD: Idempotency caching prevents duplicate sends
async sendMessage(dto: SendMessageDto) {
  const cacheKey = `message:idempotency:${idempotencyKey}`
  const existing = await this.redis.get(cacheKey)
  if (existing) {
    return JSON.parse(existing)  // Return cached result
  }

  // ... create message in transaction ...

  // Cache for 24 hours
  await this.redis.setex(cacheKey, this.IDEMPOTENCY_TTL, JSON.stringify(message))

  // ✅ GOOD: Publish to Redis for real-time delivery
  await this.redisPubSub.publishMessage('messages:new', { ... })
}
```

**Issues Identified:**

#### Issue #1: No Conversation Cache Invalidation After Sending Messages
**Severity:** CRITICAL
**Impact:** Users see stale conversation lists after sending messages

**Problem:**
```typescript
async sendMessage(dto: SendMessageDto) {
  // ... create message ...

  // ❌ MISSING: No conversation cache invalidation
  // Conversation list cache still shows old lastMessage, messageCount, updatedAt

  await this.redisPubSub.publishMessage('messages:new', { ... })
}
```

**Solution:**
```typescript
async sendMessage(dto: SendMessageDto) {
  // ... create message ...

  // ✅ FIX: Invalidate conversation cache for all participants
  const conversation = await this.prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  })

  for (const participant of conversation.participants) {
    await this.conversationsService.invalidateConversationCache(participant.userId)
  }

  // For provider conversations, also invalidate provider users' cache
  const metadata = conversation.metadata as { providerId?: string } | null
  if (metadata?.providerId) {
    // Get all provider users for this organization
    const providerUsers = await this.getProviderUsers(metadata.providerId)
    for (const providerUser of providerUsers) {
      await this.conversationsService.invalidateConversationCache(providerUser.id)
    }
  }

  await this.redisPubSub.publishMessage('messages:new', { ... })
}
```

#### Issue #2: No Message-Level Caching
**Severity:** MEDIUM
**Impact:** Every `getMessages` call queries database, high latency for frequently accessed conversations

**Problem:**
```typescript
async getMessages(dto: GetMessagesDto) {
  // ❌ ALWAYS queries database, no caching
  const messages = await this.prisma.message.findMany({ ... })
  return { data, nextCursor, hasMore }
}
```

**Solution:**
```typescript
async getMessages(dto: GetMessagesDto) {
  const { conversationId, limit, cursor, direction } = dto

  // ✅ FIX: Cache message pages
  const cacheKey = `messages:${conversationId}:${limit}:${cursor || 'initial'}:${direction}`
  const cached = await this.redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  const messages = await this.prisma.message.findMany({ ... })
  const result = { data, nextCursor, hasMore }

  // Cache for 5 minutes (same as conversations)
  await this.redis.setex(cacheKey, 300, JSON.stringify(result))

  return result
}
```

**Cache Invalidation:**
```typescript
async editMessage(dto: EditMessageDto) {
  // ... update message ...

  // ✅ FIX: Invalidate message cache for this conversation
  await this.invalidateMessageCache(message.conversationId)

  // Publish update event
  await this.redisPubSub.publishMessage('messages:updated', { ... })
}

private async invalidateMessageCache(conversationId: string) {
  // Use SCAN to find all message cache keys for this conversation
  const pattern = `messages:${conversationId}:*`
  const keys = await this.scanKeys(pattern)
  if (keys.length > 0) {
    await this.redis.del(...keys)
  }
}
```

#### Issue #3: Idempotency Cache Not Cleaned Up on Errors
**Severity:** MEDIUM
**Impact:** Failed message sends leave cache entries, preventing retries

**Problem:**
```typescript
async sendMessage(dto: SendMessageDto) {
  const cacheKey = `message:idempotency:${idempotencyKey}`
  const existing = await this.redis.get(cacheKey)
  if (existing) {
    return JSON.parse(existing)
  }

  // ❌ If transaction fails, cache is not set
  // ❌ If pub/sub fails, cache still contains partial result
  const message = await this.prisma.$transaction(async tx => { ... })

  await this.redis.setex(cacheKey, this.IDEMPOTENCY_TTL, JSON.stringify(message))
  await this.redisPubSub.publishMessage('messages:new', { ... })
}
```

**Solution:**
```typescript
async sendMessage(dto: SendMessageDto) {
  const cacheKey = `message:idempotency:${idempotencyKey}`
  const existing = await this.redis.get(cacheKey)
  if (existing) {
    return JSON.parse(existing)
  }

  try {
    const message = await this.prisma.$transaction(async tx => { ... })

    // ✅ FIX: Only cache after successful transaction
    await this.redis.setex(cacheKey, this.IDEMPOTENCY_TTL, JSON.stringify(message))

    // ✅ FIX: Pub/sub failure doesn't affect cache (eventual consistency)
    await this.redisPubSub.publishMessage('messages:new', { ... }).catch(err => {
      this.logger.error('Failed to publish message, but message was saved', err)
    })

    return message
  } catch (error) {
    // ✅ FIX: Don't cache on error
    this.logger.error('Failed to send message', error)
    throw error
  }
}
```

---

### 2. conversations.service.ts (808 lines)

**Cache Operations:**
- ✅ Cache-aside pattern for conversation lists (5-minute TTL)
- ✅ Cache-aside pattern for conversation counts (5-minute TTL)
- ✅ Cache-aside pattern for conversation metrics (5-minute TTL)
- ✅ Manual cache invalidation via `invalidateConversationCache` helper
- ✅ Cache keys include `providerId` parameter (recent fix)
- ❌ Cache invalidation missing `providerId` parameter
- ❌ Incomplete invalidation (only specific filter/limit/offset combinations)
- ❌ No metrics cache invalidation on updates
- ❌ N+1 query problem for provider enrichment

**Current Implementation:**

```typescript
// ✅ GOOD: Cache-aside pattern with providerId support
async getConversations(dto: GetConversationsDto) {
  const { userId, filter = 'all', limit = 50, offset = 0 } = dto

  // ✅ GOOD: Detect provider users
  const providerId = await this.getProviderIdForUser(userId!)

  // ✅ GOOD: Cache key includes providerId
  const cacheKey = `conversations:${userId}:${filter}:${limit}:${offset}:${providerId || 'none'}`
  const cached = await this.redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  // ✅ GOOD: Query supports provider users via OR condition
  const where = await this.buildConversationWhereClause({
    ...dto,
    providerId: providerId || undefined,
  })

  const conversations = await this.prisma.conversation.findMany({ where, ... })

  // ❌ PROBLEM: N+1 query - separate database query for each provider
  const enrichedConversations = await Promise.all(
    conversations.map(async conv => {
      if (conv.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
        const provider = await this.prisma.provider.findUnique({ ... })  // N+1!
        // ... create virtual participant ...
      }
      return conv
    })
  )

  await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(enrichedConversations))
  return enrichedConversations
}
```

**Issues Identified:**

#### Issue #4: Cache Invalidation Missing `providerId` Parameter
**Severity:** CRITICAL
**Impact:** Provider users see stale conversation data after updates

**Problem:**
```typescript
// ❌ CRITICAL BUG: Cache keys include providerId, but invalidation doesn't!
private async invalidateConversationCache(userId: string) {
  const filters = ['all', 'unread', 'archived', 'starred']
  const limits = [50, 100]
  const offsets = [0]

  for (const filter of filters) {
    for (const limit of limits) {
      for (const offset of offsets) {
        // ❌ MISSING: providerId parameter!
        const cacheKey = `conversations:${userId}:${filter}:${limit}:${offset}`
        await this.redis.del(cacheKey)
      }
    }
  }
}
```

**Impact:**
- Provider users' cache keys look like: `conversations:user123:all:50:0:provider456`
- Invalidation only deletes: `conversations:user123:all:50:0` (missing `:provider456`)
- Result: Provider users see stale data until 5-minute TTL expires

**Solution:**
```typescript
// ✅ FIX: Include providerId in invalidation
private async invalidateConversationCache(userId: string) {
  const filters = ['all', 'unread', 'archived', 'starred']
  const limits = [50, 100]
  const offsets = [0]

  // ✅ FIX: Detect if user is a provider user
  const providerId = await this.getProviderIdForUser(userId)

  for (const filter of filters) {
    for (const limit of limits) {
      for (const offset of offsets) {
        // ✅ FIX: Include providerId in cache key
        const cacheKey = `conversations:${userId}:${filter}:${limit}:${offset}:${providerId || 'none'}`
        await this.redis.del(cacheKey)
      }
    }
  }

  // ✅ FIX: Also invalidate count cache
  for (const filter of filters) {
    const countKey = `conversations:count:${userId}:${filter}:${providerId || 'none'}`
    await this.redis.del(countKey)
  }
}
```

#### Issue #5: Incomplete Cache Invalidation
**Severity:** HIGH
**Impact:** Users with non-standard pagination see stale data

**Problem:**
```typescript
// ❌ PROBLEM: Only invalidates specific combinations
private async invalidateConversationCache(userId: string) {
  const limits = [50, 100]  // ❌ What if user requests limit=20 or limit=200?
  const offsets = [0]       // ❌ What if user is on page 2 (offset=50)?

  // Only invalidates:
  // - conversations:user123:all:50:0
  // - conversations:user123:all:100:0
  // - conversations:user123:unread:50:0
  // - conversations:user123:unread:100:0
  // ... etc

  // ❌ MISSING: conversations:user123:all:20:0
  // ❌ MISSING: conversations:user123:all:50:50 (page 2)
}
```

**Solution Option 1: Wildcard Deletion (Recommended)**
```typescript
// ✅ FIX: Use SCAN to find and delete all matching keys
private async invalidateConversationCache(userId: string) {
  const providerId = await this.getProviderIdForUser(userId)

  // Delete all conversation list cache keys for this user
  const pattern = `conversations:${userId}:*:${providerId || 'none'}`
  await this.deleteKeysByPattern(pattern)

  // Delete all count cache keys for this user
  const countPattern = `conversations:count:${userId}:*:${providerId || 'none'}`
  await this.deleteKeysByPattern(countPattern)
}

private async deleteKeysByPattern(pattern: string) {
  const client = this.redis.getClient()
  let cursor = '0'
  const keysToDelete: string[] = []

  // ✅ Use SCAN instead of KEYS (non-blocking)
  do {
    const [newCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
    cursor = newCursor
    keysToDelete.push(...keys)
  } while (cursor !== '0')

  if (keysToDelete.length > 0) {
    await client.del(...keysToDelete)
    this.logger.debug(`Deleted ${keysToDelete.length} cache keys matching ${pattern}`)
  }
}
```

**Solution Option 2: Cache Tags (Alternative)**
```typescript
// ✅ ALTERNATIVE: Use cache tags for easier invalidation
async getConversations(dto: GetConversationsDto) {
  // ... existing code ...

  // Add tag to cache entry
  const cacheKey = `conversations:${userId}:${filter}:${limit}:${offset}:${providerId || 'none'}`
  const tagKey = `tag:user:${userId}:conversations`

  // Store cache entry
  await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(enrichedConversations))

  // Add cache key to tag set
  await this.redis.sadd(tagKey, cacheKey)
  await this.redis.expire(tagKey, this.CACHE_TTL)
}

private async invalidateConversationCache(userId: string) {
  const tagKey = `tag:user:${userId}:conversations`

  // Get all cache keys for this user
  const cacheKeys = await this.redis.smembers(tagKey)

  if (cacheKeys.length > 0) {
    // Delete all cache keys
    await this.redis.del(...cacheKeys)
    // Delete tag set
    await this.redis.del(tagKey)
  }
}
```

#### Issue #6: No Metrics Cache Invalidation
**Severity:** HIGH
**Impact:** Conversation metrics show stale message counts and unread counts

**Problem:**
```typescript
async sendMessage(dto: SendMessageDto) {
  // ... create message ...
  // ... update conversation.messageCount ...

  // ❌ MISSING: No metrics cache invalidation
  // Metrics cache still shows old totalMessages count
}

async markAsRead(dto: MarkAsReadDto) {
  // ... create read receipt ...
  // ... decrement unreadCount ...

  // ❌ MISSING: No metrics cache invalidation
  // Metrics cache still shows old unreadMessages count
}
```

**Solution:**
```typescript
// ✅ FIX: Invalidate metrics cache on updates
async sendMessage(dto: SendMessageDto) {
  // ... create message ...

  // Invalidate metrics cache
  const metricsKey = `conversation:metrics:${conversationId}`
  await this.redis.del(metricsKey)

  // Invalidate conversation cache for all participants
  // ... existing invalidation code ...
}

async markAsRead(dto: MarkAsReadDto) {
  // ... create read receipt ...

  // Invalidate metrics cache
  const metricsKey = `conversation:metrics:${message.conversationId}`
  await this.redis.del(metricsKey)
}
```

#### Issue #7: N+1 Query Problem for Provider Enrichment
**Severity:** HIGH
**Impact:** Performance degradation when loading conversations with many providers

**Problem:**
```typescript
// ❌ N+1 QUERY PROBLEM
const enrichedConversations = await Promise.all(
  conversations.map(async conv => {
    if (conv.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
      // ❌ Separate database query for EACH provider!
      const provider = await this.prisma.provider.findUnique({
        where: { id: metadata.providerId },
      })
    }
    return conv
  })
)
```

**Impact:**
- If user has 50 conversations with 20 different providers
- Makes 20 separate database queries (one per unique provider)
- Total query time = 20 × 10ms = 200ms extra latency

**Solution:**
```typescript
// ✅ FIX: Batch load all providers in one query
async getConversations(dto: GetConversationsDto) {
  // ... existing code to fetch conversations ...

  // ✅ FIX: Collect all unique provider IDs
  const providerIds = new Set<string>()
  for (const conv of conversations) {
    const metadata = conv.metadata as { providerId?: string } | null
    if (conv.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
      providerIds.add(metadata.providerId)
    }
  }

  // ✅ FIX: Batch load all providers in ONE query
  const providers = await this.prisma.provider.findMany({
    where: { id: { in: Array.from(providerIds) } },
    select: { id: true, legalCompanyName: true, email: true },
  })

  // Create lookup map for O(1) access
  const providerMap = new Map(providers.map(p => [p.id, p]))

  // ✅ FIX: Enrich conversations using in-memory map (no database queries)
  const enrichedConversations = conversations.map(conv => {
    const metadata = conv.metadata as { providerId?: string } | null
    if (conv.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
      const provider = providerMap.get(metadata.providerId)
      if (provider) {
        // Create virtual participant
        return {
          ...conv,
          participants: [...conv.participants, createVirtualParticipant(provider)],
        }
      }
    }
    return conv
  })

  // Cache the result
  await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(enrichedConversations))
  return enrichedConversations
}
```

**Performance Improvement:**
- Before: 20 queries × 10ms = 200ms
- After: 1 query × 10ms = 10ms
- **20x faster!**

---

### 3. presence.service.ts (261 lines)

**Cache Operations:**
- ✅ TTL-based auto-expiration (5 minutes for online, 60 seconds for offline)
- ✅ Separate last-seen tracking (24-hour TTL)
- ✅ No manual invalidation needed (TTL handles cleanup)

**Current Implementation:**

```typescript
// ✅ EXCELLENT: TTL-based approach is perfect for ephemeral presence data
async setOnline(userId: string, deviceInfo?: string) {
  const presenceKey = `presence:${userId}`
  const lastSeenKey = `presence:lastseen:${userId}`

  // ✅ GOOD: Auto-expires after 5 minutes if not refreshed
  await this.redis.setex(presenceKey, this.PRESENCE_TTL, JSON.stringify(presenceData))

  // ✅ GOOD: Separate last-seen with longer TTL
  await this.redis.setex(lastSeenKey, this.LAST_SEEN_TTL, new Date().toISOString())
}
```

**Issues Identified:**

#### Issue #8: No Issues Found
**Severity:** N/A
**Assessment:** ✅ Presence service uses optimal caching strategy for ephemeral data

**Why This Works Well:**
1. **TTL-based expiration** - No manual invalidation needed
2. **Heartbeat pattern** - Clients refresh presence every 4 minutes (before 5-minute TTL)
3. **Separate last-seen** - Historical data preserved longer (24 hours)
4. **Simple key design** - `presence:{userId}` is collision-free and efficient

---

### 4. typing.service.ts (158 lines)

**Cache Operations:**
- ✅ Short TTL (5 seconds) for ephemeral typing data
- ❌ Uses KEYS command for pattern matching (blocking in production)
- ✅ Pipeline operations for batch reads

**Current Implementation:**

```typescript
// ✅ GOOD: Short TTL for ephemeral typing indicators
async startTyping(conversationId: string, userId: string) {
  const key = `typing:${conversationId}:${userId}`
  await this.redis.setex(key, this.TYPING_TTL, JSON.stringify(typingData))
}

// ❌ PROBLEM: Uses KEYS command (blocking)
async getTypingUsers(conversationId: string) {
  const client = this.redis.getClient()
  const pattern = `typing:${conversationId}:*`

  // ❌ BLOCKING: KEYS command scans entire keyspace
  const keys = await client.keys(pattern)

  // ✅ GOOD: Pipeline for batch reads
  const pipeline = client.pipeline()
  keys.forEach(key => pipeline.get(key))
  const results = await pipeline.exec()

  return typingUsers
}
```

**Issues Identified:**

#### Issue #9: KEYS Command Used in Production
**Severity:** HIGH
**Impact:** KEYS command blocks Redis, causing latency spikes for all operations

**Problem:**
```typescript
// ❌ CRITICAL: KEYS command is O(N) and blocks Redis
async getTypingUsers(conversationId: string) {
  const pattern = `typing:${conversationId}:*`
  const keys = await client.keys(pattern)  // ❌ BLOCKS REDIS!
}
```

**Why This Is Bad:**
- `KEYS` scans the entire keyspace (O(N) where N = total keys in Redis)
- Blocks all other Redis operations during scan
- In production with millions of keys, this can take seconds
- Causes latency spikes for all messaging operations

**Solution:**
```typescript
// ✅ FIX: Use SCAN instead of KEYS (non-blocking, cursor-based)
async getTypingUsers(conversationId: string) {
  const client = this.redis.getClient()
  const pattern = `typing:${conversationId}:*`
  const keys: string[] = []
  let cursor = '0'

  // ✅ SCAN is non-blocking and cursor-based
  do {
    const [newCursor, matchedKeys] = await client.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      100  // Scan 100 keys per iteration
    )
    cursor = newCursor
    keys.push(...matchedKeys)
  } while (cursor !== '0')

  if (keys.length === 0) {
    return []
  }

  // ✅ GOOD: Pipeline for batch reads
  const pipeline = client.pipeline()
  keys.forEach(key => pipeline.get(key))
  const results = await pipeline.exec()

  // Parse results
  const typingUsers: TypingIndicator[] = []
  results?.forEach(result => {
    if (result?.[1]) {
      const data = JSON.parse(result[1] as string)
      data.startedAt = new Date(data.startedAt)
      typingUsers.push(data)
    }
  })

  return typingUsers
}
```

**Alternative Solution: Use Redis Sets**
```typescript
// ✅ ALTERNATIVE: Track typing users in a Redis Set
async startTyping(conversationId: string, userId: string) {
  const key = `typing:${conversationId}:${userId}`
  const setKey = `typing:set:${conversationId}`

  // Store typing data
  await this.redis.setex(key, this.TYPING_TTL, JSON.stringify(typingData))

  // Add userId to set
  await this.redis.sadd(setKey, userId)
  await this.redis.expire(setKey, this.TYPING_TTL)
}

async getTypingUsers(conversationId: string) {
  const setKey = `typing:set:${conversationId}`

  // ✅ O(N) where N = number of typing users (typically < 10)
  const userIds = await this.redis.smembers(setKey)

  if (userIds.length === 0) {
    return []
  }

  // Batch fetch typing data
  const pipeline = this.redis.getClient().pipeline()
  userIds.forEach(userId => {
    pipeline.get(`typing:${conversationId}:${userId}`)
  })
  const results = await pipeline.exec()

  // Parse results
  const typingUsers: TypingIndicator[] = []
  results?.forEach(result => {
    if (result?.[1]) {
      const data = JSON.parse(result[1] as string)
      data.startedAt = new Date(data.startedAt)
      typingUsers.push(data)
    }
  })

  return typingUsers
}
```

---

### 5. redis-pub-sub.service.ts (263 lines)

**Cache Operations:**
- ✅ Separate publisher/subscriber connections
- ✅ Cross-replica message broadcasting
- ✅ Error handling and retry logic
- ❌ No cache invalidation coordination across replicas

**Current Implementation:**

```typescript
// ✅ GOOD: Separate connections for pub/sub
this.publisher = new Redis(redisUrl, { ... })
this.subscriber = new Redis(redisUrl, { ... })

// ✅ GOOD: Broadcasts real-time events
await this.redisPubSub.publishMessage('messages:new', { ... })
await this.redisPubSub.publishMessage('reactions:added', { ... })
await this.redisPubSub.publishMessage('receipts:read', { ... })
```

**Issues Identified:**

#### Issue #10: No Cache Invalidation Across Replicas
**Severity:** CRITICAL
**Impact:** Multi-replica deployments have inconsistent cache state

**Problem:**
```typescript
// Scenario: User sends message on Replica A
// Replica A:
async sendMessage(dto: SendMessageDto) {
  // ... create message ...

  // ✅ Invalidates cache on Replica A
  await this.invalidateConversationCache(userId)

  // ✅ Broadcasts message to all replicas
  await this.redisPubSub.publishMessage('messages:new', { ... })
}

// Replica B:
// ❌ Receives 'messages:new' event via pub/sub
// ❌ Broadcasts to WebSocket clients
// ❌ BUT: Cache is NOT invalidated on Replica B!
// ❌ Next request on Replica B returns stale cached data
```

**Impact:**
- User sends message on Replica A → cache invalidated on A
- User refreshes page, load balancer routes to Replica B
- Replica B returns cached conversation list (missing new message)
- User doesn't see their own message until 5-minute TTL expires

**Solution:**
```typescript
// ✅ FIX: Add cache invalidation events to pub/sub
async sendMessage(dto: SendMessageDto) {
  // ... create message ...

  // ✅ Invalidate cache locally
  await this.invalidateConversationCache(userId)

  // ✅ Broadcast message event
  await this.redisPubSub.publishMessage('messages:new', { ... })

  // ✅ FIX: Broadcast cache invalidation event
  await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
    userIds: [userId, ...otherParticipantIds],
    providerIds: metadata?.providerId ? [metadata.providerId] : [],
  })
}

// ✅ FIX: Handle cache invalidation events in redis-pub-sub.service.ts
private async handleRedisMessage(channel: string, message: string) {
  const data = JSON.parse(message)

  switch (channel) {
    case 'cache:invalidate:conversations':
      // ✅ Invalidate cache on this replica
      for (const userId of data.userIds) {
        await this.conversationsService.invalidateConversationCache(userId)
      }

      // ✅ Invalidate cache for provider users
      for (const providerId of data.providerIds || []) {
        const providerUsers = await this.getProviderUsers(providerId)
        for (const providerUser of providerUsers) {
          await this.conversationsService.invalidateConversationCache(providerUser.id)
        }
      }
      break

    case 'cache:invalidate:messages':
      // ✅ Invalidate message cache on this replica
      await this.messagesService.invalidateMessageCache(data.conversationId)
      break

    // ... existing cases ...
  }
}
```

**Alternative Solution: Use Redis Keyspace Notifications**
```typescript
// ✅ ALTERNATIVE: Use Redis keyspace notifications for automatic invalidation
// Configure Redis: notify-keyspace-events "Ex"

async onModuleInit() {
  // Subscribe to keyspace notifications
  await this.subscriber.psubscribe('__keyevent@0__:expired')
  await this.subscriber.psubscribe('__keyevent@0__:del')

  this.subscriber.on('pmessage', (pattern, channel, key) => {
    if (key.startsWith('conversations:')) {
      this.logger.debug(`Cache key expired/deleted: ${key}`)
      // All replicas automatically notified when cache expires
    }
  })
}
```

---

### 6. Other Services (No Caching)

**Services Without Caching:**
- ✅ `attachments.service.ts` - File uploads (no caching needed, uses Azure Blob Storage)
- ✅ `search.service.ts` - Search queries (no caching, always fresh results)
- ✅ `gdpr.service.ts` - GDPR exports (no caching, one-time operations)
- ✅ `reports.service.ts` - Abuse reports (no caching, admin operations)
- ✅ `sanitization.service.ts` - Input sanitization (no caching, stateless operations)

**Assessment:** ✅ These services correctly do NOT use caching

---

## Industry Best Practices Comparison

### WhatsApp/Telegram-Style Messaging Systems

**What They Do:**
1. **Multi-Level Caching**
   - L1: In-memory cache (Node.js process)
   - L2: Redis cache (shared across replicas)
   - L3: Database (PostgreSQL/MySQL)

2. **Cache Invalidation**
   - Pub/sub for cross-replica invalidation
   - Cache versioning (increment version on update)
   - TTL as safety net (5-15 minutes)

3. **Message Caching**
   - Cache last 50-100 messages per conversation
   - Use LRU eviction policy
   - Invalidate on edit/delete

4. **Presence & Typing**
   - TTL-based auto-expiration (5-10 seconds)
   - Heartbeat every 30 seconds
   - No manual invalidation

5. **Idempotency**
   - Cache idempotency keys for 24-48 hours
   - Clean up on successful delivery
   - Retry with exponential backoff

### Redis Caching Patterns

**Cache-Aside (Lazy Loading):**
```typescript
// ✅ GOOD: Our implementation
async getData(key: string) {
  const cached = await redis.get(key)
  if (cached) return JSON.parse(cached)

  const data = await database.query(...)
  await redis.setex(key, TTL, JSON.stringify(data))
  return data
}
```

**Write-Through:**
```typescript
// ✅ GOOD: Our idempotency implementation
async writeData(key: string, data: any) {
  await database.insert(data)
  await redis.setex(key, TTL, JSON.stringify(data))
}
```

**Write-Behind (Async):**
```typescript
// ❌ NOT USED: Could improve write performance
async writeData(key: string, data: any) {
  await redis.setex(key, TTL, JSON.stringify(data))
  queue.add(() => database.insert(data))  // Async write
}
```

### Distributed Systems Consistency Models

**Our Current Model: Eventual Consistency**
- ✅ High availability (replicas can serve stale data)
- ❌ Temporary inconsistency (5-minute window)
- ✅ Simple implementation

**Alternative: Strong Consistency**
- ✅ Always fresh data
- ❌ Lower availability (requires coordination)
- ❌ Complex implementation (distributed locks)

**Recommendation:** Keep eventual consistency, but reduce TTL to 1-2 minutes

---

## Actionable Recommendations

### Priority 1: Critical Fixes (Implement Immediately)

#### Recommendation #1: Fix Cache Invalidation for Provider Users
**Effort:** 2 hours
**Impact:** HIGH - Fixes stale data for provider users

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts

private async invalidateConversationCache(userId: string) {
  const filters = ['all', 'unread', 'archived', 'starred']

  // ✅ FIX: Detect provider users
  const providerId = await this.getProviderIdForUser(userId)

  // ✅ FIX: Use SCAN to delete all matching keys
  const pattern = `conversations:${userId}:*:${providerId || 'none'}`
  await this.deleteKeysByPattern(pattern)

  // ✅ FIX: Also invalidate count cache
  const countPattern = `conversations:count:${userId}:*:${providerId || 'none'}`
  await this.deleteKeysByPattern(countPattern)
}

private async deleteKeysByPattern(pattern: string) {
  const client = this.redis.getClient()
  let cursor = '0'
  const keysToDelete: string[] = []

  do {
    const [newCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
    cursor = newCursor
    keysToDelete.push(...keys)
  } while (cursor !== '0')

  if (keysToDelete.length > 0) {
    await client.del(...keysToDelete)
  }
}
```

#### Recommendation #2: Add Cross-Replica Cache Invalidation
**Effort:** 4 hours
**Impact:** CRITICAL - Fixes cache inconsistency in multi-replica deployments

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/messages.service.ts

async sendMessage(dto: SendMessageDto) {
  // ... existing code ...

  // ✅ FIX: Invalidate conversation cache locally
  const conversation = await this.prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  })

  const participantUserIds = conversation.participants.map(p => p.userId)
  for (const userId of participantUserIds) {
    await this.conversationsService.invalidateConversationCache(userId)
  }

  // ✅ FIX: Broadcast cache invalidation to all replicas
  await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
    userIds: participantUserIds,
    providerId: (conversation.metadata as any)?.providerId,
  })

  // ✅ FIX: Invalidate metrics cache
  await this.redis.del(`conversation:metrics:${conversationId}`)

  // Existing pub/sub broadcast
  await this.redisPubSub.publishMessage('messages:new', { ... })
}
```

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/redis-pub-sub.service.ts

private async subscribeToChannels() {
  const channels = [
    'messages:new',
    'messages:updated',
    // ... existing channels ...
    'cache:invalidate:conversations',  // ✅ NEW
    'cache:invalidate:messages',       // ✅ NEW
  ]

  await this.subscriber.subscribe(...channels)
}

private async handleRedisMessage(channel: string, message: string) {
  const data = JSON.parse(message)

  switch (channel) {
    case 'cache:invalidate:conversations':
      // ✅ NEW: Invalidate conversation cache on all replicas
      for (const userId of data.userIds) {
        await this.conversationsService.invalidateConversationCache(userId)
      }

      // Invalidate provider users' cache
      if (data.providerId) {
        const providerUsers = await this.getProviderUsers(data.providerId)
        for (const user of providerUsers) {
          await this.conversationsService.invalidateConversationCache(user.id)
        }
      }
      break

    case 'cache:invalidate:messages':
      // ✅ NEW: Invalidate message cache on all replicas
      await this.messagesService.invalidateMessageCache(data.conversationId)
      break

    // ... existing cases ...
  }
}
```

#### Recommendation #3: Replace KEYS with SCAN in Typing Service
**Effort:** 1 hour
**Impact:** HIGH - Prevents Redis blocking in production

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/typing.service.ts

async getTypingUsers(conversationId: string): Promise<TypingIndicator[]> {
  try {
    const client = this.redis.getClient()
    const pattern = `typing:${conversationId}:*`
    const keys: string[] = []
    let cursor = '0'

    // ✅ FIX: Use SCAN instead of KEYS
    do {
      const [newCursor, matchedKeys] = await client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      )
      cursor = newCursor
      keys.push(...matchedKeys)
    } while (cursor !== '0')

    if (keys.length === 0) {
      return []
    }

    // Get all typing data in one pipeline operation
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

    return typingUsers
  } catch (error) {
    this.logger.error(`Failed to get typing users for conversation ${conversationId}:`, error)
    return []
  }
}
```

### Priority 2: High-Impact Improvements (Implement Within 1 Week)

#### Recommendation #4: Fix N+1 Query Problem
**Effort:** 2 hours
**Impact:** HIGH - 20x performance improvement for conversation loading

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts

async getConversations(dto: GetConversationsDto) {
  // ... existing code to fetch conversations ...

  // ✅ FIX: Collect all unique provider IDs
  const providerIds = new Set<string>()
  for (const conv of conversations) {
    const metadata = conv.metadata as { providerId?: string } | null
    if (conv.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
      providerIds.add(metadata.providerId)
    }
  }

  // ✅ FIX: Batch load all providers in ONE query
  const providers = await this.prisma.provider.findMany({
    where: { id: { in: Array.from(providerIds) } },
    select: { id: true, legalCompanyName: true, email: true },
  })

  // Create lookup map
  const providerMap = new Map(providers.map(p => [p.id, p]))

  // ✅ FIX: Enrich conversations using in-memory map
  const enrichedConversations = conversations.map(conv => {
    const metadata = conv.metadata as { providerId?: string } | null
    if (conv.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
      const provider = providerMap.get(metadata.providerId)
      if (provider) {
        const virtualParticipant = {
          id: `virtual-${provider.id}`,
          conversationId: conv.id,
          userId: provider.id,
          providerId: provider.id,
          pinned: false,
          pinnedAt: null,
          starred: false,
          muted: false,
          archived: false,
          archivedAt: null,
          lastReadAt: null,
          unreadCount: 0,
          joinedAt: conv.createdAt,
          leftAt: null,
          isRateLimited: false,
          rateLimitExpiresAt: null,
          user: null,
          provider: provider,
        } as any

        return {
          ...conv,
          participants: [...conv.participants, virtualParticipant],
        }
      }
    }
    return conv
  })

  // Cache the result
  await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(enrichedConversations))
  return enrichedConversations
}
```

#### Recommendation #5: Add Message-Level Caching
**Effort:** 4 hours
**Impact:** MEDIUM - Reduces database load for frequently accessed conversations

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/messages.service.ts

async getMessages(dto: GetMessagesDto) {
  const { conversationId, limit = 50, cursor, direction = 'before' } = dto

  // ✅ NEW: Try cache first
  const cacheKey = `messages:${conversationId}:${limit}:${cursor || 'initial'}:${direction}`
  const cached = await this.redis.get(cacheKey)
  if (cached) {
    this.logger.debug(`Cache hit for messages: ${cacheKey}`)
    return JSON.parse(cached)
  }

  // ... existing database query code ...

  const result = {
    data,
    nextCursor,
    hasMore,
  }

  // ✅ NEW: Cache for 5 minutes
  await this.redis.setex(cacheKey, 300, JSON.stringify(result))

  return result
}

// ✅ NEW: Invalidate message cache
async invalidateMessageCache(conversationId: string) {
  const pattern = `messages:${conversationId}:*`
  await this.deleteKeysByPattern(pattern)
}

// ✅ NEW: Call invalidation on edits/deletes
async editMessage(dto: EditMessageDto) {
  // ... existing code ...

  await this.invalidateMessageCache(message.conversationId)
  await this.redisPubSub.publishMessage('messages:updated', { ... })
  await this.redisPubSub.publishMessage('cache:invalidate:messages', {
    conversationId: message.conversationId,
  })
}

async deleteMessage(dto: DeleteMessageDto) {
  // ... existing code ...

  await this.invalidateMessageCache(message.conversationId)
}
```

#### Recommendation #6: Add Metrics Cache Invalidation
**Effort:** 1 hour
**Impact:** MEDIUM - Fixes stale metrics display

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/messages.service.ts

async sendMessage(dto: SendMessageDto) {
  // ... existing code ...

  // ✅ NEW: Invalidate metrics cache
  await this.redis.del(`conversation:metrics:${conversationId}`)
}

async markAsRead(dto: MarkAsReadDto) {
  // ... existing code ...

  // ✅ NEW: Invalidate metrics cache
  await this.redis.del(`conversation:metrics:${result.message.conversationId}`)
}
```

### Priority 3: Nice-to-Have Improvements (Implement Within 1 Month)

#### Recommendation #7: Add Cache Hit/Miss Metrics
**Effort:** 2 hours
**Impact:** LOW - Improves observability

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts

async getConversations(dto: GetConversationsDto) {
  const cacheKey = `conversations:${userId}:${filter}:${limit}:${offset}:${providerId || 'none'}`
  const cached = await this.redis.get(cacheKey)

  if (cached) {
    // ✅ NEW: Track cache hit
    this.logger.debug(`Cache hit: ${cacheKey}`)
    // TODO: Send metric to monitoring system (e.g., Prometheus, DataDog)
    return JSON.parse(cached)
  }

  // ✅ NEW: Track cache miss
  this.logger.debug(`Cache miss: ${cacheKey}`)
  // TODO: Send metric to monitoring system

  // ... fetch from database ...
}
```

#### Recommendation #8: Add Cache Warming on Deployment
**Effort:** 3 hours
**Impact:** LOW - Reduces latency spikes after deployment

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/cache-warming.service.ts

@Injectable()
export class CacheWarmingService implements OnModuleInit {
  async onModuleInit() {
    // Warm cache for most active users
    const activeUsers = await this.getActiveUsers(limit: 100)

    for (const user of activeUsers) {
      // Pre-load conversation lists
      await this.conversationsService.getConversations({
        userId: user.id,
        filter: 'all',
        limit: 50,
        offset: 0,
      })
    }
  }
}
```

---

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)

**Tasks:**
1. ✅ Fix cache invalidation for provider users (Recommendation #1)
2. ✅ Add cross-replica cache invalidation (Recommendation #2)
3. ✅ Replace KEYS with SCAN in typing service (Recommendation #3)

**Testing:**
- Manual testing with provider users
- Load testing with multiple replicas
- Verify cache invalidation across replicas

**Success Criteria:**
- Provider users see fresh data after updates
- No Redis blocking during typing indicator queries
- Cache consistent across all replicas

### Phase 2: Performance Improvements (Week 2)

**Tasks:**
1. ✅ Fix N+1 query problem (Recommendation #4)
2. ✅ Add message-level caching (Recommendation #5)
3. ✅ Add metrics cache invalidation (Recommendation #6)

**Testing:**
- Performance testing with 1000+ conversations
- Measure query time before/after N+1 fix
- Verify message cache invalidation

**Success Criteria:**
- Conversation loading 20x faster
- Message queries use cache (>80% hit rate)
- Metrics always show fresh data

### Phase 3: Observability (Week 3-4)

**Tasks:**
1. ✅ Add cache hit/miss metrics (Recommendation #7)
2. ✅ Add cache warming (Recommendation #8)
3. ✅ Add cache size monitoring
4. ✅ Add alerting for cache failures

**Testing:**
- Monitor cache metrics in production
- Verify cache warming reduces cold start latency
- Test alerting for cache failures

**Success Criteria:**
- Cache hit rate >80%
- Cold start latency <100ms
- Alerts trigger on cache failures

---

## Testing Strategy

### Unit Tests

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/conversations.service.spec.ts

describe('ConversationsService - Cache Invalidation', () => {
  it('should invalidate cache for provider users', async () => {
    // Arrange
    const userId = 'user123'
    const providerId = 'provider456'
    jest.spyOn(service, 'getProviderIdForUser').mockResolvedValue(providerId)

    // Act
    await service.invalidateConversationCache(userId)

    // Assert
    expect(redis.del).toHaveBeenCalledWith(
      expect.stringContaining(`:${providerId}`)
    )
  })

  it('should use SCAN instead of KEYS', async () => {
    // Arrange
    const pattern = 'conversations:user123:*'

    // Act
    await service.deleteKeysByPattern(pattern)

    // Assert
    expect(redis.scan).toHaveBeenCalled()
    expect(redis.keys).not.toHaveBeenCalled()
  })
})
```

### Integration Tests

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/messages.service.integration.spec.ts

describe('MessagesService - Cross-Replica Cache Invalidation', () => {
  it('should invalidate cache on all replicas after sending message', async () => {
    // Arrange: Simulate 2 replicas
    const replica1 = await createTestReplica()
    const replica2 = await createTestReplica()

    // Act: Send message on replica 1
    await replica1.messagesService.sendMessage({ ... })

    // Wait for pub/sub propagation
    await sleep(100)

    // Assert: Cache invalidated on replica 2
    const cached = await replica2.redis.get('conversations:user123:all:50:0:none')
    expect(cached).toBeNull()
  })
})
```

### Load Tests

```bash
# Test cache performance under load
k6 run --vus 100 --duration 60s load-tests/cache-performance.js

# Expected results:
# - Cache hit rate: >80%
# - P95 latency: <100ms
# - No Redis blocking
```

### Manual Testing Checklist

- [ ] Provider user creates conversation → appears in inbox immediately
- [ ] User sends message → conversation list updates on all devices
- [ ] User edits message → message cache invalidated
- [ ] User marks as read → unread count updates immediately
- [ ] Typing indicators work across replicas
- [ ] Presence status updates across replicas
- [ ] Cache survives Redis restart (TTL-based recovery)
- [ ] No stale data after 5-minute TTL

---

## Conclusion

This audit identified **12 cache-related issues** across the messaging system, with **3 critical issues** requiring immediate attention:

1. **Cache invalidation missing providerId** - Causes stale data for provider users
2. **No cross-replica cache invalidation** - Causes inconsistency in multi-replica deployments
3. **No conversation cache invalidation after sending messages** - Causes stale conversation lists

**Recommended Action Plan:**
1. **Week 1:** Implement critical fixes (Recommendations #1-3)
2. **Week 2:** Implement performance improvements (Recommendations #4-6)
3. **Week 3-4:** Add observability and monitoring (Recommendations #7-8)

**Expected Impact:**
- ✅ Eliminate stale data issues for provider users
- ✅ Ensure cache consistency across all replicas
- ✅ 20x performance improvement for conversation loading
- ✅ Reduce database load by 80% with message caching
- ✅ Prevent Redis blocking with SCAN instead of KEYS

---

**Document Version:** 1.0
**Last Updated:** 2026-02-16
**Next Review:** 2026-03-16

---

## Cache Invalidation on CREATE Operations

This section audits cache invalidation patterns for **CREATE operations** across the entire messaging system. The focus is on identifying scenarios where newly created entities are not properly reflected in cached data, leading to stale empty arrays or missing newly created items.

### Critical Bug Scenario

**The Empty → Non-Empty Transition Problem:**

1. User calls `GET /conversations` → API returns empty array `[]` and caches it
2. User calls `POST /conversations` → Creates a new conversation
3. User calls `GET /conversations` again → API returns cached empty array `[]` (**STALE DATA**)
4. Expected behavior: API should return the newly created conversation

This pattern affects ALL CREATE operations across the messaging system.

---

### Summary Table: CREATE Operations Cache Invalidation Status

| Entity | CREATE Operation | Cache Invalidated? | Cross-User Invalidation? | Provider Invalidation? | Severity |
|--------|------------------|-------------------|-------------------------|----------------------|----------|
| **Conversations** | `createConversation()` | ⚠️ Partial | ❌ No | ❌ No | **CRITICAL** |
| **Messages** | `sendMessage()` | ❌ No | ❌ No | ❌ No | **CRITICAL** |
| **Read Receipts** | `markAsRead()` | ❌ No | ❌ No | ❌ No | **HIGH** |
| **Delivery Receipts** | `markAsDelivered()` | ❌ No | ❌ No | ❌ No | **MEDIUM** |
| **Reactions** | `addReaction()` | ❌ No | ❌ No | ❌ No | **MEDIUM** |
| **Bookmarks** | `bookmarkMessage()` | ❌ No | N/A | N/A | **LOW** |
| **Pins** | `pinMessage()` | ❌ No | ❌ No | ❌ No | **MEDIUM** |
| **Typing Indicators** | `startTyping()` | ✅ Yes (TTL) | N/A | N/A | **N/A** |
| **Presence Status** | `setOnline()` | ✅ Yes (TTL) | N/A | N/A | **N/A** |

**Legend:**
- ✅ Yes - Cache properly invalidated
- ⚠️ Partial - Some cache invalidated, but incomplete
- ❌ No - Cache NOT invalidated
- N/A - Not applicable

---

### Entity: Conversations

#### CREATE Operation: `createConversation()`

**Location:** `apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts` (lines 42-133)

**Current Implementation:**

<augment_code_snippet path="apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts" mode="EXCERPT">
````typescript
async createConversation(dto: CreateConversationDto) {
  // ... create conversation in database ...

  // Line 130: Invalidate cache for creator only
  await this.invalidateConversationCache(userId)

  return conversation
}
````
</augment_code_snippet>

**Problems:**

1. ❌ **Does NOT invalidate cache for other participant (User B or provider users)**
   - User A creates conversation with User B
   - Only User A's cache is invalidated
   - User B still sees cached empty array `[]`

2. ❌ **Does NOT invalidate conversation count cache**
   - Cache key: `conversations:count:{userId}:{filter}:{providerId}`
   - Count remains stale until 5-minute TTL expires

3. ❌ **Missing `providerId` in invalidation** (already documented in Issue #4)
   - Provider users' cache keys include `providerId`
   - Invalidation doesn't include `providerId` parameter

4. ❌ **No cross-replica cache invalidation**
   - Cache only invalidated on current replica
   - Other replicas serve stale data

**Bug Scenarios:**

**Scenario 1: User-to-User Conversation (Empty → Non-Empty)**
```
1. User A: GET /user/messaging/conversations → Returns [] (cached)
2. User B: GET /user/messaging/conversations → Returns [] (cached)
3. User A: POST /user/messaging/conversations (with User B) → Creates conversation
4. User A: GET /user/messaging/conversations → Returns [conversation] ✅ (cache invalidated)
5. User B: GET /user/messaging/conversations → Returns [] ❌ (STALE - cache NOT invalidated)
```

**Scenario 2: User-to-Provider Conversation**
```
1. User: GET /user/messaging/conversations → Returns [] (cached)
2. Provider User: GET /provider/messaging/conversations → Returns [] (cached)
3. User: POST /user/messaging/conversations (with Provider) → Creates conversation
4. User: GET /user/messaging/conversations → Returns [conversation] ✅
5. Provider User: GET /provider/messaging/conversations → Returns [] ❌ (STALE)
```

**Scenario 3: Multi-Replica Deployment**
```
1. User A on Replica 1: GET /conversations → Returns [] (cached on Replica 1)
2. User A on Replica 2: POST /conversations → Creates conversation, invalidates cache on Replica 2
3. Load balancer routes User A to Replica 1
4. User A on Replica 1: GET /conversations → Returns [] ❌ (STALE - Replica 1 cache not invalidated)
```

**Solution:**

```typescript
async createConversation(dto: CreateConversationDto) {
  const { userId, participantId, participantType, contextType, contextId, initialMessage } = dto

  // ... existing conversation creation code ...

  // ✅ FIX: Collect all users whose cache needs invalidation
  const userIdsToInvalidate: string[] = [userId]

  // ✅ FIX: Add other participant for USER_SUPERADMIN conversations
  if (participantType !== 'provider') {
    userIdsToInvalidate.push(participantId)
  }

  // ✅ FIX: Invalidate cache for all affected users
  for (const userIdToInvalidate of userIdsToInvalidate) {
    await this.invalidateConversationCache(userIdToInvalidate)
  }

  // ✅ FIX: For provider conversations, invalidate provider users' cache
  if (participantType === 'provider') {
    const providerId = participantId
    const providerUsers = await this.getProviderUsers(providerId)

    for (const providerUser of providerUsers) {
      await this.invalidateConversationCache(providerUser.id)
    }
  }

  // ✅ FIX: Broadcast cache invalidation to all replicas
  await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
    userIds: userIdsToInvalidate,
    providerId: participantType === 'provider' ? participantId : undefined,
  })

  return conversation
}

// ✅ FIX: Helper method to get provider users
private async getProviderUsers(providerId: string): Promise<{ id: string }[]> {
  // Get all users who are members of this provider organization
  const providerUsers = await this.prisma.user.findMany({
    where: {
      providerId: providerId,
      isActive: true,
    },
    select: { id: true },
  })

  return providerUsers
}
```

**Test Cases:**

```typescript
describe('ConversationsService - createConversation() Cache Invalidation', () => {
  it('should invalidate cache for both participants in user-to-user conversation', async () => {
    // Arrange
    const userA = 'user-a-id'
    const userB = 'user-b-id'

    // Pre-populate cache with empty arrays
    await redis.setex(`conversations:${userA}:all:50:0:none`, 300, JSON.stringify([]))
    await redis.setex(`conversations:${userB}:all:50:0:none`, 300, JSON.stringify([]))

    // Act
    await service.createConversation({
      userId: userA,
      participantId: userB,
      participantType: 'user',
    })

    // Assert
    const cacheA = await redis.get(`conversations:${userA}:all:50:0:none`)
    const cacheB = await redis.get(`conversations:${userB}:all:50:0:none`)

    expect(cacheA).toBeNull() // ✅ Cache invalidated for User A
    expect(cacheB).toBeNull() // ✅ Cache invalidated for User B
  })

  it('should invalidate cache for provider users in user-to-provider conversation', async () => {
    // Arrange
    const user = 'user-id'
    const providerId = 'provider-id'
    const providerUser1 = 'provider-user-1'
    const providerUser2 = 'provider-user-2'

    jest.spyOn(service as any, 'getProviderUsers').mockResolvedValue([
      { id: providerUser1 },
      { id: providerUser2 },
    ])

    // Pre-populate cache
    await redis.setex(`conversations:${user}:all:50:0:none`, 300, JSON.stringify([]))
    await redis.setex(`conversations:${providerUser1}:all:50:0:${providerId}`, 300, JSON.stringify([]))
    await redis.setex(`conversations:${providerUser2}:all:50:0:${providerId}`, 300, JSON.stringify([]))

    // Act
    await service.createConversation({
      userId: user,
      participantId: providerId,
      participantType: 'provider',
    })

    // Assert
    const cacheUser = await redis.get(`conversations:${user}:all:50:0:none`)
    const cacheProvider1 = await redis.get(`conversations:${providerUser1}:all:50:0:${providerId}`)
    const cacheProvider2 = await redis.get(`conversations:${providerUser2}:all:50:0:${providerId}`)

    expect(cacheUser).toBeNull() // ✅ User cache invalidated
    expect(cacheProvider1).toBeNull() // ✅ Provider user 1 cache invalidated
    expect(cacheProvider2).toBeNull() // ✅ Provider user 2 cache invalidated
  })

  it('should broadcast cache invalidation to all replicas', async () => {
    // Arrange
    const userA = 'user-a-id'
    const userB = 'user-b-id'
    const publishSpy = jest.spyOn(redisPubSub, 'publishMessage')

    // Act
    await service.createConversation({
      userId: userA,
      participantId: userB,
      participantType: 'user',
    })

    // Assert
    expect(publishSpy).toHaveBeenCalledWith('cache:invalidate:conversations', {
      userIds: [userA, userB],
      providerId: undefined,
    })
  })

  it('should invalidate conversation count cache', async () => {
    // Arrange
    const userId = 'user-id'

    // Pre-populate count cache
    await redis.setex(`conversations:count:${userId}:all:none`, 300, '0')
    await redis.setex(`conversations:count:${userId}:unread:none`, 300, '0')

    // Act
    await service.createConversation({
      userId,
      participantId: 'other-user',
      participantType: 'user',
    })

    // Assert
    const countAll = await redis.get(`conversations:count:${userId}:all:none`)
    const countUnread = await redis.get(`conversations:count:${userId}:unread:none`)

    expect(countAll).toBeNull() // ✅ Count cache invalidated
    expect(countUnread).toBeNull() // ✅ Count cache invalidated
  })
})
```

**Priority:** **CRITICAL**

**Estimated Effort:** 4 hours

**Impact:** HIGH - Affects all conversation creation flows, causes users to not see newly created conversations

---

### Entity: Messages

#### CREATE Operation: `sendMessage()`

**Location:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts` (lines 45-208)

**Current Implementation:**

<augment_code_snippet path="apps/wc-nest-api/src/modules/messaging/services/messages.service.ts" mode="EXCERPT">
````typescript
async sendMessage(dto: SendMessageDto) {
  // ... create message in transaction ...

  // Line 164: Cache idempotency key
  await this.redis.setex(cacheKey, this.IDEMPOTENCY_TTL, JSON.stringify(message))

  // Line 168: Publish to Redis for real-time delivery
  await this.redisPubSub.publishMessage('messages:new', { ... })

  // ❌ MISSING: No conversation cache invalidation
  // ❌ MISSING: No message cache invalidation
  // ❌ MISSING: No metrics cache invalidation

  return message
}
````
</augment_code_snippet>

**Problems:**

1. ❌ **Does NOT invalidate conversation cache for ANY participants**
   - Conversation list shows stale `lastMessage`
   - Conversation list shows stale `lastActivityAt`
   - Conversation list shows stale `messageCount`

2. ❌ **Does NOT invalidate message cache**
   - If message list is cached, new message doesn't appear
   - Affects `getMessages()` queries

3. ❌ **Does NOT invalidate conversation metrics cache**
   - Cache key: `conversation:metrics:{conversationId}`
   - Metrics show stale message count

4. ❌ **No cross-replica cache invalidation**
   - Pub/sub broadcasts message event but doesn't invalidate cache

**Bug Scenarios:**

**Scenario 1: First Message in Conversation (Empty → Non-Empty)**
```
1. User A: GET /conversations/{id}/messages → Returns [] (cached)
2. User B: POST /conversations/{id}/messages → Sends first message
3. User A: GET /conversations/{id}/messages → Returns [] ❌ (STALE - cache NOT invalidated)
4. User A: GET /conversations → Shows conversation with lastMessage = null ❌ (STALE)
```

**Scenario 2: Conversation List Not Updated**
```
1. User A: GET /conversations → Returns [{id: 1, lastMessage: "Hello", messageCount: 1}] (cached)
2. User B: POST /conversations/1/messages → Sends "How are you?"
3. User A: GET /conversations → Returns [{id: 1, lastMessage: "Hello", messageCount: 1}] ❌ (STALE)
4. Expected: [{id: 1, lastMessage: "How are you?", messageCount: 2}]
```

**Scenario 3: Metrics Show Stale Count**
```
1. Admin: GET /conversations/1/metrics → Returns {totalMessages: 5} (cached)
2. User: POST /conversations/1/messages → Sends message
3. Admin: GET /conversations/1/metrics → Returns {totalMessages: 5} ❌ (STALE)
4. Expected: {totalMessages: 6}
```

**Solution:**

```typescript
async sendMessage(dto: SendMessageDto) {
  const { conversationId, senderId, senderType, ... } = dto

  // ... existing message creation code ...

  // ✅ FIX: Get all participants for cache invalidation
  const conversation = await this.prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  })

  if (!conversation) {
    throw new NotFoundException('Conversation not found')
  }

  // ✅ FIX: Invalidate conversation cache for all participants
  const participantUserIds = conversation.participants.map(p => p.userId)
  for (const userId of participantUserIds) {
    await this.conversationsService.invalidateConversationCache(userId)
  }

  // ✅ FIX: For provider conversations, invalidate provider users' cache
  const metadata = conversation.metadata as { providerId?: string } | null
  if (conversation.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
    const providerUsers = await this.getProviderUsers(metadata.providerId)
    for (const providerUser of providerUsers) {
      await this.conversationsService.invalidateConversationCache(providerUser.id)
    }
  }

  // ✅ FIX: Invalidate message cache
  await this.invalidateMessageCache(conversationId)

  // ✅ FIX: Invalidate metrics cache
  await this.redis.del(`conversation:metrics:${conversationId}`)

  // ✅ FIX: Broadcast cache invalidation to all replicas
  await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
    userIds: participantUserIds,
    providerId: metadata?.providerId,
  })

  await this.redisPubSub.publishMessage('cache:invalidate:messages', {
    conversationId,
  })

  // Existing pub/sub broadcast
  await this.redisPubSub.publishMessage('messages:new', { ... })

  return message
}

// ✅ FIX: New helper method
private async invalidateMessageCache(conversationId: string) {
  const pattern = `messages:${conversationId}:*`
  await this.deleteKeysByPattern(pattern)
}

private async deleteKeysByPattern(pattern: string) {
  const client = this.redis.getClient()
  let cursor = '0'
  const keysToDelete: string[] = []

  do {
    const [newCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
    cursor = newCursor
    keysToDelete.push(...keys)
  } while (cursor !== '0')

  if (keysToDelete.length > 0) {
    await client.del(...keysToDelete)
  }
}
```

**Test Cases:**

```typescript
describe('MessagesService - sendMessage() Cache Invalidation', () => {
  it('should invalidate conversation cache for all participants', async () => {
    // Arrange
    const conversationId = 'conv-id'
    const userA = 'user-a'
    const userB = 'user-b'

    // Pre-populate cache
    await redis.setex(`conversations:${userA}:all:50:0:none`, 300, JSON.stringify([
      { id: conversationId, lastMessage: 'Old message', messageCount: 1 }
    ]))
    await redis.setex(`conversations:${userB}:all:50:0:none`, 300, JSON.stringify([
      { id: conversationId, lastMessage: 'Old message', messageCount: 1 }
    ]))

    // Act
    await service.sendMessage({
      conversationId,
      senderId: userA,
      senderType: SenderType.USER,
      content: 'New message',
      idempotencyKey: 'test-key',
    })

    // Assert
    const cacheA = await redis.get(`conversations:${userA}:all:50:0:none`)
    const cacheB = await redis.get(`conversations:${userB}:all:50:0:none`)

    expect(cacheA).toBeNull() // ✅ User A cache invalidated
    expect(cacheB).toBeNull() // ✅ User B cache invalidated
  })

  it('should invalidate message cache', async () => {
    // Arrange
    const conversationId = 'conv-id'

    // Pre-populate message cache
    await redis.setex(`messages:${conversationId}:50:initial:before`, 300, JSON.stringify({
      data: [],
      nextCursor: null,
      hasMore: false,
    }))

    // Act
    await service.sendMessage({
      conversationId,
      senderId: 'user-a',
      senderType: SenderType.USER,
      content: 'First message',
      idempotencyKey: 'test-key',
    })

    // Assert
    const cache = await redis.get(`messages:${conversationId}:50:initial:before`)
    expect(cache).toBeNull() // ✅ Message cache invalidated
  })

  it('should invalidate metrics cache', async () => {
    // Arrange
    const conversationId = 'conv-id'

    // Pre-populate metrics cache
    await redis.setex(`conversation:metrics:${conversationId}`, 300, JSON.stringify({
      totalMessages: 5,
      unreadMessages: 2,
    }))

    // Act
    await service.sendMessage({
      conversationId,
      senderId: 'user-a',
      senderType: SenderType.USER,
      content: 'New message',
      idempotencyKey: 'test-key',
    })

    // Assert
    const cache = await redis.get(`conversation:metrics:${conversationId}`)
    expect(cache).toBeNull() // ✅ Metrics cache invalidated
  })

  it('should broadcast cache invalidation to all replicas', async () => {
    // Arrange
    const conversationId = 'conv-id'
    const publishSpy = jest.spyOn(redisPubSub, 'publishMessage')

    // Act
    await service.sendMessage({
      conversationId,
      senderId: 'user-a',
      senderType: SenderType.USER,
      content: 'Message',
      idempotencyKey: 'test-key',
    })

    // Assert
    expect(publishSpy).toHaveBeenCalledWith('cache:invalidate:conversations', expect.any(Object))
    expect(publishSpy).toHaveBeenCalledWith('cache:invalidate:messages', { conversationId })
  })
})
```

**Priority:** **CRITICAL**

**Estimated Effort:** 3 hours

**Impact:** CRITICAL - Affects all message sending, causes stale conversation lists and message lists

---

### Entity: Read Receipts

#### CREATE Operation: `markAsRead()`

**Location:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts` (lines 434-493)

**Current Implementation:**

<augment_code_snippet path="apps/wc-nest-api/src/modules/messaging/services/messages.service.ts" mode="EXCERPT">
````typescript
async markAsRead(dto: MarkAsReadDto) {
  // ... create read receipt in transaction ...
  // ... decrement unreadCount for participant ...

  // Line 483: Broadcast via pub/sub
  await this.redisPubSub.publishMessage('receipts:read', { ... })

  // ❌ MISSING: No conversation cache invalidation (unread count changed)
  // ❌ MISSING: No metrics cache invalidation

  return result.receipt
}
````
</augment_code_snippet>

**Problems:**

1. ❌ **Does NOT invalidate conversation cache**
   - Conversation list shows stale `unreadCount`
   - Filter `unread` shows conversations that have been read

2. ❌ **Does NOT invalidate metrics cache**
   - Metrics show stale unread message count

3. ❌ **No cross-replica cache invalidation**

**Bug Scenarios:**

**Scenario 1: Unread Count Not Updated**
```
1. User A: GET /conversations → Returns [{id: 1, unreadCount: 5}] (cached)
2. User A: POST /messages/{id}/read → Marks message as read
3. User A: GET /conversations → Returns [{id: 1, unreadCount: 5}] ❌ (STALE)
4. Expected: [{id: 1, unreadCount: 4}]
```

**Scenario 2: Unread Filter Shows Read Conversations**
```
1. User A: GET /conversations?filter=unread → Returns [conv1, conv2] (cached)
2. User A: POST /messages/conv1-msg/read → Marks all messages in conv1 as read
3. User A: GET /conversations?filter=unread → Returns [conv1, conv2] ❌ (STALE)
4. Expected: [conv2] (conv1 should be removed from unread filter)
```

**Solution:**

```typescript
async markAsRead(dto: MarkAsReadDto) {
  const { messageId, userId } = dto

  // ... existing transaction code ...

  // ✅ FIX: Invalidate conversation cache for user
  await this.conversationsService.invalidateConversationCache(userId)

  // ✅ FIX: Invalidate metrics cache
  await this.redis.del(`conversation:metrics:${result.message.conversationId}`)

  // ✅ FIX: Broadcast cache invalidation to all replicas
  await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
    userIds: [userId],
  })

  // Existing pub/sub broadcast
  await this.redisPubSub.publishMessage('receipts:read', { ... })

  return result.receipt
}
```

**Test Cases:**

```typescript
describe('MessagesService - markAsRead() Cache Invalidation', () => {
  it('should invalidate conversation cache when marking as read', async () => {
    // Arrange
    const userId = 'user-id'
    const messageId = 'message-id'

    // Pre-populate cache with unread conversation
    await redis.setex(`conversations:${userId}:all:50:0:none`, 300, JSON.stringify([
      { id: 'conv-1', unreadCount: 5 }
    ]))
    await redis.setex(`conversations:${userId}:unread:50:0:none`, 300, JSON.stringify([
      { id: 'conv-1', unreadCount: 5 }
    ]))

    // Act
    await service.markAsRead({ messageId, userId })

    // Assert
    const cacheAll = await redis.get(`conversations:${userId}:all:50:0:none`)
    const cacheUnread = await redis.get(`conversations:${userId}:unread:50:0:none`)

    expect(cacheAll).toBeNull() // ✅ All conversations cache invalidated
    expect(cacheUnread).toBeNull() // ✅ Unread filter cache invalidated
  })

  it('should invalidate metrics cache', async () => {
    // Arrange
    const conversationId = 'conv-id'
    const messageId = 'message-id'

    // Mock message lookup
    jest.spyOn(prisma.message, 'findUnique').mockResolvedValue({
      id: messageId,
      conversationId,
      senderId: 'sender-id',
    } as any)

    // Pre-populate metrics cache
    await redis.setex(`conversation:metrics:${conversationId}`, 300, JSON.stringify({
      totalMessages: 10,
      unreadMessages: 3,
    }))

    // Act
    await service.markAsRead({ messageId, userId: 'user-id' })

    // Assert
    const cache = await redis.get(`conversation:metrics:${conversationId}`)
    expect(cache).toBeNull() // ✅ Metrics cache invalidated
  })
})
```

**Priority:** **HIGH**

**Estimated Effort:** 2 hours

**Impact:** HIGH - Affects unread counts and unread filter, causes confusion for users

---

### Entity: Reactions

#### CREATE Operation: `addReaction()`

**Location:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts` (lines 573-610)

**Current Implementation:**

<augment_code_snippet path="apps/wc-nest-api/src/modules/messaging/services/messages.service.ts" mode="EXCERPT">
````typescript
async addReaction(dto: AddReactionDto) {
  // Line 587: Create reaction
  const reaction = await this.prisma.messageReaction.create({ ... })

  // Line 596: Broadcast via pub/sub
  await this.redisPubSub.publishMessage('reactions:added', { ... })

  // ❌ MISSING: No message cache invalidation
  // ❌ MISSING: No reaction list cache invalidation

  return reaction
}
````
</augment_code_snippet>

**Problems:**

1. ❌ **Does NOT invalidate message cache**
   - Cached messages don't show new reactions
   - Reaction count remains stale

2. ❌ **Does NOT invalidate reaction list cache** (if implemented)

**Bug Scenarios:**

**Scenario 1: Reaction Not Visible in Message List**
```
1. User A: GET /conversations/{id}/messages → Returns [{id: msg1, reactions: []}] (cached)
2. User B: POST /messages/msg1/reactions → Adds 👍 reaction
3. User A: GET /conversations/{id}/messages → Returns [{id: msg1, reactions: []}] ❌ (STALE)
4. Expected: [{id: msg1, reactions: [{emoji: '👍', userId: 'user-b'}]}]
```

**Solution:**

```typescript
async addReaction(dto: AddReactionDto) {
  const { messageId, userId, emoji } = dto

  // ... existing code ...

  // ✅ FIX: Invalidate message cache
  await this.invalidateMessageCache(message.conversationId)

  // ✅ FIX: Broadcast cache invalidation
  await this.redisPubSub.publishMessage('cache:invalidate:messages', {
    conversationId: message.conversationId,
  })

  // Existing pub/sub broadcast
  await this.redisPubSub.publishMessage('reactions:added', { ... })

  return reaction
}
```

**Test Cases:**

```typescript
describe('MessagesService - addReaction() Cache Invalidation', () => {
  it('should invalidate message cache when adding reaction', async () => {
    // Arrange
    const conversationId = 'conv-id'
    const messageId = 'message-id'

    // Pre-populate message cache
    await redis.setex(`messages:${conversationId}:50:initial:before`, 300, JSON.stringify({
      data: [{ id: messageId, reactions: [] }],
      nextCursor: null,
      hasMore: false,
    }))

    // Act
    await service.addReaction({ messageId, userId: 'user-id', emoji: '👍' })

    // Assert
    const cache = await redis.get(`messages:${conversationId}:50:initial:before`)
    expect(cache).toBeNull() // ✅ Message cache invalidated
  })
})
```

**Priority:** **MEDIUM**

**Estimated Effort:** 1 hour

**Impact:** MEDIUM - Reactions don't appear until cache expires, but not critical functionality

---

### Entity: Bookmarks

#### CREATE Operation: `bookmarkMessage()`

**Location:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts` (lines 658-692)

**Current Implementation:**

<augment_code_snippet path="apps/wc-nest-api/src/modules/messaging/services/messages.service.ts" mode="EXCERPT">
````typescript
async bookmarkMessage(dto: BookmarkMessageDto) {
  // Line 671: Create bookmark
  const bookmark = await this.prisma.messageBookmark.create({ ... })

  // ❌ MISSING: No bookmark list cache invalidation
  // ❌ MISSING: No pub/sub broadcast

  return bookmark
}
````
</augment_code_snippet>

**Problems:**

1. ❌ **Does NOT invalidate bookmark list cache** (if implemented)
2. ❌ **Does NOT broadcast to pub/sub** (other devices won't see bookmark)

**Bug Scenarios:**

**Scenario 1: Bookmark Not Visible in Bookmark List**
```
1. User A on Device 1: GET /bookmarks → Returns [] (cached)
2. User A on Device 2: POST /messages/{id}/bookmark → Creates bookmark
3. User A on Device 1: GET /bookmarks → Returns [] ❌ (STALE)
4. Expected: [{messageId: 'msg-id', note: 'Important'}]
```

**Solution:**

```typescript
async bookmarkMessage(dto: BookmarkMessageDto) {
  const { messageId, userId, note } = dto

  // ... existing code ...

  // ✅ FIX: Invalidate bookmark list cache
  const cacheKey = `bookmarks:${userId}:*`
  await this.deleteKeysByPattern(cacheKey)

  // ✅ FIX: Broadcast bookmark event
  await this.redisPubSub.publishMessage('bookmarks:added', {
    messageId,
    userId,
    bookmarkId: bookmark.id,
    note,
  })

  return bookmark
}
```

**Priority:** **LOW**

**Estimated Effort:** 1 hour

**Impact:** LOW - Bookmarks are not frequently used, and refresh will fix

---

### Entity: Pins

#### CREATE Operation: `pinMessage()`

**Location:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts` (lines 771-825)

**Current Implementation:**

<augment_code_snippet path="apps/wc-nest-api/src/modules/messaging/services/messages.service.ts" mode="EXCERPT">
````typescript
async pinMessage(dto: PinMessageDto) {
  // Line 801: Update message (set isPinned = true)
  const updatedMessage = await this.prisma.message.update({ ... })

  // Line 816: Broadcast via pub/sub
  await this.redisPubSub.publishMessage('messages:pinned', { ... })

  // ❌ MISSING: No message cache invalidation
  // ❌ MISSING: No pinned messages list cache invalidation

  return updatedMessage
}
````
</augment_code_snippet>

**Problems:**

1. ❌ **Does NOT invalidate message cache**
   - Cached messages don't show pin status

2. ❌ **Does NOT invalidate pinned messages list cache** (if implemented)

**Solution:**

```typescript
async pinMessage(dto: PinMessageDto) {
  const { messageId, userId } = dto

  // ... existing code ...

  // ✅ FIX: Invalidate message cache
  await this.invalidateMessageCache(message.conversationId)

  // ✅ FIX: Invalidate pinned messages cache
  const pinnedCacheKey = `messages:pinned:${message.conversationId}`
  await this.redis.del(pinnedCacheKey)

  // ✅ FIX: Broadcast cache invalidation
  await this.redisPubSub.publishMessage('cache:invalidate:messages', {
    conversationId: message.conversationId,
  })

  // Existing pub/sub broadcast
  await this.redisPubSub.publishMessage('messages:pinned', { ... })

  return updatedMessage
}
```

**Priority:** **MEDIUM**

**Estimated Effort:** 1 hour

**Impact:** MEDIUM - Pinned messages are important for conversation context

---

### Entity: Typing Indicators

#### CREATE Operation: `startTyping()`

**Location:** `apps/wc-nest-api/src/modules/messaging/services/typing.service.ts` (lines 29-49)

**Current Implementation:**

<augment_code_snippet path="apps/wc-nest-api/src/modules/messaging/services/typing.service.ts" mode="EXCERPT">
````typescript
async startTyping(conversationId: string, userId: string, userName?: string) {
  const key = `typing:${conversationId}:${userId}`

  // ✅ GOOD: TTL-based auto-expiration (5 seconds)
  await this.redis.setex(key, this.TYPING_TTL, JSON.stringify(typingData))

  return true
}
````
</augment_code_snippet>

**Assessment:**

✅ **No Issues** - Typing indicators use TTL-based auto-expiration, which is the optimal approach for ephemeral data.

**Why This Works:**
- TTL automatically expires after 5 seconds
- No manual invalidation needed
- Clients refresh typing status every 3-4 seconds
- Simple and efficient

**Priority:** **N/A** (No changes needed)

---

### Entity: Presence Status

#### CREATE Operation: `setOnline()`

**Location:** `apps/wc-nest-api/src/modules/messaging/services/presence.service.ts` (lines 39-63)

**Current Implementation:**

<augment_code_snippet path="apps/wc-nest-api/src/modules/messaging/services/presence.service.ts" mode="EXCERPT">
````typescript
async setOnline(userId: string, deviceInfo?: string) {
  const presenceKey = `presence:${userId}`
  const lastSeenKey = `presence:lastseen:${userId}`

  // ✅ GOOD: TTL-based auto-expiration (5 minutes)
  await this.redis.setex(presenceKey, this.PRESENCE_TTL, JSON.stringify(presenceData))

  // ✅ GOOD: Separate last-seen with longer TTL (24 hours)
  await this.redis.setex(lastSeenKey, this.LAST_SEEN_TTL, new Date().toISOString())

  return true
}
````
</augment_code_snippet>

**Assessment:**

✅ **No Issues** - Presence status uses TTL-based auto-expiration with heartbeat pattern, which is optimal.

**Why This Works:**
- TTL automatically expires after 5 minutes if not refreshed
- Heartbeat every 4 minutes keeps status fresh
- Separate last-seen tracking with 24-hour TTL
- No manual invalidation needed

**Priority:** **N/A** (No changes needed)

---

### Entity: Delivery Receipts

#### CREATE Operation: `markAsDelivered()`

**Location:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts` (lines 499-565)

**Current Implementation:**

Similar to `markAsRead()`, this operation creates delivery receipts but does not invalidate any cache.

**Problems:**

1. ❌ **Does NOT invalidate conversation cache**
2. ❌ **Does NOT invalidate metrics cache**

**Solution:**

Same approach as `markAsRead()` - invalidate conversation cache and metrics cache.

**Priority:** **MEDIUM**

**Estimated Effort:** 1 hour

**Impact:** MEDIUM - Delivery status is less critical than read status

---

## Summary of CREATE Operation Cache Invalidation Issues

### Critical Issues Requiring Immediate Fix

| Issue | Affected Operations | Impact | Effort |
|-------|-------------------|--------|--------|
| **No conversation cache invalidation on message send** | `sendMessage()` | Users see stale conversation lists (wrong lastMessage, messageCount) | 3 hours |
| **No cross-user cache invalidation on conversation create** | `createConversation()` | Other participant doesn't see new conversation | 4 hours |
| **No provider user cache invalidation** | `createConversation()`, `sendMessage()` | Provider users see stale data | 2 hours |
| **No cross-replica cache invalidation** | All CREATE operations | Multi-replica deployments have inconsistent cache | 4 hours |

**Total Estimated Effort for Critical Fixes:** 13 hours (1.5 days)

### High Priority Issues

| Issue | Affected Operations | Impact | Effort |
|-------|-------------------|--------|--------|
| **No conversation cache invalidation on read** | `markAsRead()` | Unread counts remain stale | 2 hours |
| **No metrics cache invalidation** | `sendMessage()`, `markAsRead()`, `markAsDelivered()` | Metrics show stale counts | 1 hour |

**Total Estimated Effort for High Priority Fixes:** 3 hours

### Medium Priority Issues

| Issue | Affected Operations | Impact | Effort |
|-------|-------------------|--------|--------|
| **No message cache invalidation on reaction** | `addReaction()` | Reactions don't appear | 1 hour |
| **No message cache invalidation on pin** | `pinMessage()` | Pin status doesn't appear | 1 hour |
| **No delivery receipt cache invalidation** | `markAsDelivered()` | Delivery status stale | 1 hour |

**Total Estimated Effort for Medium Priority Fixes:** 3 hours

### Low Priority Issues

| Issue | Affected Operations | Impact | Effort |
|-------|-------------------|--------|--------|
| **No bookmark cache invalidation** | `bookmarkMessage()` | Bookmarks don't appear | 1 hour |

**Total Estimated Effort for Low Priority Fixes:** 1 hour

---

## Recommended Implementation Plan

### Phase 1: Critical Fixes (Week 1 - 13 hours)

**Goal:** Fix the most severe cache invalidation issues that affect core messaging functionality.

**Tasks:**

1. **Add cross-replica cache invalidation infrastructure** (4 hours)
   - Update `redis-pub-sub.service.ts` to handle cache invalidation events
   - Add `cache:invalidate:conversations` channel handler
   - Add `cache:invalidate:messages` channel handler
   - Test cross-replica invalidation

2. **Fix `sendMessage()` cache invalidation** (3 hours)
   - Invalidate conversation cache for all participants
   - Invalidate message cache
   - Invalidate metrics cache
   - Broadcast invalidation to all replicas
   - Add unit tests

3. **Fix `createConversation()` cache invalidation** (4 hours)
   - Invalidate cache for all participants (including User B)
   - Invalidate cache for provider users
   - Include `providerId` in invalidation
   - Broadcast invalidation to all replicas
   - Add unit tests

4. **Add provider user cache invalidation helper** (2 hours)
   - Create `getProviderUsers()` helper method
   - Update all operations to invalidate provider users' cache
   - Add caching for provider user lookups

**Success Criteria:**
- ✅ New conversations appear for all participants immediately
- ✅ New messages update conversation lists immediately
- ✅ Provider users see fresh data
- ✅ Cache consistent across all replicas

### Phase 2: High Priority Fixes (Week 2 - 3 hours)

**Goal:** Fix cache invalidation for read receipts and metrics.

**Tasks:**

1. **Fix `markAsRead()` cache invalidation** (2 hours)
   - Invalidate conversation cache (unread count changed)
   - Invalidate metrics cache
   - Broadcast invalidation to all replicas
   - Add unit tests

2. **Add metrics cache invalidation to all operations** (1 hour)
   - Update `sendMessage()` to invalidate metrics
   - Update `markAsRead()` to invalidate metrics
   - Update `markAsDelivered()` to invalidate metrics

**Success Criteria:**
- ✅ Unread counts update immediately
- ✅ Unread filter shows correct conversations
- ✅ Metrics always show fresh data

### Phase 3: Medium Priority Fixes (Week 3 - 3 hours)

**Goal:** Fix cache invalidation for reactions, pins, and delivery receipts.

**Tasks:**

1. **Fix `addReaction()` cache invalidation** (1 hour)
   - Invalidate message cache
   - Broadcast invalidation to all replicas

2. **Fix `pinMessage()` cache invalidation** (1 hour)
   - Invalidate message cache
   - Invalidate pinned messages cache
   - Broadcast invalidation to all replicas

3. **Fix `markAsDelivered()` cache invalidation** (1 hour)
   - Invalidate conversation cache
   - Invalidate metrics cache

**Success Criteria:**
- ✅ Reactions appear immediately
- ✅ Pin status updates immediately
- ✅ Delivery status updates immediately

### Phase 4: Low Priority Fixes (Week 4 - 1 hour)

**Goal:** Fix remaining cache invalidation issues.

**Tasks:**

1. **Fix `bookmarkMessage()` cache invalidation** (1 hour)
   - Invalidate bookmark list cache
   - Add pub/sub broadcast

**Success Criteria:**
- ✅ Bookmarks appear immediately across all devices

---

## Testing Strategy for CREATE Operations

### Unit Tests

Create comprehensive unit tests for each CREATE operation to verify cache invalidation:

```typescript
// File: apps/wc-nest-api/src/modules/messaging/services/__tests__/cache-invalidation.spec.ts

describe('Messaging System - CREATE Operations Cache Invalidation', () => {
  describe('Empty → Non-Empty Transitions', () => {
    it('should invalidate cached empty conversation list when creating first conversation', async () => {
      // Arrange: Cache empty array
      const userId = 'user-id'
      await redis.setex(`conversations:${userId}:all:50:0:none`, 300, JSON.stringify([]))

      // Act: Create first conversation
      await conversationsService.createConversation({
        userId,
        participantId: 'other-user',
        participantType: 'user',
      })

      // Assert: Cache invalidated
      const cache = await redis.get(`conversations:${userId}:all:50:0:none`)
      expect(cache).toBeNull()
    })

    it('should invalidate cached empty message list when sending first message', async () => {
      // Arrange: Cache empty array
      const conversationId = 'conv-id'
      await redis.setex(`messages:${conversationId}:50:initial:before`, 300, JSON.stringify({
        data: [],
        nextCursor: null,
        hasMore: false,
      }))

      // Act: Send first message
      await messagesService.sendMessage({
        conversationId,
        senderId: 'user-id',
        senderType: SenderType.USER,
        content: 'First message',
        idempotencyKey: 'test-key',
      })

      // Assert: Cache invalidated
      const cache = await redis.get(`messages:${conversationId}:50:initial:before`)
      expect(cache).toBeNull()
    })
  })

  describe('Cross-User Cache Invalidation', () => {
    it('should invalidate cache for both users when creating conversation', async () => {
      // Test implementation from earlier
    })

    it('should invalidate cache for all participants when sending message', async () => {
      // Test implementation from earlier
    })
  })

  describe('Provider Conversations', () => {
    it('should invalidate provider users cache when creating provider conversation', async () => {
      // Test implementation from earlier
    })

    it('should invalidate provider users cache when sending message', async () => {
      // Test implementation from earlier
    })
  })

  describe('Cross-Replica Cache Invalidation', () => {
    it('should broadcast cache invalidation events to all replicas', async () => {
      // Test implementation from earlier
    })
  })
})
```

### Integration Tests

Test cache invalidation in multi-replica scenarios:

```typescript
// File: apps/wc-nest-api/src/modules/messaging/__tests__/cache-invalidation.integration.spec.ts

describe('Messaging System - Multi-Replica Cache Invalidation', () => {
  let replica1: TestReplica
  let replica2: TestReplica

  beforeEach(async () => {
    replica1 = await createTestReplica()
    replica2 = await createTestReplica()
  })

  it('should invalidate cache on all replicas when creating conversation', async () => {
    // Arrange: Cache empty array on both replicas
    const userId = 'user-id'
    await replica1.redis.setex(`conversations:${userId}:all:50:0:none`, 300, JSON.stringify([]))
    await replica2.redis.setex(`conversations:${userId}:all:50:0:none`, 300, JSON.stringify([]))

    // Act: Create conversation on replica 1
    await replica1.conversationsService.createConversation({
      userId,
      participantId: 'other-user',
      participantType: 'user',
    })

    // Wait for pub/sub propagation
    await sleep(100)

    // Assert: Cache invalidated on both replicas
    const cache1 = await replica1.redis.get(`conversations:${userId}:all:50:0:none`)
    const cache2 = await replica2.redis.get(`conversations:${userId}:all:50:0:none`)

    expect(cache1).toBeNull()
    expect(cache2).toBeNull()
  })
})
```

### Manual Testing Checklist

- [ ] **Empty → Non-Empty Transitions**
  - [ ] Create first conversation → appears immediately
  - [ ] Send first message → appears immediately
  - [ ] Add first reaction → appears immediately

- [ ] **Cross-User Cache Invalidation**
  - [ ] User A creates conversation with User B → User B sees it immediately
  - [ ] User A sends message → User B's conversation list updates immediately

- [ ] **Provider Conversations**
  - [ ] User creates conversation with provider → provider users see it immediately
  - [ ] Provider sends message → user's conversation list updates immediately

- [ ] **Multi-Replica Scenarios**
  - [ ] Create conversation on Replica 1 → visible on Replica 2 immediately
  - [ ] Send message on Replica 1 → conversation list updates on Replica 2

- [ ] **Cache Filters**
  - [ ] Mark message as read → unread filter updates immediately
  - [ ] Archive conversation → archived filter updates immediately

---

## Conclusion

This audit identified **critical cache invalidation issues** affecting CREATE operations across the messaging system. The most severe issue is the **Empty → Non-Empty transition problem**, where cached empty arrays remain stale after creating new entities.

**Key Findings:**

1. **6 out of 9 CREATE operations** have missing or incomplete cache invalidation
2. **0 operations** properly invalidate cache for other users (cross-user invalidation)
3. **0 operations** properly invalidate cache across replicas (cross-replica invalidation)
4. **2 operations** (typing, presence) use optimal TTL-based approach and require no changes

**Recommended Action:**

Implement the 4-phase plan over 4 weeks (20 hours total effort) to fix all cache invalidation issues:

- **Week 1 (13 hours):** Critical fixes - cross-replica infrastructure, sendMessage, createConversation
- **Week 2 (3 hours):** High priority - markAsRead, metrics invalidation
- **Week 3 (3 hours):** Medium priority - reactions, pins, delivery receipts
- **Week 4 (1 hour):** Low priority - bookmarks

**Expected Impact:**

- ✅ Eliminate all stale data issues for CREATE operations
- ✅ Ensure cache consistency across all replicas
- ✅ Improve user experience (no more "refresh to see new data")
- ✅ Reduce support tickets related to missing messages/conversations

---

**Section Version:** 1.0
**Last Updated:** 2026-02-16
**Related Issues:** #4, #5, #6, #10 from main audit


