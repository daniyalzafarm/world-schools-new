# Consolidated Cache Implementation Plan

**Date:** 2026-02-16
**Source:** CACHE_STRATEGY_AUDIT.md (Merged from 2 implementation plans)
**Total Effort:** 34 hours (4.25 days)
**Total Issues:** 13 unique cache-related issues

---

## Executive Summary

This consolidated plan merges two implementation plans from the cache audit:
1. **Original Implementation Plan** - General cache improvements (Issues #1-12)
2. **CREATE Operations Plan** - Cache invalidation for CREATE operations

The plan eliminates duplication and organizes work into 5 sequential phases based on priority and dependencies.

---

## Issue Mapping & Deduplication

### All 12 Issues Identified

**Critical Issues (3):**
- **Issue #1** - No conversation cache invalidation after sending messages (`sendMessage()`)
- **Issue #2** - No cache invalidation across replicas (all operations)
- **Issue #3** - No cross-user cache invalidation on conversation create (`createConversation()`)

**High Priority Issues (4):**
- **Issue #4** - Cache invalidation missing `providerId` parameter
- **Issue #5** - Incomplete cache invalidation (only specific filter/limit/offset combinations)
- **Issue #6** - No metrics cache invalidation on updates
- **Issue #7** - N+1 query problem for provider enrichment

**Medium Priority Issues (3):**
- **Issue #8** - No message-level caching
- **Issue #9** - Idempotency cache not cleaned up on errors
- **Issue #10** - KEYS command used in typing service (blocking)

**Low Priority Issues (3):**
- **Issue #11** - No cache hit/miss metrics
- **Issue #12** - No cache warming strategy
- **Issue #13** - No cache size monitoring (risk of memory exhaustion)

### Additional CREATE Operations (from CREATE Plan)
- **markAsRead()** - No cache invalidation (HIGH priority)
- **addReaction()** - No message cache invalidation (MEDIUM priority)
- **pinMessage()** - No message cache invalidation (MEDIUM priority)
- **markAsDelivered()** - No cache invalidation (MEDIUM priority)
- **bookmarkMessage()** - No cache invalidation (LOW priority)

---

## Phase 1: Foundation - Cross-Replica Infrastructure (CRITICAL)

**Priority:** CRITICAL  
**Effort:** 6 hours  
**Dependencies:** None (must be completed first)  
**Addresses:** Issue #2, Issue #4, Issue #5

### Objective
Build the infrastructure for cross-replica cache invalidation and fix foundational cache invalidation issues.

### Task 1.1: Add Cache Invalidation Channels to Pub/Sub (2 hours)

**File:** `apps/wc-nest-api/src/modules/messaging/services/redis-pub-sub.service.ts`

**Changes:**

1. Add new channels to subscription list in `subscribeToChannels()`:

```typescript
private async subscribeToChannels() {
  const channels = [
    'messages:new',
    'messages:updated',
    'messages:deleted',
    'reactions:added',
    'reactions:removed',
    'receipts:delivered',
    'receipts:read',
    'messages:pinned',
    'messages:unpinned',
    // ✅ NEW: Cache invalidation channels
    'cache:invalidate:conversations',
    'cache:invalidate:messages',
    'cache:invalidate:metrics',
  ]

  await this.subscriber.subscribe(...channels)
  this.logger.log(`Subscribed to ${channels.length} Redis channels`)
}
```

2. Add channel handlers in `handleRedisMessage()`:

```typescript
private async handleRedisMessage(channel: string, message: string) {
  try {
    const data = JSON.parse(message)

    switch (channel) {
      // ... existing cases ...

      case 'cache:invalidate:conversations':
        await this.handleConversationCacheInvalidation(data)
        break

      case 'cache:invalidate:messages':
        await this.handleMessageCacheInvalidation(data)
        break

      case 'cache:invalidate:metrics':
        await this.handleMetricsCacheInvalidation(data)
        break

      default:
        this.logger.warn(`Unknown channel: ${channel}`)
    }
  } catch (error) {
    this.logger.error(`Error handling Redis message on ${channel}`, error)
  }
}
```

3. Implement cache invalidation handlers:

```typescript
private async handleConversationCacheInvalidation(data: {
  userIds: string[]
  providerId?: string
}) {
  this.logger.debug(`Invalidating conversation cache for ${data.userIds.length} users`)

  // Invalidate cache for specified users
  for (const userId of data.userIds) {
    await this.conversationsService.invalidateConversationCache(userId)
  }

  // If providerId specified, invalidate cache for all provider users
  if (data.providerId) {
    const providerUsers = await this.getProviderUsers(data.providerId)
    for (const user of providerUsers) {
      await this.conversationsService.invalidateConversationCache(user.id)
    }
  }
}

private async handleMessageCacheInvalidation(data: { conversationId: string }) {
  this.logger.debug(`Invalidating message cache for conversation ${data.conversationId}`)
  await this.messagesService.invalidateMessageCache(data.conversationId)
}

private async handleMetricsCacheInvalidation(data: { conversationId: string }) {
  this.logger.debug(`Invalidating metrics cache for conversation ${data.conversationId}`)
  const metricsKey = `conversation:metrics:${data.conversationId}`
  await this.redis.del(metricsKey)
}

private async getProviderUsers(providerId: string): Promise<{ id: string }[]> {
  return await this.prisma.user.findMany({
    where: { providerId, isActive: true },
    select: { id: true },
  })
}
```

**Success Criteria:**
- ✅ Pub/sub service subscribes to 3 new cache invalidation channels
- ✅ Channel handlers properly invalidate cache on receiving events
- ✅ Provider users lookup works correctly

---

### Task 1.2: Fix Cache Invalidation with providerId and SCAN (4 hours)

**File:** `apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts`

**Changes:**

1. Add `deleteKeysByPattern()` helper method using SCAN (replaces KEYS):

```typescript
/**
 * Delete all Redis keys matching a pattern using SCAN (non-blocking)
 * @param pattern - Redis key pattern (e.g., "conversations:user123:*")
 */
private async deleteKeysByPattern(pattern: string): Promise<void> {
  const client = this.redis.getClient()
  let cursor = '0'
  const keysToDelete: string[] = []

  // Use SCAN instead of KEYS to avoid blocking Redis
  do {
    const [newCursor, keys] = await client.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      100  // Scan 100 keys per iteration
    )
    cursor = newCursor
    keysToDelete.push(...keys)
  } while (cursor !== '0')

  if (keysToDelete.length > 0) {
    await client.del(...keysToDelete)
    this.logger.debug(`Deleted ${keysToDelete.length} cache keys matching ${pattern}`)
  }
}
```

2. Add `getProviderIdForUser()` helper method:

```typescript
/**
 * Get providerId for a user if they are a provider user
 * @param userId - User ID to check
 * @returns providerId if user is a provider user, null otherwise
 */
private async getProviderIdForUser(userId: string): Promise<string | null> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { providerId: true },
  })
  return user?.providerId || null
}
```

3. Update `invalidateConversationCache()` to use SCAN and include providerId:

```typescript
/**
 * Invalidate all conversation cache entries for a user
 * Uses SCAN to find and delete all matching keys (non-blocking)
 * Includes providerId in cache key pattern
 */
private async invalidateConversationCache(userId: string): Promise<void> {
  // Detect if user is a provider user
  const providerId = await this.getProviderIdForUser(userId)

  // Delete all conversation list cache keys for this user
  // Pattern matches: conversations:userId:filter:limit:offset:providerId
  const pattern = `conversations:${userId}:*:${providerId || 'none'}`
  await this.deleteKeysByPattern(pattern)

  // Delete all count cache keys for this user
  // Pattern matches: conversations:count:userId:filter:providerId
  const countPattern = `conversations:count:${userId}:*:${providerId || 'none'}`
  await this.deleteKeysByPattern(countPattern)

  this.logger.debug(`Invalidated conversation cache for user ${userId}`)
}
```

**File:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`

**Changes:**

1. Add `invalidateMessageCache()` method:

```typescript
/**
 * Invalidate all message cache entries for a conversation
 * Uses SCAN to find and delete all matching keys (non-blocking)
 */
private async invalidateMessageCache(conversationId: string): Promise<void> {
  // Pattern matches: messages:conversationId:limit:cursor:direction
  const pattern = `messages:${conversationId}:*`
  await this.deleteKeysByPattern(pattern)

  this.logger.debug(`Invalidated message cache for conversation ${conversationId}`)
}
```

2. Add `deleteKeysByPattern()` method (same implementation as conversations service):

```typescript
/**
 * Delete all Redis keys matching a pattern using SCAN (non-blocking)
 * @param pattern - Redis key pattern (e.g., "messages:conv123:*")
 */
private async deleteKeysByPattern(pattern: string): Promise<void> {
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
    this.logger.debug(`Deleted ${keysToDelete.length} cache keys matching ${pattern}`)
  }
}
```

**Success Criteria:**
- ✅ SCAN-based pattern deletion works correctly (non-blocking)
- ✅ Conversation cache invalidation includes providerId
- ✅ Message cache invalidation deletes all pagination variants
- ✅ No KEYS commands used (all replaced with SCAN)

---

## Phase 2: Critical CREATE Operations (CRITICAL)

**Priority:** CRITICAL
**Effort:** 9 hours
**Dependencies:** Phase 1 (requires cross-replica infrastructure)
**Addresses:** Issue #1, Issue #3, Issue #6

### Objective
Fix cache invalidation for the most critical CREATE operations that affect core messaging functionality.

---

### Task 2.1: Fix sendMessage() Cache Invalidation (3 hours)

**File:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`
**Function:** `sendMessage()` (lines 45-208)

**Changes:**

Add cache invalidation logic after message creation (around line 164, after idempotency cache):

```typescript
async sendMessage(dto: SendMessageDto) {
  const { conversationId, senderId, senderType, content, idempotencyKey } = dto

  // ... existing idempotency check ...
  // ... existing transaction code ...
  // ... existing idempotency cache (line 164) ...

  // ✅ FIX: Get conversation with participants for cache invalidation
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

  await this.redisPubSub.publishMessage('cache:invalidate:metrics', {
    conversationId,
  })

  // Existing pub/sub broadcast (line 168)
  await this.redisPubSub.publishMessage('messages:new', { ... })

  return message
}
```

Add helper method to get provider users:

```typescript
/**
 * Get all active users for a provider organization
 * @param providerId - Provider organization ID
 * @returns Array of user objects with id
 */
private async getProviderUsers(providerId: string): Promise<{ id: string }[]> {
  return await this.prisma.user.findMany({
    where: {
      providerId: providerId,
      isActive: true,
    },
    select: { id: true },
  })
}
```

**Success Criteria:**
- ✅ Conversation cache invalidated for all participants
- ✅ Provider users' cache invalidated for provider conversations
- ✅ Message cache invalidated
- ✅ Metrics cache invalidated
- ✅ Cache invalidation broadcast to all replicas

---

### Task 2.2: Fix createConversation() Cache Invalidation (4 hours)

**File:** `apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts`
**Function:** `createConversation()` (lines 42-133)

**Changes:**

Add cache invalidation logic after conversation creation (around line 130, after existing invalidation):

```typescript
async createConversation(dto: CreateConversationDto) {
  const { userId, participantId, participantType, contextType, contextId, initialMessage } = dto

  // ... existing conversation creation code ...
  // ... existing transaction code ...

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
```

Add helper method to get provider users:

```typescript
/**
 * Get all active users for a provider organization
 * @param providerId - Provider organization ID
 * @returns Array of user objects with id
 */
private async getProviderUsers(providerId: string): Promise<{ id: string }[]> {
  return await this.prisma.user.findMany({
    where: {
      providerId: providerId,
      isActive: true,
    },
    select: { id: true },
  })
}
```

**Success Criteria:**
- ✅ Cache invalidated for conversation creator (User A)
- ✅ Cache invalidated for other participant (User B)
- ✅ Cache invalidated for all provider users in provider conversations
- ✅ Cache invalidation broadcast to all replicas
- ✅ Conversation count cache invalidated

---

### Task 2.3: Fix N+1 Query Problem for Provider Enrichment (2 hours)

**File:** `apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts`
**Function:** `getConversations()` (around lines 200-400)

**Changes:**

Replace the N+1 query pattern with batch loading:

```typescript
async getConversations(dto: GetConversationsDto) {
  const { userId, filter = 'all', limit = 50, offset = 0 } = dto

  // ... existing cache check code ...
  // ... existing database query code ...

  // ✅ FIX: Collect all unique provider IDs (avoid N+1 queries)
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
    select: {
      id: true,
      legalCompanyName: true,
      email: true,
      // Add other fields needed for virtual participant
    },
  })

  // Create lookup map for O(1) access
  const providerMap = new Map(providers.map(p => [p.id, p]))

  // ✅ FIX: Enrich conversations using in-memory map (no database queries)
  const enrichedConversations = conversations.map(conv => {
    const metadata = conv.metadata as { providerId?: string } | null
    if (conv.type === ConversationType.USER_PROVIDER && metadata?.providerId) {
      const provider = providerMap.get(metadata.providerId)
      if (provider) {
        // Create virtual participant for provider
        const virtualParticipant = {
          id: `provider-${provider.id}`,
          userId: provider.id,
          conversationId: conv.id,
          role: 'participant' as const,
          joinedAt: conv.createdAt,
          user: {
            id: provider.id,
            name: provider.legalCompanyName,
            email: provider.email,
            // Map other provider fields to user fields
          },
        }

        return {
          ...conv,
          participants: [...conv.participants, virtualParticipant],
        }
      }
    }
    return conv
  })

  // Cache the enriched result
  await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(enrichedConversations))
  return enrichedConversations
}
```

**Performance Impact:**
- **Before:** N separate queries (one per provider) = N × 10ms
- **After:** 1 batch query = 10ms
- **Improvement:** Up to 20x faster for conversations with 20 different providers

**Success Criteria:**
- ✅ Only 1 database query for all providers (no N+1)
- ✅ Provider enrichment still works correctly
- ✅ Virtual participants created properly
- ✅ Performance improvement measurable (20x faster)

---

## Phase 3: High Priority Fixes (HIGH)

**Priority:** HIGH
**Effort:** 6 hours
**Dependencies:** Phase 2
**Addresses:** Issue #6, markAsRead() cache invalidation

### Objective
Fix cache invalidation for read receipts and ensure metrics cache is always invalidated.

---

### Task 3.1: Fix markAsRead() Cache Invalidation (2 hours)

**File:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`
**Function:** `markAsRead()` (lines 434-493)

**Changes:**

Add cache invalidation logic after read receipt creation (around line 483, after pub/sub broadcast):

```typescript
async markAsRead(dto: MarkAsReadDto) {
  const { messageId, userId } = dto

  // ... existing transaction code ...
  // ... existing read receipt creation ...
  // ... existing unreadCount decrement ...

  // ✅ FIX: Invalidate conversation cache for user (unread count changed)
  await this.conversationsService.invalidateConversationCache(userId)

  // ✅ FIX: Invalidate metrics cache
  await this.redis.del(`conversation:metrics:${result.message.conversationId}`)

  // ✅ FIX: Broadcast cache invalidation to all replicas
  await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
    userIds: [userId],
  })

  await this.redisPubSub.publishMessage('cache:invalidate:metrics', {
    conversationId: result.message.conversationId,
  })

  // Existing pub/sub broadcast (line 483)
  await this.redisPubSub.publishMessage('receipts:read', { ... })

  return result.receipt
}
```

**Success Criteria:**
- ✅ Conversation cache invalidated (unread count updates)
- ✅ Unread filter shows correct conversations
- ✅ Metrics cache invalidated
- ✅ Cache invalidation broadcast to all replicas

---

### Task 3.2: Fix markAsDelivered() Cache Invalidation (1 hour)

**File:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`
**Function:** `markAsDelivered()` (lines 499-565)

**Changes:**

Add cache invalidation logic after delivery receipt creation:

```typescript
async markAsDelivered(dto: MarkAsDeliveredDto) {
  const { messageId, userId } = dto

  // ... existing transaction code ...
  // ... existing delivery receipt creation ...

  // ✅ FIX: Invalidate conversation cache for user
  await this.conversationsService.invalidateConversationCache(userId)

  // ✅ FIX: Invalidate metrics cache
  await this.redis.del(`conversation:metrics:${result.message.conversationId}`)

  // ✅ FIX: Broadcast cache invalidation to all replicas
  await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
    userIds: [userId],
  })

  await this.redisPubSub.publishMessage('cache:invalidate:metrics', {
    conversationId: result.message.conversationId,
  })

  // Existing pub/sub broadcast
  await this.redisPubSub.publishMessage('receipts:delivered', { ... })

  return result.receipt
}
```

**Success Criteria:**
- ✅ Conversation cache invalidated
- ✅ Metrics cache invalidated
- ✅ Delivery status updates immediately

---

### Task 3.3: Add Metrics Cache Invalidation to All Operations (3 hours)

**Objective:** Ensure metrics cache is invalidated whenever conversation data changes.

**Files to Update:**

1. **messages.service.ts** - Already covered in Tasks 2.1, 3.1, 3.2
2. **conversations.service.ts** - Add to update operations

**File:** `apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts`

**Changes:**

Add metrics cache invalidation to `updateConversation()`:

```typescript
async updateConversation(conversationId: string, dto: UpdateConversationDto) {
  // ... existing update code ...

  // ✅ FIX: Invalidate metrics cache
  await this.redis.del(`conversation:metrics:${conversationId}`)

  // ✅ FIX: Broadcast metrics cache invalidation
  await this.redisPubSub.publishMessage('cache:invalidate:metrics', {
    conversationId,
  })

  return updatedConversation
}
```

Add metrics cache invalidation to `archiveConversation()`:

```typescript
async archiveConversation(conversationId: string, userId: string) {
  // ... existing archive code ...

  // Invalidate conversation cache
  await this.invalidateConversationCache(userId)

  // ✅ FIX: Invalidate metrics cache
  await this.redis.del(`conversation:metrics:${conversationId}`)

  // ✅ FIX: Broadcast cache invalidation
  await this.redisPubSub.publishMessage('cache:invalidate:conversations', {
    userIds: [userId],
  })

  await this.redisPubSub.publishMessage('cache:invalidate:metrics', {
    conversationId,
  })

  return result
}
```

**Success Criteria:**
- ✅ Metrics cache invalidated on all conversation updates
- ✅ Metrics cache invalidated on message operations
- ✅ Metrics always show fresh data

---

## Phase 4: Medium Priority Fixes (MEDIUM)

**Priority:** MEDIUM
**Effort:** 8 hours
**Dependencies:** Phase 3
**Addresses:** Issue #8, Issue #9, Issue #10, addReaction(), pinMessage()

### Objective
Add message-level caching, fix idempotency error handling, replace KEYS with SCAN, and fix cache invalidation for reactions and pins.

---

### Task 4.1: Add Message-Level Caching (3 hours)

**File:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`
**Function:** `getMessages()` (around lines 210-280)

**Changes:**

Add cache-aside pattern to `getMessages()`:

```typescript
async getMessages(dto: GetMessagesDto) {
  const { conversationId, limit = 50, cursor, direction = 'before' } = dto

  // ✅ FIX: Check cache first
  const cacheKey = `messages:${conversationId}:${limit}:${cursor || 'initial'}:${direction}`
  const cached = await this.redis.get(cacheKey)
  if (cached) {
    this.logger.debug(`Cache hit for messages: ${cacheKey}`)
    return JSON.parse(cached)
  }

  // ... existing database query code ...

  const result = {
    data: messages,
    nextCursor,
    hasMore,
  }

  // ✅ FIX: Cache the result for 5 minutes (same as conversations)
  await this.redis.setex(cacheKey, 300, JSON.stringify(result))
  this.logger.debug(`Cached messages: ${cacheKey}`)

  return result
}
```

Add cache-aside pattern to `getMessageById()`:

```typescript
async getMessageById(messageId: string) {
  // ✅ FIX: Check cache first
  const cacheKey = `message:${messageId}`
  const cached = await this.redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  // ... existing database query code ...

  // ✅ FIX: Cache the result for 5 minutes
  await this.redis.setex(cacheKey, 300, JSON.stringify(message))

  return message
}
```

Update `editMessage()` to invalidate message cache:

```typescript
async editMessage(dto: EditMessageDto) {
  const { messageId, content } = dto

  // ... existing update code ...

  // ✅ FIX: Invalidate message cache
  await this.redis.del(`message:${messageId}`)
  await this.invalidateMessageCache(message.conversationId)

  // ✅ FIX: Broadcast cache invalidation
  await this.redisPubSub.publishMessage('cache:invalidate:messages', {
    conversationId: message.conversationId,
  })

  // Existing pub/sub broadcast
  await this.redisPubSub.publishMessage('messages:updated', { ... })

  return updatedMessage
}
```

Update `deleteMessage()` to invalidate message cache:

```typescript
async deleteMessage(messageId: string) {
  // ... existing delete code ...

  // ✅ FIX: Invalidate message cache
  await this.redis.del(`message:${messageId}`)
  await this.invalidateMessageCache(message.conversationId)

  // ✅ FIX: Broadcast cache invalidation
  await this.redisPubSub.publishMessage('cache:invalidate:messages', {
    conversationId: message.conversationId,
  })

  // Existing pub/sub broadcast
  await this.redisPubSub.publishMessage('messages:deleted', { ... })

  return result
}
```

**Success Criteria:**
- ✅ Message queries use cache (>80% hit rate expected)
- ✅ Cache invalidated on edit/delete
- ✅ Reduced database load by ~80%
- ✅ Faster message loading

---

### Task 4.2: Fix Idempotency Cache Error Handling (1 hour)

**File:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`
**Function:** `sendMessage()` (lines 45-208)

**Changes:**

Wrap transaction and caching in try-catch:

```typescript
async sendMessage(dto: SendMessageDto) {
  const { idempotencyKey, conversationId, senderId, senderType, content } = dto

  // Check idempotency cache
  const cacheKey = `message:idempotency:${idempotencyKey}`
  const existing = await this.redis.get(cacheKey)
  if (existing) {
    this.logger.debug(`Idempotency cache hit: ${idempotencyKey}`)
    return JSON.parse(existing)
  }

  try {
    // ✅ FIX: Transaction wrapped in try-catch
    const message = await this.prisma.$transaction(async tx => {
      // ... existing transaction code ...
    })

    // ✅ FIX: Only cache after successful transaction
    await this.redis.setex(cacheKey, this.IDEMPOTENCY_TTL, JSON.stringify(message))

    // ... existing cache invalidation code from Phase 2 ...

    // ✅ FIX: Pub/sub failure doesn't affect cache (eventual consistency)
    await this.redisPubSub.publishMessage('messages:new', { ... }).catch(err => {
      this.logger.error('Failed to publish message event, but message was saved', err)
    })

    return message
  } catch (error) {
    // ✅ FIX: Don't cache on error
    this.logger.error('Failed to send message', error)
    throw error
  }
}
```

**Success Criteria:**
- ✅ Idempotency cache only set on successful transaction
- ✅ Failed sends don't leave cache entries
- ✅ Retries work correctly after failures
- ✅ Pub/sub failures don't prevent message save

---

### Task 4.3: Replace KEYS with SCAN in Typing Service (2 hours)

**File:** `apps/wc-nest-api/src/modules/messaging/services/typing.service.ts`
**Function:** `getTypingUsers()` (around lines 50-80)

**Changes:**

Replace KEYS command with SCAN:

```typescript
async getTypingUsers(conversationId: string): Promise<TypingIndicator[]> {
  const client = this.redis.getClient()
  const pattern = `typing:${conversationId}:*`
  const keys: string[] = []
  let cursor = '0'

  // ✅ FIX: Use SCAN instead of KEYS (non-blocking)
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

  // ✅ GOOD: Pipeline for batch reads (keep existing code)
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

**Success Criteria:**
- ✅ No KEYS commands used (replaced with SCAN)
- ✅ Redis not blocked during typing queries
- ✅ Typing indicators still work correctly
- ✅ Performance maintained or improved

---

### Task 4.4: Fix addReaction() Cache Invalidation (1 hour)

**File:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`
**Function:** `addReaction()` (lines 573-610)

**Changes:**

Add cache invalidation after reaction creation:

```typescript
async addReaction(dto: AddReactionDto) {
  const { messageId, userId, emoji } = dto

  // ... existing reaction creation code ...

  // ✅ FIX: Invalidate message cache (reactions changed)
  await this.redis.del(`message:${messageId}`)
  await this.invalidateMessageCache(message.conversationId)

  // ✅ FIX: Broadcast cache invalidation to all replicas
  await this.redisPubSub.publishMessage('cache:invalidate:messages', {
    conversationId: message.conversationId,
  })

  // Existing pub/sub broadcast (line 596)
  await this.redisPubSub.publishMessage('reactions:added', { ... })

  return reaction
}
```

Update `removeReaction()` similarly:

```typescript
async removeReaction(dto: RemoveReactionDto) {
  const { messageId, userId, emoji } = dto

  // ... existing reaction removal code ...

  // ✅ FIX: Invalidate message cache
  await this.redis.del(`message:${messageId}`)
  await this.invalidateMessageCache(message.conversationId)

  // ✅ FIX: Broadcast cache invalidation
  await this.redisPubSub.publishMessage('cache:invalidate:messages', {
    conversationId: message.conversationId,
  })

  // Existing pub/sub broadcast
  await this.redisPubSub.publishMessage('reactions:removed', { ... })

  return result
}
```

**Success Criteria:**
- ✅ Reactions appear immediately in message lists
- ✅ Reaction count updates immediately
- ✅ Cache invalidation broadcast to all replicas

---

### Task 4.5: Fix pinMessage() Cache Invalidation (1 hour)

**File:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`
**Function:** `pinMessage()` (lines 771-825)

**Changes:**

Add cache invalidation after pin update:

```typescript
async pinMessage(dto: PinMessageDto) {
  const { messageId, userId } = dto

  // ... existing pin update code ...

  // ✅ FIX: Invalidate message cache (pin status changed)
  await this.redis.del(`message:${messageId}`)
  await this.invalidateMessageCache(message.conversationId)

  // ✅ FIX: Invalidate pinned messages cache
  const pinnedCacheKey = `messages:pinned:${message.conversationId}`
  await this.redis.del(pinnedCacheKey)

  // ✅ FIX: Broadcast cache invalidation to all replicas
  await this.redisPubSub.publishMessage('cache:invalidate:messages', {
    conversationId: message.conversationId,
  })

  // Existing pub/sub broadcast (line 816)
  await this.redisPubSub.publishMessage('messages:pinned', { ... })

  return updatedMessage
}
```

Update `unpinMessage()` similarly:

```typescript
async unpinMessage(messageId: string) {
  // ... existing unpin code ...

  // ✅ FIX: Invalidate message cache
  await this.redis.del(`message:${messageId}`)
  await this.invalidateMessageCache(message.conversationId)

  // ✅ FIX: Invalidate pinned messages cache
  const pinnedCacheKey = `messages:pinned:${message.conversationId}`
  await this.redis.del(pinnedCacheKey)

  // ✅ FIX: Broadcast cache invalidation
  await this.redisPubSub.publishMessage('cache:invalidate:messages', {
    conversationId: message.conversationId,
  })

  // Existing pub/sub broadcast
  await this.redisPubSub.publishMessage('messages:unpinned', { ... })

  return updatedMessage
}
```

**Success Criteria:**
- ✅ Pin status updates immediately in message lists
- ✅ Pinned messages list updates immediately
- ✅ Cache invalidation broadcast to all replicas

---

## Phase 5: Low Priority Fixes & Observability (LOW)

**Priority:** LOW
**Effort:** 5 hours
**Dependencies:** Phase 4
**Addresses:** Issue #11, Issue #12, Issue #13, bookmarkMessage()

### Objective
Add observability, cache warming, and fix remaining cache invalidation issues.

---

### Task 5.1: Fix bookmarkMessage() Cache Invalidation (1 hour)

**File:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`
**Function:** `bookmarkMessage()` (lines 658-692)

**Changes:**

Add cache invalidation and pub/sub broadcast:

```typescript
async bookmarkMessage(dto: BookmarkMessageDto) {
  const { messageId, userId, note } = dto

  // ... existing bookmark creation code ...

  // ✅ FIX: Invalidate bookmark list cache
  const cacheKey = `bookmarks:${userId}:*`
  await this.deleteKeysByPattern(cacheKey)

  // ✅ FIX: Broadcast bookmark event to all devices
  await this.redisPubSub.publishMessage('bookmarks:added', {
    messageId,
    userId,
    bookmarkId: bookmark.id,
    note,
  })

  return bookmark
}
```

Update `removeBookmark()` similarly:

```typescript
async removeBookmark(bookmarkId: string, userId: string) {
  // ... existing bookmark removal code ...

  // ✅ FIX: Invalidate bookmark list cache
  const cacheKey = `bookmarks:${userId}:*`
  await this.deleteKeysByPattern(cacheKey)

  // ✅ FIX: Broadcast bookmark event
  await this.redisPubSub.publishMessage('bookmarks:removed', {
    bookmarkId,
    userId,
  })

  return result
}
```

**Success Criteria:**
- ✅ Bookmarks appear immediately across all devices
- ✅ Bookmark list updates immediately
- ✅ Cache invalidation works correctly

---

### Task 5.2: Add Cache Hit/Miss Metrics (2 hours)

**File:** `apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts`

**Changes:**

Add metrics tracking to cache operations:

```typescript
async getConversations(dto: GetConversationsDto) {
  const { userId, filter = 'all', limit = 50, offset = 0 } = dto

  const providerId = await this.getProviderIdForUser(userId!)
  const cacheKey = `conversations:${userId}:${filter}:${limit}:${offset}:${providerId || 'none'}`

  const cached = await this.redis.get(cacheKey)
  if (cached) {
    // ✅ FIX: Track cache hit
    this.metricsService.incrementCounter('cache.conversations.hit', {
      filter,
      providerId: providerId ? 'true' : 'false',
    })
    this.logger.debug(`Cache hit: ${cacheKey}`)
    return JSON.parse(cached)
  }

  // ✅ FIX: Track cache miss
  this.metricsService.incrementCounter('cache.conversations.miss', {
    filter,
    providerId: providerId ? 'true' : 'false',
  })
  this.logger.debug(`Cache miss: ${cacheKey}`)

  // ... existing database query code ...

  await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(enrichedConversations))
  return enrichedConversations
}
```

**File:** `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`

Add similar metrics to `getMessages()`:

```typescript
async getMessages(dto: GetMessagesDto) {
  const { conversationId, limit = 50, cursor, direction = 'before' } = dto

  const cacheKey = `messages:${conversationId}:${limit}:${cursor || 'initial'}:${direction}`
  const cached = await this.redis.get(cacheKey)
  if (cached) {
    // ✅ FIX: Track cache hit
    this.metricsService.incrementCounter('cache.messages.hit', { direction })
    return JSON.parse(cached)
  }

  // ✅ FIX: Track cache miss
  this.metricsService.incrementCounter('cache.messages.miss', { direction })

  // ... existing code ...
}
```

**Success Criteria:**
- ✅ Cache hit/miss metrics tracked
- ✅ Metrics available in monitoring dashboard
- ✅ Can measure cache effectiveness (target >80% hit rate)

---

### Task 5.3: Add Cache Warming Strategy (1 hour)

**File:** `apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts`

**Changes:**

Add cache warming on application startup:

```typescript
/**
 * Warm cache for active users on application startup
 * Reduces cold start latency
 */
async warmCache() {
  this.logger.log('Starting cache warming...')

  try {
    // Get list of recently active users (last 24 hours)
    const activeUsers = await this.prisma.user.findMany({
      where: {
        lastActiveAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true },
      take: 100,  // Warm cache for top 100 active users
    })

    // Warm conversation cache for each user
    for (const user of activeUsers) {
      await this.getConversations({
        userId: user.id,
        filter: 'all',
        limit: 50,
        offset: 0,
      })
    }

    this.logger.log(`Cache warmed for ${activeUsers.length} users`)
  } catch (error) {
    this.logger.error('Cache warming failed', error)
  }
}
```

**File:** `apps/wc-nest-api/src/modules/messaging/messaging.module.ts`

Add cache warming to module initialization:

```typescript
export class MessagingModule implements OnModuleInit {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  async onModuleInit() {
    // ✅ FIX: Warm cache on startup
    await this.conversationsService.warmCache()
  }
}
```

**Success Criteria:**
- ✅ Cache warmed on application startup
- ✅ Cold start latency reduced (<100ms)
- ✅ Active users have pre-populated cache

---

### Task 5.4: Add Cache Size Monitoring (1 hour)

**File:** `apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts`

**Changes:**

Add cache size monitoring to track memory usage and prevent exhaustion:

```typescript
/**
 * Get Redis cache metrics for monitoring
 * Tracks memory usage, key count, and eviction rate
 */
async getCacheMetrics(): Promise<{
  usedMemory: number
  maxMemory: number
  evictedKeys: number
  keyCount: number
  memoryFragmentationRatio: number
  hitRate?: number
}> {
  const client = this.redis.getClient()

  // Get memory info from Redis
  const memoryInfo = await client.info('memory')
  const stats = await client.info('stats')
  const dbSize = await client.dbsize()

  // Parse memory metrics
  const metrics = {
    usedMemory: this.parseRedisInfo(memoryInfo, 'used_memory'),
    maxMemory: this.parseRedisInfo(memoryInfo, 'maxmemory'),
    evictedKeys: this.parseRedisInfo(stats, 'evicted_keys'),
    keyCount: dbSize,
    memoryFragmentationRatio: parseFloat(
      this.parseRedisInfo(memoryInfo, 'mem_fragmentation_ratio')
    ),
  }

  this.logger.debug('Cache metrics:', metrics)

  // Alert if memory usage is high
  const memoryUsagePercent = (metrics.usedMemory / metrics.maxMemory) * 100
  if (memoryUsagePercent > 80) {
    this.logger.warn(
      `High Redis memory usage: ${memoryUsagePercent.toFixed(1)}% (${metrics.usedMemory}/${metrics.maxMemory} bytes)`
    )
  }

  // Alert if eviction rate is high
  if (metrics.evictedKeys > 1000) {
    this.logger.warn(
      `High Redis eviction rate: ${metrics.evictedKeys} keys evicted`
    )
  }

  return metrics
}

/**
 * Parse Redis INFO command output
 * @param info - Raw INFO output
 * @param key - Key to extract
 * @returns Parsed value
 */
private parseRedisInfo(info: string, key: string): string {
  const regex = new RegExp(`${key}:(.+)`)
  const match = info.match(regex)
  return match ? match[1].trim() : '0'
}
```

Add periodic monitoring in module initialization:

```typescript
// File: apps/wc-nest-api/src/modules/messaging/messaging.module.ts

export class MessagingModule implements OnModuleInit {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  async onModuleInit() {
    // Warm cache on startup
    await this.conversationsService.warmCache()

    // ✅ FIX: Monitor cache size every 5 minutes
    setInterval(async () => {
      try {
        const metrics = await this.conversationsService.getCacheMetrics()

        // Log metrics for monitoring dashboard
        this.logger.log('Cache metrics:', {
          memoryUsageMB: (metrics.usedMemory / 1024 / 1024).toFixed(2),
          keyCount: metrics.keyCount,
          evictedKeys: metrics.evictedKeys,
          fragmentationRatio: metrics.memoryFragmentationRatio,
        })
      } catch (error) {
        this.logger.error('Failed to get cache metrics', error)
      }
    }, 5 * 60 * 1000) // Every 5 minutes
  }
}
```

Add metrics endpoint for monitoring:

```typescript
// File: apps/wc-nest-api/src/modules/messaging/controllers/messaging.controller.ts

@Get('cache/metrics')
@UseGuards(AdminGuard) // Only admins can view cache metrics
async getCacheMetrics() {
  const metrics = await this.conversationsService.getCacheMetrics()

  return {
    memory: {
      used: metrics.usedMemory,
      max: metrics.maxMemory,
      usagePercent: ((metrics.usedMemory / metrics.maxMemory) * 100).toFixed(2),
    },
    keys: {
      total: metrics.keyCount,
      evicted: metrics.evictedKeys,
    },
    fragmentation: metrics.memoryFragmentationRatio,
    status: metrics.usedMemory / metrics.maxMemory > 0.8 ? 'WARNING' : 'OK',
  }
}
```

**Success Criteria:**
- ✅ Cache metrics tracked every 5 minutes
- ✅ Alerts triggered when memory usage >80%
- ✅ Alerts triggered when eviction rate >1000 keys
- ✅ Metrics available via `/cache/metrics` endpoint
- ✅ Monitoring dashboard shows cache health

---

## Implementation Summary

### Total Effort Breakdown

| Phase | Priority | Effort | Issues Addressed |
|-------|----------|--------|------------------|
| Phase 1 | CRITICAL | 6 hours | #2, #4, #5 |
| Phase 2 | CRITICAL | 9 hours | #1, #3, #6, #7 |
| Phase 3 | HIGH | 6 hours | #6, markAsRead(), markAsDelivered() |
| Phase 4 | MEDIUM | 8 hours | #8, #9, #10, addReaction(), pinMessage() |
| Phase 5 | LOW | 5 hours | #11, #12, #13, bookmarkMessage() |
| **Total** | | **34 hours** | **All 13 issues + 5 CREATE operations** |

### Implementation Order

1. **Phase 1** (6 hours) - Foundation infrastructure (MUST be completed first)
2. **Phase 2** (9 hours) - Critical CREATE operations (depends on Phase 1)
3. **Phase 3** (6 hours) - High priority fixes (depends on Phase 2)
4. **Phase 4** (8 hours) - Medium priority fixes (depends on Phase 3)
5. **Phase 5** (4 hours) - Low priority & observability (depends on Phase 4)

### Success Metrics

After completing all phases:

- ✅ **Cache Consistency:** 100% (no stale data across replicas)
- ✅ **Cache Hit Rate:** >80% (measured via metrics)
- ✅ **Performance:** 20x faster conversation loading (N+1 fix)
- ✅ **Database Load:** 80% reduction (message caching)
- ✅ **Redis Blocking:** 0% (KEYS replaced with SCAN)
- ✅ **User Experience:** No "refresh to see new data" issues

---

## Files Modified

### Core Services (7 files)
1. `apps/wc-nest-api/src/modules/messaging/services/redis-pub-sub.service.ts`
2. `apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts`
3. `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`
4. `apps/wc-nest-api/src/modules/messaging/services/typing.service.ts`
5. `apps/wc-nest-api/src/modules/messaging/messaging.module.ts`

### Total Lines Changed
- **Additions:** ~500 lines
- **Modifications:** ~200 lines
- **Deletions:** ~50 lines

---

**Document Version:** 1.0
**Last Updated:** 2026-02-16
**Status:** Ready for Implementation


