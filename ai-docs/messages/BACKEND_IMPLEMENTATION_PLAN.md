# Backend Implementation Plan - Messaging System
## Comprehensive NestJS Implementation Guide

**Version**: 1.0  
**Date**: 2026-02-10  
**Status**: Implementation Ready  
**Target**: Azure Container Apps with Redis Pub/Sub  
**Estimated Timeline**: 6-8 weeks (MVP: 3-4 weeks)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Implementation Phases](#implementation-phases)
3. [Phase 1: Database & Core Setup](#phase-1-database--core-setup)
4. [Phase 2: Core Services Layer](#phase-2-core-services-layer)
5. [Phase 3: REST API Endpoints](#phase-3-rest-api-endpoints)
6. [Phase 4: WebSocket Gateway](#phase-4-websocket-gateway)
7. [Phase 5: Real-time Features](#phase-5-real-time-features)
8. [Phase 6: Advanced Features](#phase-6-advanced-features)
9. [Phase 7: Security & Compliance](#phase-7-security--compliance)
10. [Phase 8: Testing & Deployment](#phase-8-testing--deployment)
11. [MVP Scope Definition](#mvp-scope-definition)
12. [Technical Considerations](#technical-considerations)

---

## Executive Summary

This document provides a comprehensive implementation plan for the World Schools messaging system backend using NestJS, Prisma, Socket.io, and Redis. The plan is organized into 8 phases with clear deliverables, dependencies, and success criteria.

### Key Metrics
- **Total Tasks**: 87 tasks across 8 phases
- **New Files**: ~60 files (services, controllers, DTOs, guards, tests)
- **Enhanced Schema**: 23 production features already implemented
- **Target Scale**: 10,000+ concurrent WebSocket connections
- **Deployment**: Azure Container Apps with auto-scaling (3-10 replicas)

### Architecture Alignment
- ✅ **Schema**: Enhanced Prisma schema with 8 new models, 6 new enums, 15 performance indexes
- ✅ **Architecture**: Follows `MESSAGES_ARCHITECTURE_V1.1.md` specifications
- ✅ **Infrastructure**: Redis and PostgreSQL containers running locally
- ✅ **Deployment**: Azure Container Apps ready for horizontal scaling

---

## Implementation Phases

| Phase | Focus Area | Duration | Dependencies | Priority |
|-------|-----------|----------|--------------|----------|
| **Phase 1** | Database & Core Setup | 3-5 days | None | 🔴 Critical |
| **Phase 2** | Core Services Layer | 5-7 days | Phase 1 | 🔴 Critical |
| **Phase 3** | REST API Endpoints | 5-7 days | Phase 2 | 🔴 Critical |
| **Phase 4** | WebSocket Gateway | 7-10 days | Phase 2, 3 | 🔴 Critical |
| **Phase 5** | Real-time Features | 5-7 days | Phase 4 | 🟠 High |
| **Phase 6** | Advanced Features | 10-14 days | Phase 3, 4 | 🟡 Medium |
| **Phase 7** | Security & Compliance | 5-7 days | Phase 3, 4 | 🟠 High |
| **Phase 8** | Testing & Deployment | 7-10 days | All phases | 🔴 Critical |

**Total Estimated Time**: 47-67 days (6-8 weeks with parallel work)  
**MVP Timeline**: 20-28 days (3-4 weeks)

---

## Phase 1: Database & Core Setup
**Duration**: 3-5 days  
**Dependencies**: None  
**Priority**: 🔴 Critical Path

### Objectives
- Generate Prisma migration for enhanced schema
- Set up full-text search for messages
- Configure Prisma Client with proper types
- Verify database connectivity and indexes

### Deliverables

#### 1.1 Prisma Migration
**File**: `apps/wc-nest-api/prisma/migrations/YYYYMMDDHHMMSS_add_production_messaging_features/migration.sql`

**Tasks**:
- [ ] Run `npx prisma migrate dev --name add_production_messaging_features`
- [ ] Verify all 8 new models created (MessageDeliveryReceipt, MessageReaction, etc.)
- [ ] Verify all 6 new enums created (ContextType, DeletionType, etc.)
- [ ] Verify all 15 new indexes created
- [ ] Test migration rollback capability

**Commands**:
```bash
# Generate migration
cd apps/wc-nest-api
npx prisma migrate dev --name add_production_messaging_features

# Generate Prisma Client
npx prisma generate

# Verify migration
npx prisma migrate status
```

#### 1.2 Full-Text Search Setup
**File**: `apps/wc-nest-api/prisma/migrations/YYYYMMDDHHMMSS_add_fulltext_search/migration.sql`

**Tasks**:
- [ ] Create tsvector column for message content
- [ ] Create GIN index for full-text search
- [ ] Create trigger to auto-update search vector
- [ ] Test search performance with sample data

**SQL Implementation**:
```sql
-- Add tsvector column (auto-generated from content)
ALTER TABLE messages 
ADD COLUMN search_vector tsvector 
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX idx_messages_search_vector 
ON messages USING GIN(search_vector);

-- Verify index
EXPLAIN ANALYZE
SELECT * FROM messages
WHERE search_vector @@ to_tsquery('english', 'hello');
```

#### 1.3 Prisma Client Configuration
**File**: `apps/wc-nest-api/src/core/prisma/prisma.service.ts` (existing file - verify)

**Tasks**:
- [ ] Verify PrismaService is properly configured
- [ ] Add connection pooling settings for production
- [ ] Add query logging for development
- [ ] Test database connection

**Verification**:
```typescript
// Test Prisma Client types
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Verify new models are available
await prisma.messageDeliveryReceipt.findMany()
await prisma.messageReaction.findMany()
await prisma.messageEditHistory.findMany()
await prisma.messageMention.findMany()
await prisma.messageBookmark.findMany()
await prisma.messageReport.findMany()
await prisma.conversationLabel.findMany()
await prisma.conversationLabelAssignment.findMany()
```

### Testing Requirements
- [ ] All migrations run successfully
- [ ] All indexes created and verified
- [ ] Full-text search returns results
- [ ] Prisma Client generates correct TypeScript types
- [ ] Database connection pool works under load

### Success Criteria
✅ Migration completes without errors
✅ All 15 new models/tables exist in database
✅ Full-text search index performs <50ms queries
✅ Prisma Client types include all new models
✅ Database can handle 100+ concurrent connections

---

## Phase 2: Core Services Layer
**Duration**: 5-7 days
**Dependencies**: Phase 1 complete
**Priority**: 🔴 Critical Path

### Objectives
- Create core service classes for business logic
- Implement Prisma queries for all CRUD operations
- Add transaction support for complex operations
- Implement caching layer with Redis

### Deliverables

#### 2.1 Conversations Service
**File**: `apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts`

**Tasks**:
- [ ] Create ConversationsService class
- [ ] Implement `createConversation()` - Create or get existing conversation
- [ ] Implement `getConversations()` - List conversations with filters
- [ ] Implement `getConversationById()` - Get single conversation with participants
- [ ] Implement `updateConversationSettings()` - Update pinned, starred, muted, archived
- [ ] Implement `markAllAsRead()` - Mark all messages in conversation as read
- [ ] Implement `assignConversation()` - Assign to support agent (GAP 12)
- [ ] Implement `updateConversationStatus()` - Update status (GAP 13)
- [ ] Implement `addLabel()` / `removeLabel()` - Label management (GAP 10)
- [ ] Implement `getConversationMetrics()` - Get cached metrics (GAP 28)
- [ ] Add Redis caching for frequently accessed conversations

**Code Example**:
```typescript
// apps/wc-nest-api/src/modules/messaging/services/conversations.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '@/core/prisma/prisma.service'
import { RedisService } from '@/core/redis/redis.service'
import { ConversationType, ConversationStatus } from '@prisma/client'

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createConversation(
    userId: string,
    participantId: string,
    participantType: 'provider' | 'superadmin',
    initialMessage?: string,
  ) {
    // Determine conversation type
    const type = participantType === 'provider'
      ? ConversationType.USER_PROVIDER
      : ConversationType.USER_SUPERADMIN

    // Check if conversation already exists
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type,
        participants: {
          some: {
            AND: [
              { userId },
              participantType === 'provider'
                ? { providerId: participantId }
                : { userId: participantId }
            ]
          }
        }
      },
      include: {
        participants: true,
        lastMessage: true,
      }
    })

    if (existing) {
      return existing
    }

    // Create new conversation with participants
    return await this.prisma.conversation.create({
      data: {
        type,
        status: ConversationStatus.OPEN,
        participants: {
          create: [
            { userId },
            participantType === 'provider'
              ? { userId: participantId, providerId: participantId }
              : { userId: participantId }
          ]
        },
        ...(initialMessage && {
          messages: {
            create: {
              senderId: userId,
              senderType: 'USER',
              content: initialMessage,
              contentType: 'TEXT',
            }
          }
        })
      },
      include: {
        participants: true,
        lastMessage: true,
      }
    })
  }

  async getConversations(
    userId: string,
    filter: 'all' | 'unread' | 'archived' | 'starred' = 'all',
    limit = 50,
    offset = 0,
  ) {
    // Build where clause based on filter
    const where: any = {
      participants: {
        some: {
          userId,
          ...(filter === 'archived' && { archived: true }),
          ...(filter === 'starred' && { starred: true }),
          ...(filter === 'unread' && { unreadCount: { gt: 0 } }),
        }
      }
    }

    if (filter !== 'archived') {
      where.participants.some.archived = false
    }

    return await this.prisma.conversation.findMany({
      where,
      include: {
        participants: {
          where: { userId: { not: userId } },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
            provider: { select: { id: true, businessName: true, logo: true } }
          }
        },
        lastMessage: true,
        labels: {
          include: { label: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    })
  }

  async assignConversation(
    conversationId: string,
    assignedToId: string,
    assignedBy: string,
  ) {
    return await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToId,
        assignedBy,
        assignedAt: new Date(),
      }
    })
  }

  async updateStatus(
    conversationId: string,
    status: ConversationStatus,
    userId: string,
  ) {
    return await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status,
        statusChangedAt: new Date(),
        statusChangedByUser: userId,
      }
    })
  }
}
```

#### 2.2 Messages Service
**File**: `apps/wc-nest-api/src/modules/messaging/services/messages.service.ts`

**Tasks**:
- [ ] Create MessagesService class
- [ ] Implement `sendMessage()` - Send new message with idempotency
- [ ] Implement `getMessages()` - Cursor-based pagination (GAP 2)
- [ ] Implement `getMessageById()` - Get single message with relations
- [ ] Implement `editMessage()` - Edit with history tracking (GAP 8)
- [ ] Implement `deleteMessage()` - Soft delete with audit trail (GAP 7)
- [ ] Implement `markAsRead()` - Create read receipt
- [ ] Implement `markAsDelivered()` - Create delivery receipt (GAP 3)
- [ ] Implement `addReaction()` / `removeReaction()` - Emoji reactions (GAP 4)
- [ ] Implement `addMention()` - Parse and create mentions (GAP 14)
- [ ] Implement `bookmarkMessage()` / `unbookmarkMessage()` - Bookmarks (GAP 15)
- [ ] Implement `pinMessage()` / `unpinMessage()` - Pin messages (GAP 11)
- [ ] Implement `forwardMessage()` - Forward with tracking (GAP 9)
- [ ] Implement `scheduleMessage()` - Schedule for later (GAP 18)
- [ ] Implement `reportMessage()` - Abuse reporting (GAP 25)

**Code Example**:
```typescript
// apps/wc-nest-api/src/modules/messaging/services/messages.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '@/core/prisma/prisma.service'
import { RedisService } from '@/core/redis/redis.service'
import { MessageStatus, MessagePriority, DeletionType } from '@prisma/client'

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    options: {
      contentType?: string
      attachmentIds?: string[]
      replyToId?: string
      priority?: MessagePriority
      scheduledFor?: Date
      idempotencyKey: string
    }
  ) {
    // Check idempotency - prevent duplicate sends
    const cacheKey = `message:idempotency:${options.idempotencyKey}`
    const existing = await this.redis.get(cacheKey)
    if (existing) {
      return JSON.parse(existing)
    }

    // Parse mentions from content (@username)
    const mentions = this.parseMentions(content)

    // Create message with transaction
    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          senderId,
          senderType: 'USER', // Determine from context
          content,
          contentType: options.contentType || 'TEXT',
          replyToId: options.replyToId,
          priority: options.priority || MessagePriority.NORMAL,
          scheduledFor: options.scheduledFor,
          isScheduled: !!options.scheduledFor,
          status: MessageStatus.SENT,
          sentAt: new Date(),
          // Create mentions
          mentions: {
            create: mentions.map(userId => ({ userId }))
          },
          // Link attachments if provided
          ...(options.attachmentIds && {
            attachments: options.attachmentIds // Store as JSON
          })
        },
        include: {
          mentions: true,
          replyTo: true,
        }
      })

      // Update conversation last message and metrics
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: msg.id,
          updatedAt: new Date(),
          lastActivityAt: new Date(),
          messageCount: { increment: 1 },
        }
      })

      // Increment unread count for other participants
      await tx.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId: { not: senderId }
        },
        data: {
          unreadCount: { increment: 1 }
        }
      })

      return msg
    })

    // Cache for idempotency (24 hours)
    await this.redis.setex(cacheKey, 86400, JSON.stringify(message))

    return message
  }

  async getMessages(
    conversationId: string,
    limit = 50,
    cursor?: string, // message ID for cursor pagination
    direction: 'before' | 'after' = 'before'
  ) {
    // Cursor-based pagination using composite index (GAP 2)
    const where: any = {
      conversationId,
      isDeleted: false,
    }

    if (cursor) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true, id: true }
      })

      if (cursorMessage) {
        where.OR = [
          {
            createdAt: direction === 'before'
              ? { lt: cursorMessage.createdAt }
              : { gt: cursorMessage.createdAt }
          },
          {
            createdAt: cursorMessage.createdAt,
            id: direction === 'before'
              ? { lt: cursor }
              : { gt: cursor }
          }
        ]
      }
    }

    return await this.prisma.message.findMany({
      where,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        },
        readReceipts: true,
        deliveryReceipts: true,
        reactions: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        mentions: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        replyTo: {
          select: { id: true, content: true, senderId: true }
        }
      },
      orderBy: [
        { createdAt: direction === 'before' ? 'desc' : 'asc' },
        { id: direction === 'before' ? 'desc' : 'asc' }
      ],
      take: limit,
    })
  }

  async editMessage(
    messageId: string,
    userId: string,
    newContent: string,
    editReason?: string
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId }
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    if (message.senderId !== userId) {
      throw new BadRequestException('Cannot edit message from another user')
    }

    // Check if message is within edit window (15 minutes)
    const editWindow = 15 * 60 * 1000 // 15 minutes
    if (Date.now() - message.createdAt.getTime() > editWindow) {
      throw new BadRequestException('Message edit window expired')
    }

    // Update message and create edit history (GAP 8)
    return await this.prisma.$transaction(async (tx) => {
      // Create edit history entry
      await tx.messageEditHistory.create({
        data: {
          messageId,
          previousContent: message.content,
          editedBy: userId,
          editReason,
        }
      })

      // Update message
      return await tx.message.update({
        where: { id: messageId },
        data: {
          content: newContent,
          editedAt: new Date(),
        },
        include: {
          editHistory: {
            orderBy: { editedAt: 'desc' }
          }
        }
      })
    })
  }

  async deleteMessage(
    messageId: string,
    userId: string,
    deletionType: DeletionType = DeletionType.USER_DELETED
  ) {
    // Soft delete with audit trail (GAP 7)
    return await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
        deletionType,
      }
    })
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    // Add emoji reaction (GAP 4)
    return await this.prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        }
      },
      create: {
        messageId,
        userId,
        emoji,
      },
      update: {}, // No-op if already exists
    })
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    return await this.prisma.messageReaction.delete({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        }
      }
    })
  }

  private parseMentions(content: string): string[] {
    // Parse @username mentions from content
    const mentionRegex = /@(\w+)/g
    const matches = content.matchAll(mentionRegex)
    const usernames = Array.from(matches, m => m[1])

    // TODO: Resolve usernames to user IDs
    return []
  }
}
```

#### 2.3 Attachments Service
**File**: `apps/wc-nest-api/src/modules/messaging/services/attachments.service.ts`

**Tasks**:
- [ ] Create AttachmentsService class
- [ ] Implement `uploadAttachment()` - Upload to Azure Blob Storage
- [ ] Implement `generateThumbnail()` - For images
- [ ] Implement `deleteAttachment()` - Remove from storage
- [ ] Implement `getAttachmentUrl()` - Generate signed CDN URL
- [ ] Add file validation (size, type)
- [ ] Add virus scanning integration (optional)

#### 2.4 Search Service
**File**: `apps/wc-nest-api/src/modules/messaging/services/search.service.ts`

**Tasks**:
- [ ] Create SearchService class
- [ ] Implement `searchMessages()` - Full-text search using tsvector (GAP 6)
- [ ] Implement `searchConversations()` - Search by participant name
- [ ] Add search result highlighting
- [ ] Add search filters (date range, conversation, sender)
- [ ] Implement search result ranking

**Code Example**:
```typescript
// apps/wc-nest-api/src/modules/messaging/services/search.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/core/prisma/prisma.service'

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchMessages(
    userId: string,
    query: string,
    conversationId?: string,
    limit = 50,
    offset = 0
  ) {
    // Use PostgreSQL full-text search (GAP 6)
    const sql = `
      SELECT
        m.id,
        m.conversation_id,
        m.content,
        m.sender_id,
        m.created_at,
        ts_headline('english', m.content, to_tsquery('english', $1)) as highlight
      FROM messages m
      INNER JOIN conversation_participants cp
        ON cp.conversation_id = m.conversation_id
      WHERE
        cp.user_id = $2
        AND m.is_deleted = false
        AND m.search_vector @@ to_tsquery('english', $1)
        ${conversationId ? 'AND m.conversation_id = $3' : ''}
      ORDER BY ts_rank(m.search_vector, to_tsquery('english', $1)) DESC
      LIMIT $${conversationId ? '4' : '3'}
      OFFSET $${conversationId ? '5' : '4'}
    `

    const params = conversationId
      ? [query, userId, conversationId, limit, offset]
      : [query, userId, limit, offset]

    return await this.prisma.$queryRawUnsafe(sql, ...params)
  }
}
```

#### 2.5 Presence Service
**File**: `apps/wc-nest-api/src/modules/messaging/services/presence.service.ts`

**Tasks**:
- [ ] Create PresenceService class
- [ ] Implement `setOnline()` - Set user online status
- [ ] Implement `setOffline()` - Set user offline status
- [ ] Implement `setAway()` - Set user away status
- [ ] Implement `getPresence()` - Get user presence status
- [ ] Implement `getBulkPresence()` - Get presence for multiple users
- [ ] Use Redis for caching with TTL

#### 2.6 Typing Service
**File**: `apps/wc-nest-api/src/modules/messaging/services/typing.service.ts`

**Tasks**:
- [ ] Create TypingService class
- [ ] Implement `startTyping()` - Set typing indicator
- [ ] Implement `stopTyping()` - Clear typing indicator
- [ ] Implement `getTypingUsers()` - Get users currently typing
- [ ] Use Redis with 5-second TTL for ephemeral data

#### 2.7 Redis Pub/Sub Service
**File**: `apps/wc-nest-api/src/modules/messaging/services/redis-pub-sub.service.ts`

**Tasks**:
- [ ] Create RedisPubSubService class
- [ ] Implement `publishMessage()` - Publish to Redis channel
- [ ] Implement `subscribeToChannels()` - Subscribe to message channels
- [ ] Implement channel handlers for: `messages:new`, `messages:updated`, `messages:deleted`, `typing:events`, `presence:updates`
- [ ] Integrate with Socket.io server for broadcasting

**Code Example**:
```typescript
// apps/wc-nest-api/src/modules/messaging/services/redis-pub-sub.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'

@Injectable()
export class RedisPubSubService implements OnModuleInit {
  private publisher: Redis
  private subscriber: Redis
  private server: Server

  constructor() {
    this.publisher = new Redis(process.env.REDIS_URL)
    this.subscriber = new Redis(process.env.REDIS_URL)
  }

  async onModuleInit() {
    await this.subscriber.subscribe(
      'messages:new',
      'messages:updated',
      'messages:deleted',
      'typing:events',
      'presence:updates',
      'reactions:added',
      'reactions:removed'
    )

    this.subscriber.on('message', (channel, message) => {
      const data = JSON.parse(message)
      this.handleRedisMessage(channel, data)
    })
  }

  async publishMessage(channel: string, data: any) {
    await this.publisher.publish(channel, JSON.stringify(data))
  }

  private handleRedisMessage(channel: string, data: any) {
    if (!this.server) return

    switch (channel) {
      case 'messages:new':
        this.server.to(`conversation:${data.conversationId}`).emit('message:new', data)
        break
      case 'messages:updated':
        this.server.to(`conversation:${data.conversationId}`).emit('message:updated', data)
        break
      case 'messages:deleted':
        this.server.to(`conversation:${data.conversationId}`).emit('message:deleted', data)
        break
      case 'typing:events':
        this.server.to(`conversation:${data.conversationId}`).emit(data.event, data)
        break
      case 'presence:updates':
        this.server.emit('presence:update', data)
        break
      case 'reactions:added':
        this.server.to(`conversation:${data.conversationId}`).emit('reaction:added', data)
        break
      case 'reactions:removed':
        this.server.to(`conversation:${data.conversationId}`).emit('reaction:removed', data)
        break
    }
  }

  setServer(server: Server) {
    this.server = server
  }
}
```

### Testing Requirements
- [ ] Unit tests for all service methods
- [ ] Integration tests with Prisma
- [ ] Redis pub/sub integration tests
- [ ] Performance tests for cursor pagination
- [ ] Full-text search accuracy tests

### Success Criteria
✅ All services implement business logic correctly
✅ Cursor pagination performs <100ms for 10,000+ messages
✅ Full-text search returns relevant results <50ms
✅ Redis pub/sub broadcasts to all replicas
✅ Idempotency prevents duplicate messages
✅ Transaction rollback works correctly

---

## Phase 3: REST API Endpoints
**Duration**: 5-7 days
**Dependencies**: Phase 2 complete
**Priority**: 🔴 Critical Path

### Objectives
- Create REST controllers for all API endpoints
- Implement DTOs for request validation
- Add authentication and authorization guards
- Implement error handling and logging
- Add API documentation with Swagger

### Deliverables

#### 3.1 Conversations Controller
**File**: `apps/wc-nest-api/src/modules/messaging/controllers/conversations.controller.ts`

**Tasks**:
- [ ] Create ConversationsController class
- [ ] `GET /api/messages/conversations` - List conversations
- [ ] `POST /api/messages/conversations` - Create conversation
- [ ] `GET /api/messages/conversations/:id` - Get conversation details
- [ ] `PATCH /api/messages/conversations/:id` - Update settings
- [ ] `POST /api/messages/conversations/:id/mark-read` - Mark all as read
- [ ] `POST /api/messages/conversations/:id/assign` - Assign to agent (GAP 12)
- [ ] `PATCH /api/messages/conversations/:id/status` - Update status (GAP 13)
- [ ] `POST /api/messages/conversations/:id/labels` - Add label (GAP 10)
- [ ] `DELETE /api/messages/conversations/:id/labels/:labelId` - Remove label
- [ ] Add `@UseGuards(JwtAuthGuard, ConversationAccessGuard)`
- [ ] Add Swagger documentation

**Code Example**:
```typescript
// apps/wc-nest-api/src/modules/messaging/controllers/conversations.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard'
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator'
import { ConversationsService } from '../services/conversations.service'
import {
  CreateConversationDto,
  UpdateConversationDto,
  AssignConversationDto,
  UpdateStatusDto,
  AddLabelDto
} from '../dto'

@ApiTags('Messaging - Conversations')
@ApiBearerAuth()
@Controller('api/messages/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all conversations for current user' })
  async getConversations(
    @CurrentUser() user: any,
    @Query('filter') filter?: 'all' | 'unread' | 'archived' | 'starred',
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.conversationsService.getConversations(
      user.id,
      filter,
      limit,
      offset
    )
  }

  @Post()
  @ApiOperation({ summary: 'Create or get existing conversation' })
  async createConversation(
    @CurrentUser() user: any,
    @Body() dto: CreateConversationDto,
  ) {
    return await this.conversationsService.createConversation(
      user.id,
      dto.participantId,
      dto.participantType,
      dto.initialMessage
    )
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign conversation to support agent' })
  async assignConversation(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
    @Body() dto: AssignConversationDto,
  ) {
    return await this.conversationsService.assignConversation(
      conversationId,
      dto.assignedToId,
      user.id
    )
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update conversation status' })
  async updateStatus(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return await this.conversationsService.updateStatus(
      conversationId,
      dto.status,
      user.id
    )
  }
}
```

#### 3.2 Messages Controller
**File**: `apps/wc-nest-api/src/modules/messaging/controllers/messages.controller.ts`

**Tasks**:
- [ ] Create MessagesController class
- [ ] `GET /api/messages/conversations/:conversationId/messages` - Get messages (paginated)
- [ ] `POST /api/messages/conversations/:conversationId/messages` - Send message
- [ ] `GET /api/messages/messages/:id` - Get single message
- [ ] `PATCH /api/messages/messages/:id` - Edit message
- [ ] `DELETE /api/messages/messages/:id` - Delete message
- [ ] `POST /api/messages/messages/:id/read` - Mark as read
- [ ] `POST /api/messages/messages/:id/reactions` - Add reaction (GAP 4)
- [ ] `DELETE /api/messages/messages/:id/reactions/:emoji` - Remove reaction
- [ ] `POST /api/messages/messages/:id/bookmark` - Bookmark message (GAP 15)
- [ ] `DELETE /api/messages/messages/:id/bookmark` - Remove bookmark
- [ ] `POST /api/messages/messages/:id/pin` - Pin message (GAP 11)
- [ ] `DELETE /api/messages/messages/:id/pin` - Unpin message
- [ ] `POST /api/messages/messages/:id/forward` - Forward message (GAP 9)
- [ ] `POST /api/messages/messages/:id/report` - Report message (GAP 25)
- [ ] Add guards and validation

#### 3.3 Attachments Controller
**File**: `apps/wc-nest-api/src/modules/messaging/controllers/attachments.controller.ts`

**Tasks**:
- [ ] Create AttachmentsController class
- [ ] `POST /api/messages/attachments/upload` - Upload file
- [ ] `DELETE /api/messages/attachments/:id` - Delete attachment
- [ ] `GET /api/messages/attachments/:id/download` - Download file
- [ ] Add file upload interceptor
- [ ] Add file size validation (10MB images, 25MB documents)
- [ ] Add MIME type validation

#### 3.4 Search Controller
**File**: `apps/wc-nest-api/src/modules/messaging/controllers/search.controller.ts`

**Tasks**:
- [ ] Create SearchController class
- [ ] `GET /api/messages/search` - Search messages
- [ ] Add query validation
- [ ] Add result pagination
- [ ] Add search filters

#### 3.5 Labels Controller
**File**: `apps/wc-nest-api/src/modules/messaging/controllers/labels.controller.ts`

**Tasks**:
- [ ] Create LabelsController class
- [ ] `GET /api/messages/labels` - List all labels
- [ ] `POST /api/messages/labels` - Create label (GAP 10)
- [ ] `PATCH /api/messages/labels/:id` - Update label
- [ ] `DELETE /api/messages/labels/:id` - Delete label
- [ ] Restrict to admin/superadmin roles

#### 3.6 DTOs (Data Transfer Objects)
**Files**: `apps/wc-nest-api/src/modules/messaging/dto/*.dto.ts`

**Tasks**:
- [ ] `create-conversation.dto.ts` - Validation for creating conversations
- [ ] `send-message.dto.ts` - Validation for sending messages
- [ ] `edit-message.dto.ts` - Validation for editing messages
- [ ] `upload-attachment.dto.ts` - Validation for file uploads
- [ ] `search-messages.dto.ts` - Validation for search queries
- [ ] `add-reaction.dto.ts` - Validation for reactions
- [ ] `assign-conversation.dto.ts` - Validation for assignment
- [ ] `update-status.dto.ts` - Validation for status updates
- [ ] `add-label.dto.ts` - Validation for labels
- [ ] `report-message.dto.ts` - Validation for abuse reports
- [ ] Use `class-validator` decorators

**Code Example**:
```typescript
// apps/wc-nest-api/src/modules/messaging/dto/send-message.dto.ts
import { IsString, IsOptional, IsArray, IsEnum, IsUUID, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ContentType, MessagePriority } from '@prisma/client'

export class SendMessageDto {
  @ApiProperty({ description: 'Message content', maxLength: 10000 })
  @IsString()
  @MaxLength(10000)
  content: string

  @ApiPropertyOptional({ enum: ContentType, default: 'TEXT' })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType

  @ApiPropertyOptional({ description: 'Array of attachment IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[]

  @ApiPropertyOptional({ description: 'Message ID to reply to' })
  @IsOptional()
  @IsUUID('4')
  replyToId?: string

  @ApiPropertyOptional({ enum: MessagePriority, default: 'NORMAL' })
  @IsOptional()
  @IsEnum(MessagePriority)
  priority?: MessagePriority

  @ApiProperty({ description: 'Client-generated UUID for idempotency' })
  @IsUUID('4')
  idempotencyKey: string
}
```

#### 3.7 Guards
**Files**: `apps/wc-nest-api/src/modules/messaging/guards/*.guard.ts`

**Tasks**:
- [ ] `conversation-access.guard.ts` - Verify user is participant
- [ ] `message-access.guard.ts` - Verify user can access message
- [ ] `admin-only.guard.ts` - Restrict to admin/superadmin
- [ ] Integrate with existing JWT auth

**Code Example**:
```typescript
// apps/wc-nest-api/src/modules/messaging/guards/conversation-access.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '@/core/prisma/prisma.service'

@Injectable()
export class ConversationAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const userId = request.user.id
    const conversationId = request.params.id || request.params.conversationId

    // Check if user is a participant
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      }
    })

    if (!participant) {
      throw new ForbiddenException('You do not have access to this conversation')
    }

    return true
  }
}
```

### Testing Requirements
- [ ] Unit tests for all controllers
- [ ] Integration tests for all endpoints
- [ ] E2E tests for critical flows
- [ ] Validation tests for all DTOs
- [ ] Authorization tests for guards
- [ ] API documentation tests (Swagger)

### Success Criteria
✅ All REST endpoints return correct responses
✅ All DTOs validate input correctly
✅ All guards enforce authorization
✅ API documentation is complete and accurate
✅ Error responses follow consistent format
✅ All endpoints handle edge cases

---

## Phase 4: WebSocket Gateway
**Duration**: 7-10 days
**Dependencies**: Phase 2, 3 complete
**Priority**: 🔴 Critical Path

### Objectives
- Implement Socket.io WebSocket gateway
- Add JWT authentication for WebSocket connections
- Implement room management for conversations
- Integrate Redis pub/sub for horizontal scaling
- Add connection lifecycle management

### Deliverables

#### 4.1 WebSocket Gateway
**File**: `apps/wc-nest-api/src/modules/messaging/messaging.gateway.ts`

**Tasks**:
- [ ] Create MessagingGateway class
- [ ] Configure Socket.io namespace `/messages`
- [ ] Implement `handleConnection()` - Connection lifecycle
- [ ] Implement `handleDisconnect()` - Cleanup on disconnect
- [ ] Implement `@SubscribeMessage('authenticate')` - JWT authentication
- [ ] Implement `@SubscribeMessage('conversation:join')` - Join conversation room
- [ ] Implement `@SubscribeMessage('conversation:leave')` - Leave conversation room
- [ ] Implement `@SubscribeMessage('typing:start')` - Typing indicator start
- [ ] Implement `@SubscribeMessage('typing:stop')` - Typing indicator stop
- [ ] Implement `@SubscribeMessage('message:read')` - Mark message as read
- [ ] Implement `@SubscribeMessage('presence:update')` - Update presence status
- [ ] Integrate with RedisPubSubService for broadcasting
- [ ] Add error handling and logging

**Code Example**:
```typescript
// apps/wc-nest-api/src/modules/messaging/messaging.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { UseGuards, Logger } from '@nestjs/common'
import { WsJwtGuard } from '@/core/auth/guards/ws-jwt.guard'
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator'
import { MessagesService } from './services/messages.service'
import { PresenceService } from './services/presence.service'
import { TypingService } from './services/typing.service'
import { RedisPubSubService } from './services/redis-pub-sub.service'

@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(MessagingGateway.name)

  constructor(
    private messagesService: MessagesService,
    private presenceService: PresenceService,
    private typingService: TypingService,
    private redisPubSub: RedisPubSubService,
  ) {}

  afterInit() {
    // Set Socket.io server in Redis pub/sub service
    this.redisPubSub.setServer(this.server)
    this.logger.log('WebSocket Gateway initialized')
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connecting: ${client.id}`)
    // Authentication happens in WsJwtGuard via 'authenticate' event
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId
    if (userId) {
      // Set user offline
      await this.presenceService.setOffline(userId)

      // Broadcast presence update via Redis
      await this.redisPubSub.publishMessage('presence:updates', {
        userId,
        status: 'offline',
        lastSeenAt: new Date().toISOString(),
      })
    }
    this.logger.log(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token: string },
  ) {
    try {
      // Verify JWT token (implement in WsJwtGuard)
      const user = await this.verifyToken(data.token)

      // Store user data in socket
      client.data.userId = user.id
      client.data.userType = user.userType

      // Set user online
      await this.presenceService.setOnline(user.id)

      // Broadcast presence update
      await this.redisPubSub.publishMessage('presence:updates', {
        userId: user.id,
        status: 'online',
        lastSeenAt: new Date().toISOString(),
      })

      return { success: true, userId: user.id }
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`)
      return { success: false, error: 'Invalid token' }
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
    @CurrentUser() user: any,
  ) {
    // Verify user has access to conversation
    const hasAccess = await this.verifyConversationAccess(user.id, data.conversationId)
    if (!hasAccess) {
      return { success: false, error: 'Access denied' }
    }

    // Join Socket.io room
    await client.join(`conversation:${data.conversationId}`)
    this.logger.log(`User ${user.id} joined conversation ${data.conversationId}`)

    return { success: true }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('conversation:leave')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await client.leave(`conversation:${data.conversationId}`)
    return { success: true }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
    @CurrentUser() user: any,
  ) {
    // Set typing indicator in Redis (5 second TTL)
    await this.typingService.startTyping(data.conversationId, user.id)

    // Broadcast via Redis to all replicas
    await this.redisPubSub.publishMessage('typing:events', {
      event: 'typing:start',
      conversationId: data.conversationId,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
    })

    return { success: true }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
    @CurrentUser() user: any,
  ) {
    await this.typingService.stopTyping(data.conversationId, user.id)

    await this.redisPubSub.publishMessage('typing:events', {
      event: 'typing:stop',
      conversationId: data.conversationId,
      userId: user.id,
    })

    return { success: true }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string, conversationId: string },
    @CurrentUser() user: any,
  ) {
    // Create read receipt
    await this.messagesService.markAsRead(data.messageId, user.id)

    // Broadcast via Redis
    await this.redisPubSub.publishMessage('messages:updated', {
      event: 'message:read',
      messageId: data.messageId,
      conversationId: data.conversationId,
      readBy: user.id,
      readAt: new Date().toISOString(),
    })

    return { success: true }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('presence:update')
  async handlePresenceUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status: 'online' | 'away' | 'offline' },
    @CurrentUser() user: any,
  ) {
    // Update presence in Redis
    await this.presenceService.updatePresence(user.id, data.status)

    // Broadcast via Redis
    await this.redisPubSub.publishMessage('presence:updates', {
      userId: user.id,
      status: data.status,
      lastSeenAt: new Date().toISOString(),
    })

    return { success: true }
  }

  private async verifyToken(token: string): Promise<any> {
    // Implement JWT verification
    // Return user object
    throw new Error('Not implemented')
  }

  private async verifyConversationAccess(userId: string, conversationId: string): Promise<boolean> {
    // Implement access check
    return true
  }
}
```

#### 4.2 WebSocket JWT Guard
**File**: `apps/wc-nest-api/src/core/auth/guards/ws-jwt.guard.ts`

**Tasks**:
- [ ] Create WsJwtGuard class
- [ ] Implement JWT token verification for WebSocket
- [ ] Extract user from token and attach to socket
- [ ] Handle authentication errors

#### 4.3 Messaging Module
**File**: `apps/wc-nest-api/src/modules/messaging/messaging.module.ts`

**Tasks**:
- [ ] Create MessagingModule class
- [ ] Import PrismaModule, RedisModule
- [ ] Register all services (Conversations, Messages, Attachments, etc.)
- [ ] Register all controllers
- [ ] Register MessagingGateway
- [ ] Export services for use in other modules

**Code Example**:
```typescript
// apps/wc-nest-api/src/modules/messaging/messaging.module.ts
import { Module } from '@nestjs/common'
import { MessagingGateway } from './messaging.gateway'
import { ConversationsController } from './controllers/conversations.controller'
import { MessagesController } from './controllers/messages.controller'
import { AttachmentsController } from './controllers/attachments.controller'
import { SearchController } from './controllers/search.controller'
import { LabelsController } from './controllers/labels.controller'
import { ConversationsService } from './services/conversations.service'
import { MessagesService } from './services/messages.service'
import { AttachmentsService } from './services/attachments.service'
import { SearchService } from './services/search.service'
import { PresenceService } from './services/presence.service'
import { TypingService } from './services/typing.service'
import { RedisPubSubService } from './services/redis-pub-sub.service'
import { PrismaModule } from '@/core/prisma/prisma.module'
import { RedisModule } from '@/core/redis/redis.module'

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [
    ConversationsController,
    MessagesController,
    AttachmentsController,
    SearchController,
    LabelsController,
  ],
  providers: [
    MessagingGateway,
    ConversationsService,
    MessagesService,
    AttachmentsService,
    SearchService,
    PresenceService,
    TypingService,
    RedisPubSubService,
  ],
  exports: [
    ConversationsService,
    MessagesService,
    PresenceService,
  ],
})
export class MessagingModule {}
```

### Testing Requirements
- [ ] WebSocket connection tests
- [ ] Authentication tests
- [ ] Room join/leave tests
- [ ] Event broadcasting tests
- [ ] Redis pub/sub integration tests
- [ ] Load tests (1000+ concurrent connections)

### Success Criteria
✅ WebSocket connections authenticate successfully
✅ Users can join/leave conversation rooms
✅ Events broadcast to all participants
✅ Redis pub/sub works across multiple replicas
✅ Typing indicators work in real-time
✅ Presence updates broadcast correctly
✅ Connection handles reconnection gracefully

---

## Phase 5: Real-time Features
**Duration**: 5-7 days
**Dependencies**: Phase 4 complete
**Priority**: 🟠 High

### Objectives
- Implement real-time message delivery
- Add delivery and read receipts
- Implement presence tracking
- Add typing indicators
- Optimize for low latency (<100ms)

### Deliverables

#### 5.1 Real-time Message Delivery
**Integration**: MessagesService + MessagingGateway + RedisPubSubService

**Tasks**:
- [ ] After message saved to DB, publish to Redis `messages:new` channel
- [ ] RedisPubSubService broadcasts to all Socket.io rooms
- [ ] Clients receive `message:new` event
- [ ] Update conversation `lastMessage` and `updatedAt`
- [ ] Increment unread count for other participants
- [ ] Track delivery latency (GAP 27)

**Code Example**:
```typescript
// In MessagesService.sendMessage()
const message = await this.prisma.message.create({ /* ... */ })

// Publish to Redis for real-time delivery
await this.redisPubSub.publishMessage('messages:new', {
  conversationId: message.conversationId,
  message: {
    id: message.id,
    content: message.content,
    senderId: message.senderId,
    createdAt: message.createdAt,
    // ... other fields
  }
})

return message
```

#### 5.2 Delivery Receipts (GAP 3)
**Integration**: MessagesService + MessagingGateway

**Tasks**:
- [ ] When client receives message, emit `message:delivered` event
- [ ] Server creates `MessageDeliveryReceipt` record
- [ ] Broadcast delivery confirmation to sender
- [ ] Track delivery latency in milliseconds

#### 5.3 Read Receipts
**Integration**: MessagesService + MessagingGateway

**Tasks**:
- [ ] When user views message, emit `message:read` event
- [ ] Server creates `MessageReadReceipt` record
- [ ] Update `ConversationParticipant.lastReadAt`
- [ ] Decrement `unreadCount`
- [ ] Broadcast read confirmation to sender

#### 5.4 Presence Tracking
**Integration**: PresenceService + MessagingGateway

**Tasks**:
- [ ] Store presence in Redis with TTL (5 minutes)
- [ ] Update presence on connection/disconnection
- [ ] Update presence on activity (message sent, typing)
- [ ] Broadcast presence changes to all users
- [ ] Implement "last seen" timestamp

#### 5.5 Typing Indicators
**Integration**: TypingService + MessagingGateway

**Tasks**:
- [ ] Store typing state in Redis with 5-second TTL
- [ ] Broadcast typing events only to conversation participants
- [ ] Auto-clear typing indicator after 5 seconds
- [ ] Debounce typing events on client side

### Testing Requirements
- [ ] Message delivery latency tests (<100ms)
- [ ] Delivery receipt accuracy tests
- [ ] Read receipt accuracy tests
- [ ] Presence update tests
- [ ] Typing indicator tests
- [ ] Load tests with 10,000+ concurrent users

### Success Criteria
✅ Messages delivered in <100ms
✅ Delivery receipts created correctly
✅ Read receipts update unread count
✅ Presence status accurate within 5 seconds
✅ Typing indicators clear automatically
✅ System handles 10,000+ concurrent connections

---

## Phase 6: Advanced Features
**Duration**: 10-14 days
**Dependencies**: Phase 3, 4 complete
**Priority**: 🟡 Medium (Can be implemented in parallel)

### Objectives
- Implement all 23 enhanced schema features
- Add reactions, mentions, bookmarks
- Implement threading, forwarding, pinning
- Add full-text search
- Implement labels, assignment, status tracking
- Add scheduled messages
- Implement abuse reporting

### Deliverables

#### 6.1 Message Reactions (GAP 4)
**Files**: MessagesService, MessagesController, MessagingGateway

**Tasks**:
- [ ] `POST /api/messages/messages/:id/reactions` - Add reaction
- [ ] `DELETE /api/messages/messages/:id/reactions/:emoji` - Remove reaction
- [ ] Broadcast reaction events via WebSocket
- [ ] Support emoji: 👍, ❤️, 😂, 😮, 😢, 🙏
- [ ] Enforce unique constraint (messageId, userId, emoji)

#### 6.2 Message Mentions (GAP 14)
**Files**: MessagesService, NotificationsService

**Tasks**:
- [ ] Parse @username from message content
- [ ] Resolve usernames to user IDs
- [ ] Create `MessageMention` records
- [ ] Send push notifications to mentioned users
- [ ] Highlight mentions in UI

#### 6.3 Message Bookmarks (GAP 15)
**Files**: MessagesService, MessagesController

**Tasks**:
- [ ] `POST /api/messages/messages/:id/bookmark` - Bookmark message
- [ ] `DELETE /api/messages/messages/:id/bookmark` - Remove bookmark
- [ ] `GET /api/messages/bookmarks` - List bookmarked messages
- [ ] Add optional note field

#### 6.4 Message Threading (GAP 1)
**Files**: MessagesService, MessagesController

**Tasks**:
- [ ] Support `replyToId` in send message
- [ ] Fetch reply chain when loading messages
- [ ] Display thread context in UI
- [ ] Limit thread depth (optional)

#### 6.5 Message Forwarding (GAP 9)
**Files**: MessagesService, MessagesController

**Tasks**:
- [ ] `POST /api/messages/messages/:id/forward` - Forward message
- [ ] Track `forwardedFromId` and `forwardCount`
- [ ] Preserve original sender attribution
- [ ] Limit forward count (optional)

#### 6.6 Message Pinning (GAP 11)
**Files**: MessagesService, MessagesController

**Tasks**:
- [ ] `POST /api/messages/messages/:id/pin` - Pin message
- [ ] `DELETE /api/messages/messages/:id/pin` - Unpin message
- [ ] Track `pinnedBy` and `pinnedAt`
- [ ] Limit pinned messages per conversation (e.g., 5)

#### 6.7 Full-Text Search (GAP 6)
**Files**: SearchService, SearchController

**Tasks**:
- [ ] Implement PostgreSQL full-text search using tsvector
- [ ] Add search result highlighting
- [ ] Support search filters (date, conversation, sender)
- [ ] Implement search result ranking
- [ ] Add search autocomplete (optional)

#### 6.8 Conversation Labels (GAP 10)
**Files**: ConversationsService, LabelsController

**Tasks**:
- [ ] `POST /api/messages/labels` - Create label
- [ ] `POST /api/messages/conversations/:id/labels` - Assign label
- [ ] `DELETE /api/messages/conversations/:id/labels/:labelId` - Remove label
- [ ] Support color and icon for labels
- [ ] Filter conversations by label

#### 6.9 Conversation Assignment (GAP 12)
**Files**: ConversationsService, ConversationsController

**Tasks**:
- [ ] `POST /api/messages/conversations/:id/assign` - Assign to agent
- [ ] Track `assignedBy` and `assignedAt`
- [ ] Send notification to assigned agent
- [ ] Filter conversations by assignment

#### 6.10 Conversation Status (GAP 13)
**Files**: ConversationsService, ConversationsController

**Tasks**:
- [ ] `PATCH /api/messages/conversations/:id/status` - Update status
- [ ] Support statuses: OPEN, PENDING, RESOLVED, CLOSED, ARCHIVED
- [ ] Track `statusChangedAt` and `statusChangedByUser`
- [ ] Filter conversations by status

#### 6.11 Scheduled Messages (GAP 18)
**Files**: MessagesService, SchedulerService (new)

**Tasks**:
- [ ] Support `scheduledFor` in send message
- [ ] Create Bull queue for scheduled messages
- [ ] Process scheduled messages at specified time
- [ ] Allow canceling scheduled messages
- [ ] Send notification when scheduled message is sent

#### 6.12 Message Edit History (GAP 8)
**Files**: MessagesService, MessagesController

**Tasks**:
- [ ] Create `MessageEditHistory` record on edit
- [ ] Track `previousContent`, `editedBy`, `editReason`
- [ ] `GET /api/messages/messages/:id/history` - View edit history
- [ ] Display "edited" indicator in UI

#### 6.13 Auto-Response (GAP 17)
**Files**: ConversationsService, MessagesService

**Tasks**:
- [ ] Support auto-response settings per participant
- [ ] Check `autoResponseEnabled` when message received
- [ ] Send auto-response if enabled and within business hours
- [ ] Respect `autoResponseUntil` expiration

### Testing Requirements
- [ ] Unit tests for all advanced features
- [ ] Integration tests for complex workflows
- [ ] Performance tests for search
- [ ] E2E tests for user journeys

### Success Criteria
✅ All 23 enhanced features implemented
✅ Reactions work in real-time
✅ Mentions send notifications
✅ Search returns results <50ms
✅ Labels and assignment work correctly
✅ Scheduled messages send on time
✅ Edit history tracks all changes

---

## Phase 7: Security & Compliance
**Duration**: 5-7 days
**Dependencies**: Phase 3, 4 complete
**Priority**: 🟠 High

### Objectives
- Implement rate limiting
- Add abuse reporting workflow
- Implement soft deletes with audit trail
- Add GDPR compliance features
- Implement security best practices

### Deliverables

#### 7.1 Rate Limiting (GAP 26)
**Files**: RateLimitGuard (new), ConversationsService

**Tasks**:
- [ ] Track `messageCount24h` per participant
- [ ] Implement rate limit (e.g., 100 messages per 24 hours)
- [ ] Set `isRateLimited` flag when limit exceeded
- [ ] Return 429 Too Many Requests error
- [ ] Reset counter after 24 hours
- [ ] Use Redis for distributed rate limiting

**Code Example**:
```typescript
// apps/wc-nest-api/src/modules/messaging/guards/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common'
import { PrismaService } from '@/core/prisma/prisma.service'

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const userId = request.user.id
    const conversationId = request.params.conversationId

    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId }
    })

    if (!participant) {
      return true // Let ConversationAccessGuard handle this
    }

    // Check if rate limited
    if (participant.isRateLimited && participant.rateLimitUntil > new Date()) {
      throw new HttpException(
        'Rate limit exceeded. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS
      )
    }

    // Check message count in last 24 hours
    const RATE_LIMIT = 100
    if (participant.messageCount24h >= RATE_LIMIT) {
      // Set rate limit
      await this.prisma.conversationParticipant.update({
        where: { id: participant.id },
        data: {
          isRateLimited: true,
          rateLimitUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      })

      throw new HttpException(
        'Rate limit exceeded. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS
      )
    }

    return true
  }
}
```

#### 7.2 Abuse Reporting (GAP 25)
**Files**: MessagesService, MessagesController, ReportsService (new)

**Tasks**:
- [ ] `POST /api/messages/messages/:id/report` - Report message
- [ ] Support report reasons: SPAM, HARASSMENT, INAPPROPRIATE_CONTENT, SCAM, IMPERSONATION, OTHER
- [ ] Create `MessageReport` record with status PENDING
- [ ] Send notification to moderators
- [ ] `GET /api/admin/reports` - List all reports (admin only)
- [ ] `PATCH /api/admin/reports/:id` - Review report (admin only)
- [ ] Support resolution actions: dismiss, delete message, ban user

#### 7.3 Enhanced Soft Delete (GAP 7)
**Files**: MessagesService

**Tasks**:
- [ ] Implement soft delete with `isDeleted` flag
- [ ] Track `deletionType`: USER_DELETED, ADMIN_DELETED, AUTO_DELETED, GDPR_DELETED
- [ ] Track `deletedBy` and `deletedAt`
- [ ] Filter deleted messages from queries
- [ ] Implement hard delete for GDPR compliance

#### 7.4 GDPR Compliance
**Files**: GdprService (new)

**Tasks**:
- [ ] Implement "right to be forgotten" - hard delete all user data
- [ ] Implement data export - export all user messages
- [ ] Implement data portability - export in JSON format
- [ ] Add consent tracking for data processing
- [ ] Add data retention policies

#### 7.5 Security Best Practices
**Tasks**:
- [ ] Implement input sanitization for message content
- [ ] Add XSS protection for message rendering
- [ ] Implement CSRF protection for REST endpoints
- [ ] Add SQL injection protection (Prisma handles this)
- [ ] Implement file upload validation (MIME type, size, virus scan)
- [ ] Add rate limiting for API endpoints
- [ ] Implement IP-based rate limiting
- [ ] Add logging for security events

### Testing Requirements
- [ ] Rate limiting tests
- [ ] Abuse reporting workflow tests
- [ ] Soft delete tests
- [ ] GDPR compliance tests
- [ ] Security penetration tests

### Success Criteria
✅ Rate limiting prevents message flooding
✅ Abuse reports create tickets for moderators
✅ Soft deletes preserve audit trail
✅ GDPR data export works correctly
✅ Security vulnerabilities addressed
✅ All inputs sanitized and validated

---

## Phase 8: Testing & Deployment
**Duration**: 7-10 days
**Dependencies**: All phases complete
**Priority**: 🔴 Critical

### Objectives
- Write comprehensive test suite
- Set up CI/CD pipeline
- Deploy to Azure Container Apps
- Configure monitoring and alerting
- Perform load testing
- Document API and deployment

### Deliverables

#### 8.1 Unit Tests
**Files**: `*.spec.ts` files for all services, controllers, guards

**Tasks**:
- [ ] Write unit tests for all services (80%+ coverage)
- [ ] Write unit tests for all controllers
- [ ] Write unit tests for all guards
- [ ] Write unit tests for DTOs
- [ ] Use Jest mocking for Prisma and Redis
- [ ] Run tests in CI pipeline

#### 8.2 Integration Tests
**Files**: `*.integration.spec.ts` files

**Tasks**:
- [ ] Write integration tests for REST endpoints
- [ ] Write integration tests for WebSocket events
- [ ] Write integration tests for Redis pub/sub
- [ ] Use test database for integration tests
- [ ] Clean up test data after each test

#### 8.3 E2E Tests
**Files**: `apps/wc-nest-api/test/messaging.e2e-spec.ts`

**Tasks**:
- [ ] Write E2E tests for critical user journeys
- [ ] Test: Create conversation → Send message → Receive via WebSocket
- [ ] Test: Send message → Mark as read → Update unread count
- [ ] Test: Add reaction → Broadcast to participants
- [ ] Test: Search messages → Return results
- [ ] Test: Report message → Create report ticket

#### 8.4 Load Testing
**Files**: `load-tests/websocket-load-test.js` (using Artillery or k6)

**Tasks**:
- [ ] Test 1,000 concurrent WebSocket connections
- [ ] Test 10,000 concurrent WebSocket connections
- [ ] Test message throughput (messages/second)
- [ ] Test database query performance under load
- [ ] Test Redis pub/sub performance
- [ ] Identify bottlenecks and optimize

#### 8.5 Azure Container Apps Deployment
**Files**: `infrastructure/container-apps.bicep`, `.github/workflows/deploy.yml`

**Tasks**:
- [ ] Create Dockerfile for NestJS app
- [ ] Build and push Docker image to Azure Container Registry
- [ ] Create Azure Container App for REST API
- [ ] Create Azure Container App for WebSocket server
- [ ] Configure environment variables (DATABASE_URL, REDIS_URL, etc.)
- [ ] Configure auto-scaling (3-10 replicas)
- [ ] Configure health checks
- [ ] Configure ingress and custom domain
- [ ] Set up Azure Front Door for load balancing

**Dockerfile Example**:
```dockerfile
# apps/wc-nest-api/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

#### 8.6 Monitoring & Alerting
**Files**: Azure Monitor configuration

**Tasks**:
- [ ] Configure Azure Application Insights
- [ ] Add custom metrics (message delivery latency, WebSocket connections)
- [ ] Set up log aggregation
- [ ] Create dashboards for key metrics
- [ ] Set up alerts for errors, high latency, high CPU/memory
- [ ] Configure distributed tracing

#### 8.7 Documentation
**Files**: `README.md`, `API.md`, `DEPLOYMENT.md`

**Tasks**:
- [ ] Document API endpoints (Swagger/OpenAPI)
- [ ] Document WebSocket events
- [ ] Document deployment process
- [ ] Document environment variables
- [ ] Document troubleshooting guide
- [ ] Create runbook for common issues

### Testing Requirements
- [ ] All tests pass in CI pipeline
- [ ] Code coverage >80%
- [ ] Load tests pass with 10,000+ connections
- [ ] Deployment succeeds without errors

### Success Criteria
✅ All tests pass with >80% coverage
✅ Load tests handle 10,000+ concurrent connections
✅ Deployment to Azure Container Apps succeeds
✅ Monitoring and alerting configured
✅ API documentation complete
✅ System ready for production traffic

---

## MVP Scope Definition
**Target Timeline**: 3-4 weeks (20-28 days)

### MVP Features (Must-Have)

#### Core Messaging (Phase 1-4)
- ✅ **Database Setup** - Prisma migration, full-text search
- ✅ **Conversations** - Create, list, get, update settings
- ✅ **Messages** - Send, receive, edit, delete (soft delete)
- ✅ **Attachments** - Upload images and documents
- ✅ **REST API** - All CRUD endpoints
- ✅ **WebSocket Gateway** - Real-time bidirectional communication
- ✅ **Authentication** - JWT for REST and WebSocket
- ✅ **Authorization** - Conversation access guards

#### Real-time Features (Phase 5)
- ✅ **Message Delivery** - Real-time via WebSocket
- ✅ **Read Receipts** - Mark messages as read
- ✅ **Typing Indicators** - Show when user is typing
- ✅ **Presence Tracking** - Online/offline status
- ✅ **Redis Pub/Sub** - Horizontal scaling support

#### Essential Advanced Features (Phase 6 - Subset)
- ✅ **Message Threading** - Reply to messages (GAP 1)
- ✅ **Cursor Pagination** - Efficient message loading (GAP 2)
- ✅ **Delivery Receipts** - Track message delivery (GAP 3)
- ✅ **Conversation Context** - Link to bookings/camps (GAP 5)
- ✅ **Enhanced Soft Delete** - Audit trail (GAP 7)

#### Security (Phase 7 - Subset)
- ✅ **Rate Limiting** - Prevent message flooding (GAP 26)
- ✅ **Input Validation** - Sanitize all inputs
- ✅ **Access Control** - Verify user permissions

### Post-MVP Features (Nice-to-Have)

#### Advanced Features (Phase 6 - Remaining)
- ⏳ **Message Reactions** - Emoji reactions (GAP 4)
- ⏳ **Full-Text Search** - Search messages (GAP 6)
- ⏳ **Message Edit History** - Track edits (GAP 8)
- ⏳ **Message Forwarding** - Forward messages (GAP 9)
- ⏳ **Conversation Labels** - Categorize conversations (GAP 10)
- ⏳ **Message Priority** - Pin important messages (GAP 11)
- ⏳ **Conversation Assignment** - Assign to agents (GAP 12)
- ⏳ **Conversation Status** - Track lifecycle (GAP 13)
- ⏳ **Message Mentions** - @user notifications (GAP 14)
- ⏳ **Message Bookmarks** - Save messages (GAP 15)
- ⏳ **Auto-Response** - Automated replies (GAP 17)
- ⏳ **Scheduled Messages** - Send later (GAP 18)
- ⏳ **Abuse Reporting** - Report spam (GAP 25)
- ⏳ **Delivery Latency Tracking** - Performance metrics (GAP 27)
- ⏳ **Conversation Metrics** - Cached stats (GAP 28)

### MVP Implementation Order

**Week 1: Foundation**
- Days 1-2: Phase 1 (Database & Core Setup)
- Days 3-5: Phase 2 (Core Services Layer - Conversations, Messages)

**Week 2: API & WebSocket**
- Days 6-8: Phase 3 (REST API Endpoints - Conversations, Messages, Attachments)
- Days 9-12: Phase 4 (WebSocket Gateway - Connection, Authentication, Rooms)

**Week 3: Real-time & Testing**
- Days 13-15: Phase 5 (Real-time Features - Delivery, Read Receipts, Typing, Presence)
- Days 16-18: Phase 6 (MVP Advanced Features - Threading, Pagination, Context)

**Week 4: Security & Deployment**
- Days 19-20: Phase 7 (Security - Rate Limiting, Validation)
- Days 21-24: Phase 8 (Testing - Unit, Integration, E2E)
- Days 25-28: Phase 8 (Deployment - Azure Container Apps, Monitoring)

### MVP Success Criteria

✅ **Functional Requirements**
- Users can create conversations with providers/superadmin
- Users can send and receive messages in real-time
- Users can upload and view attachments
- Users can see typing indicators and presence status
- Messages are marked as read/delivered
- Conversations are paginated efficiently

✅ **Non-Functional Requirements**
- Message delivery latency <100ms
- System handles 1,000+ concurrent WebSocket connections
- API response time <200ms (p95)
- Database queries optimized with indexes
- Redis pub/sub works across multiple replicas
- All inputs validated and sanitized

✅ **Deployment Requirements**
- Deployed to Azure Container Apps
- Auto-scaling configured (3-10 replicas)
- Monitoring and alerting set up
- Health checks configured
- Environment variables secured

---

## Technical Considerations

### 1. Cursor-Based Pagination (GAP 2)

**Challenge**: Efficiently paginate through 10,000+ messages per conversation

**Solution**: Use composite index `[conversationId, createdAt DESC, id]`

**Implementation**:
```typescript
// Cursor-based pagination query
const messages = await prisma.message.findMany({
  where: {
    conversationId,
    isDeleted: false,
    OR: [
      { createdAt: { lt: cursorCreatedAt } },
      { createdAt: cursorCreatedAt, id: { lt: cursorId } }
    ]
  },
  orderBy: [
    { createdAt: 'desc' },
    { id: 'desc' }
  ],
  take: 50
})
```

**Benefits**:
- ✅ Consistent performance regardless of offset
- ✅ No "page drift" when new messages arrive
- ✅ Works with real-time updates

---

### 2. Full-Text Search (GAP 6)

**Challenge**: Search through millions of messages efficiently

**Solution**: PostgreSQL tsvector with GIN index

**Implementation**:
```sql
-- Add tsvector column
ALTER TABLE messages
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Create GIN index
CREATE INDEX idx_messages_search_vector
ON messages USING GIN(search_vector);

-- Search query
SELECT * FROM messages
WHERE search_vector @@ to_tsquery('english', 'hello & world')
ORDER BY ts_rank(search_vector, to_tsquery('english', 'hello & world')) DESC;
```

**Benefits**:
- ✅ Sub-50ms search queries
- ✅ Relevance ranking
- ✅ Supports stemming and stop words
- ✅ Scales to millions of messages

---

### 3. Redis Pub/Sub for Horizontal Scaling

**Challenge**: Broadcast WebSocket events to all Container App replicas

**Solution**: Redis pub/sub pattern

**Architecture**:
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Replica A  │     │  Replica B  │     │  Replica C  │
│  (Socket.io)│     │  (Socket.io)│     │  (Socket.io)│
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │
                    │   Pub/Sub   │
                    └─────────────┘
```

**Implementation**:
```typescript
// Publish message to Redis
await redisPubSub.publishMessage('messages:new', {
  conversationId: 'abc123',
  message: { /* ... */ }
})

// All replicas receive and broadcast to their Socket.io clients
subscriber.on('message', (channel, data) => {
  if (channel === 'messages:new') {
    server.to(`conversation:${data.conversationId}`).emit('message:new', data)
  }
})
```

**Benefits**:
- ✅ Scales to 10+ replicas
- ✅ All users receive messages regardless of replica
- ✅ No single point of failure

---

### 4. Message Reactions (GAP 4)

**Challenge**: Allow multiple users to react with same emoji

**Solution**: Unique constraint on `[messageId, userId, emoji]`

**Implementation**:
```typescript
// Add reaction (upsert to handle duplicates)
await prisma.messageReaction.upsert({
  where: {
    messageId_userId_emoji: {
      messageId: 'msg123',
      userId: 'user456',
      emoji: '👍'
    }
  },
  create: {
    messageId: 'msg123',
    userId: 'user456',
    emoji: '👍'
  },
  update: {} // No-op if already exists
})

// Get reaction counts
const reactions = await prisma.messageReaction.groupBy({
  by: ['emoji'],
  where: { messageId: 'msg123' },
  _count: { emoji: true }
})
// Result: [{ emoji: '👍', _count: { emoji: 5 } }, ...]
```

**Benefits**:
- ✅ Prevents duplicate reactions
- ✅ Efficient aggregation
- ✅ Real-time updates via WebSocket

---

### 5. Message Mentions (GAP 14)

**Challenge**: Parse @username mentions and send notifications

**Solution**: Regex parsing + notification service

**Implementation**:
```typescript
// Parse mentions from content
function parseMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g
  const matches = content.matchAll(mentionRegex)
  return Array.from(matches, m => m[1])
}

// In sendMessage()
const usernames = parseMentions(content)
const userIds = await resolveUsernames(usernames)

// Create mention records
await prisma.messageMention.createMany({
  data: userIds.map(userId => ({
    messageId: message.id,
    userId
  }))
})

// Send push notifications
for (const userId of userIds) {
  await notificationsService.sendMentionNotification(userId, message)
}
```

**Benefits**:
- ✅ Real-time mention notifications
- ✅ Mention history per user
- ✅ Supports @username syntax

---

### 6. Rate Limiting (GAP 26)

**Challenge**: Prevent message flooding and spam

**Solution**: Track message count per participant with Redis

**Implementation**:
```typescript
// Check rate limit before sending message
const key = `rate_limit:${conversationId}:${userId}`
const count = await redis.incr(key)

if (count === 1) {
  // Set 24-hour expiration on first message
  await redis.expire(key, 86400)
}

const RATE_LIMIT = 100
if (count > RATE_LIMIT) {
  throw new HttpException('Rate limit exceeded', 429)
}

// Also update database for persistence
await prisma.conversationParticipant.update({
  where: { id: participantId },
  data: {
    messageCount24h: { increment: 1 },
    lastMessageAt: new Date()
  }
})
```

**Benefits**:
- ✅ Prevents spam and abuse
- ✅ Distributed rate limiting with Redis
- ✅ Configurable limits per user type

---

### 7. Soft Delete with Audit Trail (GAP 7)

**Challenge**: Delete messages while preserving audit trail

**Solution**: Soft delete with deletion type tracking

**Implementation**:
```typescript
// Soft delete
await prisma.message.update({
  where: { id: messageId },
  data: {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: userId,
    deletionType: DeletionType.USER_DELETED
  }
})

// Filter deleted messages from queries
const messages = await prisma.message.findMany({
  where: {
    conversationId,
    isDeleted: false // Always filter deleted
  }
})

// Hard delete for GDPR compliance
await prisma.message.delete({
  where: { id: messageId }
})
```

**Benefits**:
- ✅ Preserves audit trail
- ✅ Supports GDPR "right to be forgotten"
- ✅ Tracks deletion reason

---

### 8. Conversation Metrics (GAP 28)

**Challenge**: Display conversation stats without expensive queries

**Solution**: Cached metrics updated on message events

**Implementation**:
```typescript
// Update metrics on new message
await prisma.conversation.update({
  where: { id: conversationId },
  data: {
    messageCount: { increment: 1 },
    lastActivityAt: new Date(),
    // Calculate average response time
    avgResponseTime: calculateAvgResponseTime(conversation)
  }
})

// Recalculate participant count on join/leave
await prisma.conversation.update({
  where: { id: conversationId },
  data: {
    participantCount: {
      set: await prisma.conversationParticipant.count({
        where: { conversationId }
      })
    }
  }
})
```

**Benefits**:
- ✅ Fast queries (no aggregation needed)
- ✅ Real-time metrics
- ✅ Supports analytics and reporting

---

### 9. Azure Container Apps Deployment

**Challenge**: Deploy scalable WebSocket server on Azure

**Solution**: Azure Container Apps with auto-scaling

**Configuration**:
```bicep
resource messagingApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'messaging-api'
  location: resourceGroup().location
  properties: {
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto' // Supports WebSocket
        allowInsecure: false
      }
      secrets: [
        {
          name: 'database-url'
          value: databaseUrl
        }
        {
          name: 'redis-url'
          value: redisUrl
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'messaging-api'
          image: 'acrwc.azurecr.io/wc-nest-api:latest'
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: [
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'REDIS_URL'
              secretRef: 'redis-url'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 3
        maxReplicas: 10
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}
```

**Benefits**:
- ✅ Auto-scaling based on load
- ✅ Built-in load balancer
- ✅ WebSocket support
- ✅ Managed infrastructure

---

### 10. Performance Optimization Strategies

#### Database Optimization
- ✅ Use composite indexes for cursor pagination
- ✅ Use GIN index for full-text search
- ✅ Use connection pooling (Prisma default: 10 connections)
- ✅ Use `select` to fetch only needed fields
- ✅ Use `include` instead of multiple queries
- ✅ Use database transactions for consistency

#### Redis Optimization
- ✅ Use Redis for caching frequently accessed data
- ✅ Use Redis pub/sub for WebSocket scaling
- ✅ Set appropriate TTLs (presence: 5min, typing: 5sec)
- ✅ Use Redis pipelines for bulk operations
- ✅ Use Redis Cluster for high availability

#### WebSocket Optimization
- ✅ Use Socket.io rooms for targeted broadcasting
- ✅ Use binary encoding for large payloads
- ✅ Implement heartbeat/ping-pong for connection health
- ✅ Use compression for message payloads
- ✅ Implement reconnection with exponential backoff

#### API Optimization
- ✅ Use cursor-based pagination (not offset)
- ✅ Implement response caching with Redis
- ✅ Use ETags for conditional requests
- ✅ Compress responses with gzip
- ✅ Implement request batching where possible

---

## Conclusion

This comprehensive backend implementation plan provides a clear roadmap for building a production-grade messaging system for World Schools. The plan is organized into 8 phases with 87 tasks, covering everything from database setup to deployment and monitoring.

### Key Takeaways

1. **MVP First**: Focus on core messaging features (Phases 1-5) to deliver value quickly (3-4 weeks)
2. **Incremental Enhancement**: Add advanced features (Phase 6) incrementally based on user feedback
3. **Security & Compliance**: Implement rate limiting, abuse reporting, and GDPR compliance (Phase 7)
4. **Comprehensive Testing**: Write unit, integration, and E2E tests for reliability (Phase 8)
5. **Scalable Architecture**: Use Redis pub/sub and Azure Container Apps for horizontal scaling
6. **Performance Optimization**: Use cursor pagination, full-text search, and caching for speed

### Next Steps

1. **Review and Approve**: Review this plan with the team and get approval
2. **Set Up Project**: Create NestJS module structure and install dependencies
3. **Start Phase 1**: Generate Prisma migration and set up full-text search
4. **Follow the Plan**: Execute phases sequentially, marking tasks complete
5. **Iterate and Improve**: Gather feedback and adjust plan as needed

**The messaging system is ready to be built!** 🚀

---

**Document Version**: 1.0
**Last Updated**: 2026-02-10
**Status**: Ready for Implementation ✅
**Total Pages**: ~50 pages
**Total Tasks**: 87 tasks across 8 phases


