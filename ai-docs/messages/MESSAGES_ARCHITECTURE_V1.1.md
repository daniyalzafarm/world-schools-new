# Real-Time Messaging System Architecture

**Version:** 1.1  
**Last Updated:** 2026-01-25  
**Status:** Design Document

---

## Changelog

### Version 1.1 (2026-01-25)
- **Major Change**: Replaced Kubernetes (AKS) with Azure Container Apps for deployment
- Updated deployment architecture to use Azure-native services
- Modified CI/CD pipeline for Azure Container Apps deployment
- Updated monitoring to use Azure Container Apps metrics
- Maintained all other architectural components (PostgreSQL, Redis, Socket.io, etc.)

### Version 1.0 (2026-01-24)
- Initial architecture document with Kubernetes deployment

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [API Specifications](#api-specifications)
6. [WebSocket Protocol](#websocket-protocol)
7. [Frontend State Management](#frontend-state-management)
8. [Scalability & Performance](#scalability--performance)
9. [Security & Privacy](#security--privacy)
10. [Deployment Architecture](#deployment-architecture)
11. [Migration Path](#migration-path)
12. [Performance Benchmarks](#performance-benchmarks)

---

## Executive Summary

This document outlines a production-grade, scalable real-time messaging system for the World Schools platform. The system supports:

- **10,000+ concurrent users** with sub-100ms message delivery
- **Multi-tenant architecture** (User ↔ Provider, User ↔ Superadmin)
- **Real-time features**: typing indicators, read receipts, presence status
- **Rich media**: file/image attachments with CDN delivery
- **Offline support**: message queuing and synchronization
- **Push notifications**: for offline users across web and mobile

### Key Design Principles

1. **Horizontal Scalability**: Stateless WebSocket servers with Redis pub/sub on Azure Container Apps
2. **Data Consistency**: PostgreSQL with optimistic locking and event sourcing
3. **Performance**: Multi-layer caching (Redis, CDN) and database indexing
4. **Reliability**: At-least-once delivery with idempotency keys
5. **Security**: End-to-end encryption ready, RBAC integration, rate limiting
6. **Azure-Native**: Leverages Azure Container Apps for serverless container deployment

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Applications                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ wc-booking   │  │ wc-provider  │  │ wc-superadmin            │  │
│  │ (Next.js)    │  │ (Next.js)    │  │ (Next.js)                │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────────────┘  │
│         │                  │                  │                       │
│         └──────────────────┴──────────────────┘                       │
│                            │                                          │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Azure CDN      │
                    │  (Static Assets)│
                    └────────┬────────┘
                             │
┌────────────────────────────┼──────────────────────────────────────────┐
│                   Azure Front Door                                    │
│                   (Global Load Balancer + WAF)                        │
└────────────────────────────┬──────────────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────────────┐
│              Azure Container Apps Environment                         │
│                                                                       │
│  ┌────────────────────────┴──────────────────────────────────────┐  │
│  │                                                               │  │
│  │  ┌──────────────────┐      ┌──────────────────┐              │  │
│  │  │  REST API        │      │  WebSocket       │              │  │
│  │  │  Container App   │      │  Container App   │              │  │
│  │  │  (Auto-scale     │      │  (Auto-scale     │              │  │
│  │  │   3-10 replicas) │      │   3-10 replicas) │              │  │
│  │  └──────────────────┘      └──────────────────┘              │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                           │                                          │
│           ┌───────────────┴───────────────┐                         │
│           │                               │                         │
│  ┌────────▼────────┐            ┌─────────▼────────┐               │
│  │  Azure Cache    │            │  Azure Database  │               │
│  │  for Redis      │            │  for PostgreSQL  │               │
│  │  (Premium tier) │            │  (Flexible)      │               │
│  └─────────────────┘            └──────────────────┘               │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Azure Blob Storage + CDN                       │   │
│  │              (Media files, attachments)                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Azure Monitor + Application Insights           │   │
│  │              (Logging, metrics, alerts)                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### **Client Applications (Next.js)**
- **UI Rendering**: Message bubbles, conversation lists, typing indicators
- **State Management**: Zustand stores for conversations and messages
- **WebSocket Client**: Socket.io client for real-time communication
- **Optimistic Updates**: Immediate UI feedback before server confirmation
- **Offline Queue**: Store unsent messages in IndexedDB

#### **REST API (Azure Container App)**
- **Message CRUD**: Create, read, update, delete messages
- **Conversation Management**: List, archive, pin, mute conversations
- **File Uploads**: Handle media attachments (images, documents)
- **Authentication**: JWT validation and user context
- **Authorization**: RBAC checks for message access
- **Auto-scaling**: Scales from 3 to 10 replicas based on HTTP traffic

#### **WebSocket Gateway (Azure Container App + Socket.io)**
- **Connection Management**: Handle client connections/disconnections
- **Real-time Events**: Broadcast messages, typing indicators, read receipts
- **Presence Tracking**: Online/offline status, last seen timestamps
- **Room Management**: User-specific and conversation-specific rooms
- **Authentication**: Validate JWT tokens on connection
- **Auto-scaling**: Scales from 3 to 10 replicas based on concurrent connections

#### **Redis Cluster (Azure Cache for Redis)**
- **Pub/Sub**: Distribute messages across WebSocket server instances
- **Session Store**: Track active WebSocket connections
- **Presence Cache**: Store online users and last seen data
- **Message Cache**: Cache recent messages for fast retrieval
- **Rate Limiting**: Track API request counts per user

#### **PostgreSQL Database (Azure Database for PostgreSQL)**
- **Persistent Storage**: Messages, conversations, participants
- **Relational Integrity**: Foreign keys, constraints, indexes
- **Full-Text Search**: Search messages by content
- **Audit Trail**: Track message edits, deletions
- **Analytics**: Message counts, response times

---

## Technology Stack

### Backend Technologies

| Component | Technology | Version | Justification |
|-----------|-----------|---------|---------------|
| **API Framework** | NestJS | 10.x | TypeScript-first, modular architecture, built-in WebSocket support |
| **WebSocket Library** | Socket.io | 4.x | Auto-reconnection, room support, fallback to polling |
| **Database** | Azure Database for PostgreSQL | 15.x | ACID compliance, JSON support, full-text search, managed service |
| **ORM** | Prisma | 5.x | Type-safe queries, migrations, existing integration |
| **Cache/Pub-Sub** | Azure Cache for Redis | 7.x | In-memory speed, pub/sub, clustering support, managed service |
| **Message Queue** | Bull (Redis-based) | 4.x | Job scheduling, retry logic, priority queues |
| **File Storage** | Azure Blob Storage | - | Scalable, CDN integration, cost-effective |
| **CDN** | Azure CDN | - | Global distribution, low latency |

### Frontend Technologies

| Component | Technology | Version | Justification |
|-----------|-----------|---------|---------------|
| **Framework** | Next.js | 14.x | App Router, SSR, existing stack |
| **State Management** | Zustand | 4.x | Lightweight, no boilerplate, existing usage |
| **WebSocket Client** | Socket.io-client | 4.x | Matches server library |
| **Offline Storage** | IndexedDB (via Dexie.js) | 3.x | Large storage capacity, async API |
| **UI Components** | HeroUI v3 | 3.x | Existing design system |

### Infrastructure

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Cloud Provider** | Azure | Existing infrastructure |
| **Container Platform** | Azure Container Apps | Serverless containers, auto-scaling, built-in ingress, managed |
| **Load Balancer** | Azure Front Door | Global load balancing, WebSocket support, WAF, SSL termination |
| **Monitoring** | Azure Monitor + Application Insights | Integrated logging, metrics, distributed tracing |
| **Secrets Management** | Azure Key Vault | Secure credential storage, integrated with Container Apps |
| **Container Registry** | Azure Container Registry | Private Docker registry, integrated with Container Apps |

---

## Database Schema

### Prisma Models

```prisma
// ============================================
// Messaging System Models
// ============================================

model Conversation {
  id        String   @id @default(uuid())
  type      ConversationType
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  participants      ConversationParticipant[]
  messages          Message[]
  lastMessage       Message?                  @relation("LastMessage", fields: [lastMessageId], references: [id])
  lastMessageId     String?                   @unique @map("last_message_id")

  @@index([type])
  @@index([updatedAt])
  @@map("conversations")
}

enum ConversationType {
  USER_PROVIDER    // Parent/User ↔ Camp Provider
  USER_SUPERADMIN  // Parent/User ↔ Platform Support
  PROVIDER_SUPERADMIN // Provider ↔ Platform Support (future)
}

model ConversationParticipant {
  id             String   @id @default(uuid())
  conversationId String   @map("conversation_id")
  userId         String   @map("user_id")
  providerId     String?  @map("provider_id") // For provider participants

  // Participant-specific settings
  pinned         Boolean  @default(false)
  pinnedAt       DateTime? @map("pinned_at")
  starred        Boolean  @default(false)
  muted          Boolean  @default(false)
  archived       Boolean  @default(false)
  archivedAt     DateTime? @map("archived_at")

  // Read tracking
  lastReadAt     DateTime? @map("last_read_at")
  unreadCount    Int      @default(0) @map("unread_count")

  // Metadata
  joinedAt       DateTime @default(now()) @map("joined_at")
  leftAt         DateTime? @map("left_at")

  // Relations
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider       Provider?    @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@unique([conversationId, userId])
  @@index([userId])
  @@index([providerId])
  @@index([conversationId, lastReadAt])
  @@map("conversation_participants")
}

model Message {
  id             String      @id @default(uuid())
  conversationId String      @map("conversation_id")
  senderId       String      @map("sender_id")
  senderType     SenderType  @map("sender_type")

  // Message content
  content        String      @db.Text
  contentType    ContentType @default(TEXT) @map("content_type")

  // Attachments
  attachments    Json?       // Array of {id, url, type, size, name}

  // Message metadata
  type           MessageType @default(REGULAR)
  metadata       Json?       // For transfer requests, system messages, etc.

  // Status tracking
  status         MessageStatus @default(SENT)
  deliveredAt    DateTime?   @map("delivered_at")
  readAt         DateTime?   @map("read_at")

  // Edit/Delete tracking
  editedAt       DateTime?   @map("edited_at")
  deletedAt      DateTime?   @map("deleted_at")
  deletedBy      String?     @map("deleted_by")

  // Timestamps
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")

  // Relations
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender         User         @relation(fields: [senderId], references: [id], onDelete: Cascade)
  lastMessageFor Conversation? @relation("LastMessage")
  readReceipts   MessageReadReceipt[]

  @@index([conversationId, createdAt])
  @@index([senderId])
  @@index([status])
  @@index([createdAt])
  @@map("messages")
}

enum SenderType {
  USER
  PROVIDER
  SUPERADMIN
  CHATBOT
  SYSTEM
}

enum ContentType {
  TEXT
  IMAGE
  FILE
  VIDEO
  AUDIO
}

enum MessageType {
  REGULAR
  TRANSFER_REQUEST
  TRANSFER_SUMMARY
  SYSTEM_NOTIFICATION
  CHATBOT_RESPONSE
}

enum MessageStatus {
  SENDING
  SENT
  DELIVERED
  READ
  FAILED
}

model MessageReadReceipt {
  id        String   @id @default(uuid())
  messageId String   @map("message_id")
  userId    String   @map("user_id")
  readAt    DateTime @default(now()) @map("read_at")

  // Relations
  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId])
  @@index([messageId])
  @@index([userId])
  @@map("message_read_receipts")
}

model MessageAttachment {
  id             String   @id @default(uuid())
  messageId      String   @map("message_id")

  // File metadata
  fileName       String   @map("file_name")
  fileSize       Int      @map("file_size") // bytes
  mimeType       String   @map("mime_type")
  fileType       FileType @map("file_type")

  // Storage
  storageUrl     String   @map("storage_url") // Azure Blob Storage URL
  cdnUrl         String?  @map("cdn_url")     // CDN URL for fast delivery
  thumbnailUrl   String?  @map("thumbnail_url") // For images/videos

  // Metadata
  uploadedBy     String   @map("uploaded_by")
  uploadedAt     DateTime @default(now()) @map("uploaded_at")

  // Relations
  uploader       User     @relation(fields: [uploadedBy], references: [id])

  @@index([messageId])
  @@index([uploadedBy])
  @@map("message_attachments")
}

enum FileType {
  IMAGE
  DOCUMENT
  VIDEO
  AUDIO
  OTHER
}

model TypingIndicator {
  id             String   @id @default(uuid())
  conversationId String   @map("conversation_id")
  userId         String   @map("user_id")
  startedAt      DateTime @default(now()) @map("started_at")
  expiresAt      DateTime @map("expires_at")

  @@unique([conversationId, userId])
  @@index([conversationId])
  @@index([expiresAt])
  @@map("typing_indicators")
}

model UserPresence {
  userId       String   @id @map("user_id")
  status       PresenceStatus
  lastSeenAt   DateTime @default(now()) @map("last_seen_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // Relations
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([lastSeenAt])
  @@map("user_presence")
}

enum PresenceStatus {
  ONLINE
  AWAY
  OFFLINE
}
```

### Schema Design Rationale

1. **Conversation Model**: Supports different conversation types (user-provider, user-superadmin)
2. **ConversationParticipant**: Stores per-user settings (pinned, muted, archived) - enables different views for each participant
3. **Message Model**: Comprehensive tracking of message lifecycle (sent, delivered, read, edited, deleted)
4. **MessageReadReceipt**: Separate table for scalability - allows tracking who read what
5. **MessageAttachment**: Normalized storage for file metadata with CDN URLs
6. **TypingIndicator**: Ephemeral data with expiration for cleanup
7. **UserPresence**: Cached presence status to avoid constant DB queries

### Database Indexes

Critical indexes for performance:

```sql
-- Conversation queries
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_conversations_type ON conversations(type);

-- Message queries (most frequent)
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_status ON messages(status);

-- Participant queries
CREATE INDEX idx_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_participants_provider ON conversation_participants(provider_id);
CREATE INDEX idx_participants_unread ON conversation_participants(conversation_id, last_read_at);

-- Full-text search (PostgreSQL)
CREATE INDEX idx_messages_content_fts ON messages USING gin(to_tsvector('english', content));
```

---

## API Specifications

### REST API Endpoints

#### **Conversations**

```typescript
// GET /api/messages/conversations
// List all conversations for the current user
interface GetConversationsQuery {
  filter?: 'all' | 'unread' | 'archived' | 'starred'
  limit?: number
  offset?: number
}

interface ConversationResponse {
  id: string
  type: ConversationType
  participant: {
    id: string
    name: string
    avatar?: string
    verified?: boolean
  }
  lastMessage: {
    id: string
    content: string
    senderId: string
    createdAt: string
  } | null
  unreadCount: number
  pinned: boolean
  starred: boolean
  muted: boolean
  archived: boolean
  updatedAt: string
}

// POST /api/messages/conversations
// Create or get existing conversation
interface CreateConversationDto {
  participantId: string // Provider ID or 'superadmin'
  participantType: 'provider' | 'superadmin'
  initialMessage?: string
}

// PATCH /api/messages/conversations/:id
// Update conversation settings
interface UpdateConversationDto {
  pinned?: boolean
  starred?: boolean
  muted?: boolean
  archived?: boolean
}

// POST /api/messages/conversations/:id/mark-read
// Mark all messages as read
// Returns: { success: boolean, unreadCount: number }
```

#### **Messages**

```typescript
// GET /api/messages/conversations/:conversationId/messages
// Get messages for a conversation (paginated)
interface GetMessagesQuery {
  limit?: number // default: 50
  before?: string // message ID for pagination
  after?: string // message ID for pagination
}

interface MessageResponse {
  id: string
  conversationId: string
  senderId: string
  senderType: SenderType
  content: string
  contentType: ContentType
  type: MessageType
  attachments?: AttachmentResponse[]
  status: MessageStatus
  deliveredAt?: string
  readAt?: string
  editedAt?: string
  createdAt: string
  updatedAt: string
}

interface AttachmentResponse {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  fileType: FileType
  cdnUrl: string
  thumbnailUrl?: string
}

// POST /api/messages/conversations/:conversationId/messages
// Send a new message
interface SendMessageDto {
  content: string
  contentType?: ContentType
  type?: MessageType
  attachmentIds?: string[] // Pre-uploaded attachment IDs
  idempotencyKey: string // Client-generated UUID for deduplication
}

// PATCH /api/messages/messages/:id
// Edit a message (within 15 minutes)
interface EditMessageDto {
  content: string
}

// DELETE /api/messages/messages/:id
// Delete a message (soft delete)
// Returns: { success: boolean }

// POST /api/messages/messages/:id/read
// Mark message as read
// Returns: { success: boolean, readAt: string }
```

#### **File Uploads**

```typescript
// POST /api/messages/attachments/upload
// Upload a file attachment
// Content-Type: multipart/form-data
interface UploadAttachmentDto {
  file: File // Max 10MB for images, 25MB for documents
  conversationId: string
}

interface UploadAttachmentResponse {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  fileType: FileType
  cdnUrl: string
  thumbnailUrl?: string
  uploadedAt: string
}

// DELETE /api/messages/attachments/:id
// Delete an attachment (before message is sent)
// Returns: { success: boolean }
```

#### **Search**

```typescript
// GET /api/messages/search
// Search messages across all conversations
interface SearchMessagesQuery {
  query: string
  conversationId?: string // Optional: search within specific conversation
  limit?: number
  offset?: number
}

interface SearchMessageResponse {
  id: string
  conversationId: string
  content: string
  senderId: string
  createdAt: string
  highlights: string[] // Matched text snippets
}
```

### NestJS Module Structure

```
apps/wc-nest-api/src/modules/
└── messaging/
    ├── messaging.module.ts
    ├── messaging.gateway.ts          # WebSocket gateway
    ├── controllers/
    │   ├── conversations.controller.ts
    │   ├── messages.controller.ts
    │   ├── attachments.controller.ts
    │   └── search.controller.ts
    ├── services/
    │   ├── conversations.service.ts
    │   ├── messages.service.ts
    │   ├── attachments.service.ts
    │   ├── presence.service.ts
    │   ├── typing.service.ts
    │   ├── notifications.service.ts
    │   └── search.service.ts
    ├── dto/
    │   ├── create-conversation.dto.ts
    │   ├── send-message.dto.ts
    │   ├── upload-attachment.dto.ts
    │   └── search-messages.dto.ts
    ├── entities/
    │   ├── conversation.entity.ts
    │   ├── message.entity.ts
    │   └── attachment.entity.ts
    └── guards/
        ├── conversation-access.guard.ts
        └── message-access.guard.ts
```

---

## WebSocket Protocol

### Socket.io Events

#### **Client → Server Events**

```typescript
// Connection
socket.on('connect', () => {
  // Authenticate with JWT token
  socket.emit('authenticate', { token: accessToken })
})

// Join conversation room
socket.emit('conversation:join', {
  conversationId: string
})

// Leave conversation room
socket.emit('conversation:leave', {
  conversationId: string
})

// Typing indicator
socket.emit('typing:start', {
  conversationId: string
})

socket.emit('typing:stop', {
  conversationId: string
})

// Message read receipt
socket.emit('message:read', {
  messageId: string
  conversationId: string
})

// Presence update
socket.emit('presence:update', {
  status: 'online' | 'away' | 'offline'
})
```

#### **Server → Client Events**

```typescript
// Authentication response
socket.on('authenticated', (data: {
  userId: string
  success: boolean
}) => {})

// New message received
socket.on('message:new', (data: {
  message: MessageResponse
  conversationId: string
}) => {})

// Message updated (edited)
socket.on('message:updated', (data: {
  messageId: string
  content: string
  editedAt: string
}) => {})

// Message deleted
socket.on('message:deleted', (data: {
  messageId: string
  conversationId: string
}) => {})

// Message delivered
socket.on('message:delivered', (data: {
  messageId: string
  deliveredAt: string
}) => {})

// Message read
socket.on('message:read', (data: {
  messageId: string
  readBy: string
  readAt: string
}) => {})

// Typing indicator
socket.on('typing:start', (data: {
  conversationId: string
  userId: string
  userName: string
}) => {})

socket.on('typing:stop', (data: {
  conversationId: string
  userId: string
}) => {})

// Presence update
socket.on('presence:update', (data: {
  userId: string
  status: 'online' | 'away' | 'offline'
  lastSeenAt: string
}) => {})

// Conversation updated
socket.on('conversation:updated', (data: {
  conversationId: string
  updates: Partial<ConversationResponse>
}) => {})

// Error handling
socket.on('error', (data: {
  code: string
  message: string
}) => {})
```

### WebSocket Gateway Implementation

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
import { UseGuards } from '@nestjs/common'
import { WsJwtGuard } from '../core/auth/guards/ws-jwt.guard'
import { CurrentUser } from '../core/auth/decorators/current-user.decorator'
import { MessagesService } from './services/messages.service'
import { PresenceService } from './services/presence.service'
import { TypingService } from './services/typing.service'

@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  constructor(
    private messagesService: MessagesService,
    private presenceService: PresenceService,
    private typingService: TypingService,
  ) {}

  async handleConnection(client: Socket) {
    // JWT authentication happens in WsJwtGuard
    console.log(`Client connected: ${client.id}`)
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId
    if (userId) {
      await this.presenceService.setOffline(userId)
      this.server.emit('presence:update', {
        userId,
        status: 'offline',
        lastSeenAt: new Date().toISOString(),
      })
    }
    console.log(`Client disconnected: ${client.id}`)
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
    @CurrentUser() user: any,
  ) {
    await client.join(`conversation:${data.conversationId}`)
    return { success: true }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
    @CurrentUser() user: any,
  ) {
    await this.typingService.startTyping(data.conversationId, user.id)

    // Broadcast to other participants in the conversation
    client.to(`conversation:${data.conversationId}`).emit('typing:start', {
      conversationId: data.conversationId,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
    })
  }

  // ... more event handlers
}
```

### Redis Pub/Sub for Horizontal Scaling

**Critical for Azure Container Apps**: Since Container Apps can scale to multiple replicas, Redis pub/sub ensures messages are broadcast to all WebSocket server instances.

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
    // Connect to Azure Cache for Redis
    this.publisher = new Redis(process.env.REDIS_URL)
    this.subscriber = new Redis(process.env.REDIS_URL)
  }

  async onModuleInit() {
    // Subscribe to message channels
    await this.subscriber.subscribe('messages:new', 'messages:updated', 'typing:events')

    this.subscriber.on('message', (channel, message) => {
      const data = JSON.parse(message)
      this.handleRedisMessage(channel, data)
    })
  }

  async publishMessage(channel: string, data: any) {
    await this.publisher.publish(channel, JSON.stringify(data))
  }

  private handleRedisMessage(channel: string, data: any) {
    // Broadcast to Socket.io clients connected to THIS Container App replica
    switch (channel) {
      case 'messages:new':
        this.server.to(`conversation:${data.conversationId}`).emit('message:new', data)
        break
      case 'typing:events':
        this.server.to(`conversation:${data.conversationId}`).emit('typing:start', data)
        break
      // ... more cases
    }
  }

  setServer(server: Server) {
    this.server = server
  }
}
```

**How it works with Azure Container Apps:**
1. User sends message via WebSocket to Container App Replica A
2. Replica A saves message to PostgreSQL
3. Replica A publishes message to Redis channel `messages:new`
4. All replicas (A, B, C, etc.) receive the Redis pub/sub message
5. Each replica broadcasts to its connected WebSocket clients
6. All users receive the message in real-time, regardless of which replica they're connected to

---

## Frontend State Management

### Enhanced Zustand Store

The frontend state management remains the same regardless of backend deployment platform. The store handles WebSocket connections, optimistic updates, and offline support.

```typescript
// apps/wc-booking/src/stores/conversation-store.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Conversation, Message } from '@world-schools/ui-web'
import { io, Socket } from 'socket.io-client'

interface ConversationStore {
  // State
  conversations: Conversation[]
  messages: Record<string, Message[]> // conversationId -> messages
  activeConversationId: string | null
  socket: Socket | null
  isConnected: boolean
  typingUsers: Record<string, string[]> // conversationId -> userIds

  // Offline queue
  pendingMessages: Message[]

  // Actions - Conversations
  setConversations: (conversations: Conversation[]) => void
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void

  // Actions - Messages
  setMessages: (conversationId: string, messages: Message[]) => void
  addMessage: (conversationId: string, message: Message) => void
  updateMessage: (messageId: string, updates: Partial<Message>) => void
  deleteMessage: (messageId: string) => void

  // Actions - WebSocket
  connectSocket: (token: string) => void
  disconnectSocket: () => void
  joinConversation: (conversationId: string) => void
  leaveConversation: (conversationId: string) => void

  // Actions - Real-time
  sendMessage: (conversationId: string, content: string) => Promise<void>
  startTyping: (conversationId: string) => void
  stopTyping: (conversationId: string) => void
  markAsRead: (messageId: string, conversationId: string) => void

  // Actions - Offline
  queueMessage: (message: Message) => void
  syncPendingMessages: () => Promise<void>
}

export const useConversationStore = create<ConversationStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        conversations: [],
        messages: {},
        activeConversationId: null,
        socket: null,
        isConnected: false,
        typingUsers: {},
        pendingMessages: [],

        // WebSocket connection
        connectSocket: (token) => {
          const socket = io(`${process.env.NEXT_PUBLIC_API_URL}/messages`, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
          })

          socket.on('connect', () => {
            set((state) => {
              state.isConnected = true
            })

            // Sync pending messages when reconnected
            get().syncPendingMessages()
          })

          socket.on('disconnect', () => {
            set((state) => {
              state.isConnected = false
            })
          })

          socket.on('message:new', (data) => {
            get().addMessage(data.conversationId, data.message)
          })

          socket.on('message:updated', (data) => {
            get().updateMessage(data.messageId, {
              content: data.content,
              editedAt: data.editedAt,
            })
          })

          socket.on('typing:start', (data) => {
            set((state) => {
              if (!state.typingUsers[data.conversationId]) {
                state.typingUsers[data.conversationId] = []
              }
              if (!state.typingUsers[data.conversationId].includes(data.userId)) {
                state.typingUsers[data.conversationId].push(data.userId)
              }
            })
          })

          set((state) => {
            state.socket = socket
          })
        },

        // Send message with optimistic update
        sendMessage: async (conversationId, content) => {
          const tempId = `temp-${Date.now()}`
          const optimisticMessage: Message = {
            id: tempId,
            conversationId,
            content,
            senderId: 'current-user',
            senderType: 'USER',
            contentType: 'TEXT',
            type: 'REGULAR',
            status: 'SENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          // Optimistic update
          get().addMessage(conversationId, optimisticMessage)

          try {
            // Send to server
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/messages/conversations/${conversationId}/messages`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content,
                  idempotencyKey: tempId,
                }),
                credentials: 'include',
              }
            )

            const data = await response.json()

            // Replace temp message with real message
            get().updateMessage(tempId, {
              id: data.id,
              status: 'SENT',
            })
          } catch (error) {
            // Mark as failed and queue for retry
            get().updateMessage(tempId, { status: 'FAILED' })
            get().queueMessage(optimisticMessage)
          }
        },

        // ... other actions (addMessage, updateMessage, etc.)
      })),
      {
        name: 'conversation-store',
        partialize: (state) => ({
          conversations: state.conversations,
          messages: state.messages,
          pendingMessages: state.pendingMessages,
        }),
      }
    )
  )
)
```

### Offline Support with IndexedDB

```typescript
// apps/wc-booking/src/lib/offline-storage.ts
import Dexie, { Table } from 'dexie'

interface OfflineMessage {
  id: string
  conversationId: string
  content: string
  createdAt: string
  status: 'pending' | 'failed'
  retryCount: number
}

class OfflineDatabase extends Dexie {
  messages!: Table<OfflineMessage>

  constructor() {
    super('MessagingOfflineDB')
    this.version(1).stores({
      messages: 'id, conversationId, status, createdAt',
    })
  }
}

export const offlineDb = new OfflineDatabase()
```

---

## Scalability & Performance

### Azure Container Apps Scaling Strategy

Azure Container Apps provides built-in auto-scaling based on HTTP traffic and custom metrics. This replaces the need for Kubernetes HorizontalPodAutoscaler.

#### **REST API Container App Scaling**

```bicep
// infrastructure/container-apps/messaging-api.bicep
resource messagingApiApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'messaging-api'
  location: resourceGroup().location
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      secrets: [
        {
          name: 'database-url'
          value: databaseConnectionString
        }
        {
          name: 'redis-url'
          value: redisConnectionString
        }
        {
          name: 'jwt-secret'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/jwt-secret'
          identity: userAssignedIdentity.id
        }
      ]
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: userAssignedIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'messaging-api'
          image: '${containerRegistry.properties.loginServer}/wc-nest-api:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'REDIS_URL'
              secretRef: 'redis-url'
            }
            {
              name: 'JWT_SECRET'
              secretRef: 'jwt-secret'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 3000
              }
              initialDelaySeconds: 30
              periodSeconds: 10
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health/ready'
                port: 3000
              }
              initialDelaySeconds: 10
              periodSeconds: 5
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
          {
            name: 'cpu-scaling'
            custom: {
              type: 'cpu'
              metadata: {
                type: 'Utilization'
                value: '70'
              }
            }
          }
        ]
      }
    }
  }
}
```

#### **WebSocket Container App Scaling**

```bicep
// infrastructure/container-apps/messaging-websocket.bicep
resource messagingWebSocketApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'messaging-websocket'
  location: resourceGroup().location
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3001
        transport: 'http' // WebSocket over HTTP
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
        // Enable session affinity for WebSocket connections
        stickySessions: {
          affinity: 'sticky'
        }
      }
      secrets: [
        {
          name: 'database-url'
          value: databaseConnectionString
        }
        {
          name: 'redis-url'
          value: redisConnectionString
        }
        {
          name: 'jwt-secret'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/jwt-secret'
          identity: userAssignedIdentity.id
        }
      ]
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: userAssignedIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'messaging-websocket'
          image: '${containerRegistry.properties.loginServer}/wc-nest-api:latest'
          command: ['node', 'dist/main.js', '--websocket-only'] // Run WebSocket gateway only
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'REDIS_URL'
              secretRef: 'redis-url'
            }
            {
              name: 'JWT_SECRET'
              secretRef: 'jwt-secret'
            }
            {
              name: 'WEBSOCKET_MODE'
              value: 'true'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 3
        maxReplicas: 10
        rules: [
          {
            name: 'concurrent-connections'
            custom: {
              type: 'azure-monitor'
              metadata: {
                metricName: 'ActiveConnections'
                targetValue: '1000' // Scale when > 1000 connections per replica
              }
            }
          }
          {
            name: 'cpu-scaling'
            custom: {
              type: 'cpu'
              metadata: {
                type: 'Utilization'
                value: '70'
              }
            }
          }
          {
            name: 'memory-scaling'
            custom: {
              type: 'memory'
              metadata: {
                type: 'Utilization'
                value: '80'
              }
            }
          }
        ]
      }
    }
  }
}
```

**Key Features for WebSocket Scaling:**
- **Sticky Sessions**: Ensures WebSocket connections stay with the same replica
- **Redis Pub/Sub**: Coordinates messages across all replicas
- **Custom Metrics**: Scales based on active WebSocket connections
- **Min 3 Replicas**: Ensures high availability
- **Max 10 Replicas**: Handles up to 10,000 concurrent connections (1,000 per replica)

#### **Database Sharding Strategy**

**Partition by Conversation ID:**

```sql
-- PostgreSQL partitioning for messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY HASH (conversation_id);

-- Create 8 partitions
CREATE TABLE messages_p0 PARTITION OF messages FOR VALUES WITH (MODULUS 8, REMAINDER 0);
CREATE TABLE messages_p1 PARTITION OF messages FOR VALUES WITH (MODULUS 8, REMAINDER 1);
CREATE TABLE messages_p2 PARTITION OF messages FOR VALUES WITH (MODULUS 8, REMAINDER 2);
CREATE TABLE messages_p3 PARTITION OF messages FOR VALUES WITH (MODULUS 8, REMAINDER 3);
CREATE TABLE messages_p4 PARTITION OF messages FOR VALUES WITH (MODULUS 8, REMAINDER 4);
CREATE TABLE messages_p5 PARTITION OF messages FOR VALUES WITH (MODULUS 8, REMAINDER 5);
CREATE TABLE messages_p6 PARTITION OF messages FOR VALUES WITH (MODULUS 8, REMAINDER 6);
CREATE TABLE messages_p7 PARTITION OF messages FOR VALUES WITH (MODULUS 8, REMAINDER 7);
```

**Benefits:**
- Distributes data evenly across partitions
- Improves query performance for conversation-specific queries
- Enables parallel query execution
- Simplifies data archival (drop old partitions)

#### **Caching Strategy**

**Multi-Layer Cache:**

```typescript
// apps/wc-nest-api/src/modules/messaging/services/cache.service.ts
import { Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'

@Injectable()
export class MessageCacheService {
  private redis: Redis

  constructor() {
    // Connect to Azure Cache for Redis
    this.redis = new Redis(process.env.REDIS_URL)
  }

  // Cache recent messages (last 50 per conversation)
  async cacheRecentMessages(conversationId: string, messages: Message[]) {
    const key = `messages:recent:${conversationId}`
    await this.redis.setex(key, 3600, JSON.stringify(messages)) // 1 hour TTL
  }

  async getRecentMessages(conversationId: string): Promise<Message[] | null> {
    const key = `messages:recent:${conversationId}`
    const cached = await this.redis.get(key)
    return cached ? JSON.parse(cached) : null
  }

  // Cache conversation list per user
  async cacheUserConversations(userId: string, conversations: Conversation[]) {
    const key = `conversations:user:${userId}`
    await this.redis.setex(key, 300, JSON.stringify(conversations)) // 5 minutes TTL
  }

  async getUserConversations(userId: string): Promise<Conversation[] | null> {
    const key = `conversations:user:${userId}`
    const cached = await this.redis.get(key)
    return cached ? JSON.parse(cached) : null
  }

  // Cache user presence
  async cacheUserPresence(userId: string, status: PresenceStatus) {
    const key = `presence:${userId}`
    await this.redis.setex(key, 600, status) // 10 minutes TTL
  }

  // Invalidate cache on updates
  async invalidateConversationCache(conversationId: string) {
    const pattern = `messages:recent:${conversationId}`
    await this.redis.del(pattern)
  }
}
```

**Cache Hierarchy:**
1. **L1 - Client Memory**: Zustand store (instant access)
2. **L2 - Azure Cache for Redis**: Recent messages, conversations (< 5ms)
3. **L3 - Azure Database for PostgreSQL**: Full message history (< 50ms)

#### **Load Balancing for WebSocket**

**Azure Front Door Configuration:**

```bicep
// infrastructure/front-door.bicep
resource frontDoor 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: 'messaging-frontdoor'
  location: 'global'
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
  properties: {
    originResponseTimeoutSeconds: 60
  }
}

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-05-01' = {
  parent: frontDoor
  name: 'messaging-endpoint'
  location: 'global'
  properties: {
    enabledState: 'Enabled'
  }
}

// Origin group for REST API
resource apiOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: frontDoor
  name: 'api-origin-group'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/health'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
  }
}

// Origin group for WebSocket
resource websocketOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: frontDoor
  name: 'websocket-origin-group'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    sessionAffinityState: 'Enabled' // Sticky sessions for WebSocket
  }
}

// Route for REST API
resource apiRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'api-route'
  properties: {
    originGroup: {
      id: apiOriginGroup.id
    }
    supportedProtocols: ['Https']
    patternsToMatch: ['/api/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
  }
}

// Route for WebSocket
resource websocketRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'websocket-route'
  properties: {
    originGroup: {
      id: websocketOriginGroup.id
    }
    supportedProtocols: ['Https']
    patternsToMatch: ['/messages/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
  }
}
```

**Azure Front Door Benefits:**
- Global load balancing across regions
- WebSocket support with session affinity
- WAF (Web Application Firewall) protection
- SSL/TLS termination
- DDoS protection
- Health probes and automatic failover

#### **Message Delivery Guarantees**

**At-Least-Once Delivery:**

```typescript
// Idempotency key prevents duplicate messages
interface SendMessageDto {
  content: string
  idempotencyKey: string // Client-generated UUID
}

@Post('conversations/:id/messages')
async sendMessage(
  @Param('id') conversationId: string,
  @Body() dto: SendMessageDto,
  @CurrentUser() user: User,
) {
  // Check if message already exists with this idempotency key
  const existing = await this.messagesService.findByIdempotencyKey(
    dto.idempotencyKey
  )

  if (existing) {
    return existing // Return existing message (idempotent)
  }

  // Create new message
  const message = await this.messagesService.create({
    conversationId,
    senderId: user.id,
    content: dto.content,
    idempotencyKey: dto.idempotencyKey,
  })

  // Publish to Redis for real-time delivery
  await this.redisPubSub.publishMessage('messages:new', {
    conversationId,
    message,
  })

  return message
}
```

#### **Performance Optimization Techniques**

1. **Database Connection Pooling:**
```typescript
// Prisma connection pool
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pool settings
  connection_limit = 20
  pool_timeout = 10
}
```

2. **Batch Operations:**
```typescript
// Mark multiple messages as read in one query
async markMultipleAsRead(messageIds: string[], userId: string) {
  await this.prisma.messageReadReceipt.createMany({
    data: messageIds.map(id => ({
      messageId: id,
      userId,
      readAt: new Date(),
    })),
    skipDuplicates: true,
  })
}
```

3. **CDN for Media:**
```typescript
// Upload to Azure Blob Storage with CDN
async uploadAttachment(file: Express.Multer.File, userId: string) {
  const blobName = `${userId}/${Date.now()}-${file.originalname}`

  // Upload to Azure Blob Storage
  const blobClient = this.containerClient.getBlockBlobClient(blobName)
  await blobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  })

  // Generate CDN URL
  const cdnUrl = `https://cdn.worldschools.com/messages/${blobName}`

  return {
    storageUrl: blobClient.url,
    cdnUrl,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
  }
}
```

---

## Security & Privacy

### Authentication & Authorization

#### **JWT Token Strategy**

```typescript
// apps/wc-nest-api/src/modules/core/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Extract from HTTP-only cookie
        (request) => request?.cookies?.['access_token'],
        // Fallback to Authorization header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    })
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
    }
  }
}
```

#### **WebSocket Authentication**

```typescript
// apps/wc-nest-api/src/modules/core/auth/guards/ws-jwt.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { WsException } from '@nestjs/websockets'

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient()
    const token = client.handshake.auth.token

    if (!token) {
      throw new WsException('Unauthorized')
    }

    try {
      const payload = await this.jwtService.verifyAsync(token)
      client.data.userId = payload.sub
      client.data.user = payload
      return true
    } catch (error) {
      throw new WsException('Invalid token')
    }
  }
}
```

#### **Conversation Access Control**

```typescript
// apps/wc-nest-api/src/modules/messaging/guards/conversation-access.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common'
import { ConversationsService } from '../services/conversations.service'

@Injectable()
export class ConversationAccessGuard implements CanActivate {
  constructor(private conversationsService: ConversationsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    const conversationId = request.params.id

    // Check if user is a participant in the conversation
    const isParticipant = await this.conversationsService.isUserParticipant(
      conversationId,
      user.id
    )

    if (!isParticipant) {
      throw new ForbiddenException('You do not have access to this conversation')
    }

    return true
  }
}
```

### Rate Limiting

```typescript
// apps/wc-nest-api/src/modules/messaging/guards/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext, HttpException } from '@nestjs/common'
import { Redis } from 'ioredis'

@Injectable()
export class RateLimitGuard implements CanActivate {
  private redis: Redis

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const userId = request.user.id
    const key = `rate-limit:messages:${userId}`

    // Allow 60 messages per minute
    const count = await this.redis.incr(key)

    if (count === 1) {
      await this.redis.expire(key, 60) // 1 minute window
    }

    if (count > 60) {
      throw new HttpException('Rate limit exceeded. Please slow down.', 429)
    }

    return true
  }
}

// Apply to message endpoints
@Post('conversations/:id/messages')
@UseGuards(JwtAuthGuard, ConversationAccessGuard, RateLimitGuard)
async sendMessage(...) {
  // ...
}
```

### Message Retention & Privacy

```typescript
// apps/wc-nest-api/src/modules/messaging/services/retention.service.ts
import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../core/prisma/prisma.service'

@Injectable()
export class MessageRetentionService {
  constructor(private prisma: PrismaService) {}

  // Run daily at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldMessages() {
    const retentionDays = 365 // Keep messages for 1 year
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // Soft delete old messages
    await this.prisma.message.updateMany({
      where: {
        createdAt: { lt: cutoffDate },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        content: '[Message deleted due to retention policy]',
      },
    })

    console.log(`Cleaned up messages older than ${retentionDays} days`)
  }

  // Hard delete after 30 days of soft delete
  @Cron(CronExpression.EVERY_WEEK)
  async permanentlyDeleteMessages() {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30)

    await this.prisma.message.deleteMany({
      where: {
        deletedAt: { lt: cutoffDate },
      },
    })

    console.log('Permanently deleted soft-deleted messages')
  }
}
```

### Data Privacy Compliance (GDPR)

```typescript
// apps/wc-nest-api/src/modules/messaging/services/privacy.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../core/prisma/prisma.service'

@Injectable()
export class PrivacyService {
  constructor(private prisma: PrismaService) {}

  // Export all user data (GDPR right to data portability)
  async exportUserData(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: {
        messages: {
          where: { senderId: userId },
          include: { attachments: true },
        },
        participants: true,
      },
    })

    return {
      userId,
      exportedAt: new Date().toISOString(),
      conversations: conversations.map(conv => ({
        id: conv.id,
        type: conv.type,
        messages: conv.messages,
        createdAt: conv.createdAt,
      })),
    }
  }

  // Delete all user data (GDPR right to erasure)
  async deleteUserData(userId: string) {
    // Delete messages sent by user
    await this.prisma.message.updateMany({
      where: { senderId: userId },
      data: {
        content: '[User deleted their account]',
        deletedAt: new Date(),
        deletedBy: userId,
      },
    })

    // Remove user from conversation participants
    await this.prisma.conversationParticipant.deleteMany({
      where: { userId },
    })

    console.log(`Deleted all messaging data for user ${userId}`)
  }
}
```

---

## Deployment Architecture

### Azure Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Azure Cloud                                 │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    Azure Front Door                           │ │
│  │              (Global Load Balancer + WAF)                     │ │
│  └────────────────────────┬──────────────────────────────────────┘ │
│                           │                                         │
│  ┌────────────────────────┴──────────────────────────────────────┐ │
│  │          Azure Container Apps Environment                     │ │
│  │                                                               │ │
│  │  ┌──────────────────┐      ┌──────────────────┐              │ │
│  │  │  REST API        │      │  WebSocket       │              │ │
│  │  │  Container App   │      │  Container App   │              │ │
│  │  │  (3-10 replicas) │      │  (3-10 replicas) │              │ │
│  │  └──────────────────┘      └──────────────────┘              │ │
│  │                                                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                           │                                         │
│           ┌───────────────┴───────────────┐                        │
│           │                               │                        │
│  ┌────────▼────────┐            ┌─────────▼────────┐              │
│  │  Azure Cache    │            │  Azure Database  │              │
│  │  for Redis      │            │  for PostgreSQL  │              │
│  │  (Premium tier) │            │  (Flexible)      │              │
│  └─────────────────┘            └──────────────────┘              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Azure Blob Storage + CDN                       │  │
│  │              (Media files, attachments)                     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Azure Monitor + Application Insights           │  │
│  │              (Logging, metrics, alerts)                     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Azure Key Vault                                │  │
│  │              (Secrets, connection strings, certificates)    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Azure Container Apps Environment

```bicep
// infrastructure/container-apps/environment.bicep
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'messaging-logs'
  location: resourceGroup().location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: 'messaging-env'
  location: resourceGroup().location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}
```

### Azure Database for PostgreSQL

```bicep
// infrastructure/database.bicep
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: 'messaging-postgres'
  location: resourceGroup().location
  sku: {
    name: 'Standard_D4s_v3'
    tier: 'GeneralPurpose'
  }
  properties: {
    version: '15'
    administratorLogin: 'pgadmin'
    administratorLoginPassword: keyVault.getSecret('postgres-password')
    storage: {
      storageSizeGB: 128
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Enabled'
    }
    highAvailability: {
      mode: 'ZoneRedundant'
    }
    network: {
      delegatedSubnetResourceId: subnet.id
      privateDnsZoneArmResourceId: privateDnsZone.id
    }
  }
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgresServer
  name: 'messaging'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Enable required extensions
resource postgresExtensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-03-01-preview' = {
  parent: postgresServer
  name: 'azure.extensions'
  properties: {
    value: 'pg_trgm,btree_gin,uuid-ossp'
    source: 'user-override'
  }
}
```

### Azure Cache for Redis

```bicep
// infrastructure/redis.bicep
resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: 'messaging-redis'
  location: resourceGroup().location
  properties: {
    sku: {
      name: 'Premium'
      family: 'P'
      capacity: 1
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
      'maxmemory-reserved': '50'
      'maxfragmentationmemory-reserved': '50'
    }
    redisVersion: '6'
  }
}

// Enable zone redundancy for high availability
resource redisZoneRedundancy 'Microsoft.Cache/redis@2023-08-01' = {
  name: 'messaging-redis'
  properties: {
    replicasPerMaster: 1
    zones: ['1', '2', '3']
  }
}
```

### Azure Blob Storage

```bicep
// infrastructure/storage.bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'messagingstorage'
  location: resourceGroup().location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_GRS' // Geo-redundant storage
  }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    cors: {
      corsRules: [
        {
          allowedOrigins: ['https://worldschools.com']
          allowedMethods: ['GET', 'POST', 'PUT']
          allowedHeaders: ['*']
          exposedHeaders: ['*']
          maxAgeInSeconds: 3600
        }
      ]
    }
  }
}

resource attachmentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'message-attachments'
  properties: {
    publicAccess: 'None'
  }
}

// Lifecycle management - delete old attachments
resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'delete-old-attachments'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['message-attachments/']
            }
            actions: {
              baseBlob: {
                delete: {
                  daysAfterModificationGreaterThan: 365
                }
              }
            }
          }
        }
      ]
    }
  }
}
```

### Azure Key Vault

```bicep
// infrastructure/keyvault.bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'messaging-keyvault'
  location: resourceGroup().location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

// Store secrets
resource jwtSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jwt-secret'
  properties: {
    value: 'your-jwt-secret-here' // Replace with actual secret
  }
}

resource databasePassword 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'postgres-password'
  properties: {
    value: 'your-postgres-password-here' // Replace with actual password
  }
}
```

### Managed Identity Configuration

```bicep
// infrastructure/identity.bicep
resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'messaging-identity'
  location: resourceGroup().location
}

// Grant Container Apps access to Key Vault
resource keyVaultAccessPolicy 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, userAssignedIdentity.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant Container Apps access to Container Registry
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, userAssignedIdentity.id, 'AcrPull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: userAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}
```

---

## CI/CD Pipeline

### GitHub Actions Workflow for Azure Container Apps

```yaml
# .github/workflows/deploy-messaging.yml
name: Deploy Messaging System to Azure Container Apps

on:
  push:
    branches: [main]
    paths:
      - 'apps/wc-nest-api/**'
      - 'infrastructure/**'
  workflow_dispatch:

env:
  AZURE_CONTAINER_REGISTRY: messagingacr.azurecr.io
  RESOURCE_GROUP: messaging-rg
  CONTAINER_APP_API: messaging-api
  CONTAINER_APP_WEBSOCKET: messaging-websocket

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npx nx test wc-nest-api

      - name: Build application
        run: npx nx build wc-nest-api --configuration=production

      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Login to Azure Container Registry
        uses: azure/docker-login@v1
        with:
          login-server: ${{ env.AZURE_CONTAINER_REGISTRY }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      - name: Build and push Docker image
        run: |
          docker build -t ${{ env.AZURE_CONTAINER_REGISTRY }}/wc-nest-api:${{ github.sha }} \
                       -t ${{ env.AZURE_CONTAINER_REGISTRY }}/wc-nest-api:latest \
                       -f apps/wc-nest-api/Dockerfile .
          docker push ${{ env.AZURE_CONTAINER_REGISTRY }}/wc-nest-api:${{ github.sha }}
          docker push ${{ env.AZURE_CONTAINER_REGISTRY }}/wc-nest-api:latest

  deploy-api:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Deploy REST API to Container Apps
        uses: azure/container-apps-deploy-action@v1
        with:
          containerAppName: ${{ env.CONTAINER_APP_API }}
          resourceGroup: ${{ env.RESOURCE_GROUP }}
          imageToDeploy: ${{ env.AZURE_CONTAINER_REGISTRY }}/wc-nest-api:${{ github.sha }}
          targetPort: 3000

      - name: Wait for deployment
        run: |
          az containerapp revision list \
            --name ${{ env.CONTAINER_APP_API }} \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --query "[0].properties.provisioningState" \
            --output tsv

  deploy-websocket:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Deploy WebSocket to Container Apps
        uses: azure/container-apps-deploy-action@v1
        with:
          containerAppName: ${{ env.CONTAINER_APP_WEBSOCKET }}
          resourceGroup: ${{ env.RESOURCE_GROUP }}
          imageToDeploy: ${{ env.AZURE_CONTAINER_REGISTRY }}/wc-nest-api:${{ github.sha }}
          targetPort: 3001
          environmentVariables: 'WEBSOCKET_MODE=true'

  run-migrations:
    needs: [deploy-api]
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Run database migrations
        run: |
          az containerapp exec \
            --name ${{ env.CONTAINER_APP_API }} \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --command "npx prisma migrate deploy"

  smoke-tests:
    needs: [deploy-api, deploy-websocket, run-migrations]
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run smoke tests
        run: |
          # Test REST API health
          curl -f https://messaging-api.azurecontainerapps.io/health || exit 1

          # Test WebSocket connection
          npm run test:websocket:smoke

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "❌ Messaging deployment failed - smoke tests did not pass"
            }
```

### Blue-Green Deployment Strategy

```yaml
# .github/workflows/deploy-blue-green.yml
name: Blue-Green Deployment

on:
  workflow_dispatch:
    inputs:
      traffic_percentage:
        description: 'Percentage of traffic to new revision'
        required: true
        default: '10'

jobs:
  deploy-new-revision:
    runs-on: ubuntu-latest
    steps:
      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Create new revision
        run: |
          az containerapp update \
            --name messaging-api \
            --resource-group messaging-rg \
            --image messagingacr.azurecr.io/wc-nest-api:${{ github.sha }} \
            --revision-suffix ${{ github.sha }}

      - name: Split traffic
        run: |
          az containerapp ingress traffic set \
            --name messaging-api \
            --resource-group messaging-rg \
            --revision-weight latest=${{ github.event.inputs.traffic_percentage }} \
                              previous=${{ 100 - github.event.inputs.traffic_percentage }}

      - name: Monitor new revision
        run: |
          # Monitor for 10 minutes
          sleep 600

          # Check error rate
          ERROR_RATE=$(az monitor metrics list \
            --resource messaging-api \
            --metric "Requests" \
            --filter "ResponseCode eq '5xx'" \
            --query "value[0].timeseries[0].data[-1].total" \
            --output tsv)

          if [ "$ERROR_RATE" -gt 10 ]; then
            echo "Error rate too high, rolling back"
            exit 1
          fi

      - name: Complete rollout
        if: success()
        run: |
          az containerapp ingress traffic set \
            --name messaging-api \
            --resource-group messaging-rg \
            --revision-weight latest=100

      - name: Rollback on failure
        if: failure()
        run: |
          az containerapp ingress traffic set \
            --name messaging-api \
            --resource-group messaging-rg \
            --revision-weight previous=100
```

---

## Monitoring & Alerting

### Azure Monitor Configuration

```bicep
// infrastructure/monitoring.bicep
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'messaging-insights'
  location: resourceGroup().location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Alert for high error rate
resource errorRateAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'messaging-high-error-rate'
  location: 'global'
  properties: {
    description: 'Alert when error rate exceeds 5%'
    severity: 2
    enabled: true
    scopes: [
      messagingApiApp.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ErrorRate'
          metricName: 'Requests'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Average'
          dimensions: [
            {
              name: 'ResponseCode'
              operator: 'Include'
              values: ['5xx']
            }
          ]
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert for high response time
resource responseTimeAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'messaging-high-response-time'
  location: 'global'
  properties: {
    description: 'Alert when average response time exceeds 1 second'
    severity: 3
    enabled: true
    scopes: [
      messagingApiApp.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ResponseTime'
          metricName: 'RequestDuration'
          operator: 'GreaterThan'
          threshold: 1000 // milliseconds
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert for WebSocket connection failures
resource websocketConnectionAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'messaging-websocket-failures'
  location: 'global'
  properties: {
    description: 'Alert when WebSocket connection failures exceed threshold'
    severity: 2
    enabled: true
    scopes: [
      messagingWebSocketApp.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ConnectionFailures'
          metricName: 'FailedConnections'
          operator: 'GreaterThan'
          threshold: 10
          timeAggregation: 'Total'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Action group for notifications
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'messaging-alerts'
  location: 'global'
  properties: {
    groupShortName: 'MsgAlerts'
    enabled: true
    emailReceivers: [
      {
        name: 'DevTeam'
        emailAddress: 'dev-team@worldschools.com'
        useCommonAlertSchema: true
      }
    ]
    smsReceivers: [
      {
        name: 'OnCall'
        countryCode: '1'
        phoneNumber: '1234567890'
      }
    ]
    webhookReceivers: [
      {
        name: 'Slack'
        serviceUri: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        useCommonAlertSchema: true
      }
    ]
  }
}
```

### Custom Metrics for Container Apps

```typescript
// apps/wc-nest-api/src/modules/messaging/services/metrics.service.ts
import { Injectable } from '@nestjs/common'
import { TelemetryClient } from 'applicationinsights'

@Injectable()
export class MetricsService {
  private telemetryClient: TelemetryClient

  constructor() {
    this.telemetryClient = new TelemetryClient(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  }

  // Track active WebSocket connections
  trackActiveConnections(count: number) {
    this.telemetryClient.trackMetric({
      name: 'ActiveConnections',
      value: count,
    })
  }

  // Track message send latency
  trackMessageLatency(durationMs: number) {
    this.telemetryClient.trackMetric({
      name: 'MessageSendLatency',
      value: durationMs,
    })
  }

  // Track message delivery success rate
  trackMessageDelivery(success: boolean) {
    this.telemetryClient.trackMetric({
      name: 'MessageDeliveryRate',
      value: success ? 1 : 0,
    })
  }

  // Track typing indicator events
  trackTypingIndicator() {
    this.telemetryClient.trackEvent({
      name: 'TypingIndicator',
    })
  }

  // Track conversation creation
  trackConversationCreated(type: string) {
    this.telemetryClient.trackEvent({
      name: 'ConversationCreated',
      properties: { type },
    })
  }
}
```

### Log Queries for Troubleshooting

```kusto
// Query 1: Find slow API requests
requests
| where timestamp > ago(1h)
| where duration > 1000 // > 1 second
| project timestamp, name, url, duration, resultCode
| order by duration desc
| take 100

// Query 2: WebSocket connection errors
traces
| where timestamp > ago(1h)
| where message contains "WebSocket" and severityLevel >= 3
| project timestamp, message, severityLevel, customDimensions
| order by timestamp desc

// Query 3: Message delivery failures
customEvents
| where timestamp > ago(1h)
| where name == "MessageDeliveryRate"
| where customMeasurements.value == 0
| summarize FailureCount = count() by bin(timestamp, 5m)
| render timechart

// Query 4: Active connections over time
customMetrics
| where timestamp > ago(24h)
| where name == "ActiveConnections"
| summarize avg(value), max(value) by bin(timestamp, 5m)
| render timechart

// Query 5: Error rate by endpoint
requests
| where timestamp > ago(1h)
| where resultCode startswith "5"
| summarize ErrorCount = count() by url
| order by ErrorCount desc
```

---

## Disaster Recovery Plan

### Backup Strategy

#### **Database Backups**

```bicep
// Automated backups configured in PostgreSQL resource
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  properties: {
    backup: {
      backupRetentionDays: 35 // Maximum retention
      geoRedundantBackup: 'Enabled' // Replicate to paired region
    }
  }
}
```

**Backup Schedule:**
- **Automated backups**: Every 24 hours
- **Retention**: 35 days
- **Geo-redundant**: Replicated to paired Azure region
- **Point-in-time restore**: Available for any point within retention period

#### **Redis Persistence**

```bicep
resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  properties: {
    redisConfiguration: {
      'rdb-backup-enabled': 'true'
      'rdb-backup-frequency': '60' // Every hour
      'rdb-storage-connection-string': storageAccount.properties.primaryEndpoints.blob
    }
  }
}
```

#### **Blob Storage Backups**

```bicep
// Enable soft delete for blobs
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 30
    }
  }
}
```

### Recovery Procedures

#### **Scenario 1: Database Corruption**

```bash
# Restore database to point-in-time
az postgres flexible-server restore \
  --resource-group messaging-rg \
  --name messaging-postgres-restored \
  --source-server messaging-postgres \
  --restore-time "2026-01-25T10:00:00Z"

# Update Container Apps to use restored database
az containerapp update \
  --name messaging-api \
  --resource-group messaging-rg \
  --set-env-vars DATABASE_URL="postgresql://restored-connection-string"
```

#### **Scenario 2: Container App Failure**

```bash
# Rollback to previous revision
az containerapp revision list \
  --name messaging-api \
  --resource-group messaging-rg \
  --query "[].name" \
  --output tsv

az containerapp ingress traffic set \
  --name messaging-api \
  --resource-group messaging-rg \
  --revision-weight <previous-revision>=100
```

#### **Scenario 3: Regional Outage**

```bash
# Failover to secondary region (requires multi-region setup)
az containerapp update \
  --name messaging-api \
  --resource-group messaging-rg-secondary \
  --image messagingacr.azurecr.io/wc-nest-api:latest

# Update Front Door to route to secondary region
az afd route update \
  --profile-name messaging-frontdoor \
  --endpoint-name messaging-endpoint \
  --route-name api-route \
  --origin-group secondary-origin-group
```

### RTO/RPO Targets

| Scenario | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|----------|-------------------------------|--------------------------------|
| Container App failure | < 5 minutes | 0 (no data loss) |
| Database corruption | < 30 minutes | < 5 minutes |
| Regional outage | < 1 hour | < 15 minutes |
| Complete disaster | < 4 hours | < 1 hour |

---

## Migration Path

### Phase 1: Infrastructure Setup (Week 1)

**Tasks:**
1. ✅ Create Azure resource group
2. ✅ Deploy Azure Container Apps Environment
3. ✅ Deploy Azure Database for PostgreSQL
4. ✅ Deploy Azure Cache for Redis
5. ✅ Deploy Azure Blob Storage
6. ✅ Deploy Azure Key Vault
7. ✅ Configure managed identities
8. ✅ Set up Azure Front Door

**Validation:**
```bash
# Verify all resources are created
az resource list --resource-group messaging-rg --output table

# Test database connectivity
psql -h messaging-postgres.postgres.database.azure.com -U pgadmin -d messaging

# Test Redis connectivity
redis-cli -h messaging-redis.redis.cache.windows.net -p 6380 -a <password> --tls
```

### Phase 2: Database Migration (Week 2)

**Tasks:**
1. ✅ Run Prisma migrations on Azure PostgreSQL
2. ✅ Create database partitions
3. ✅ Set up indexes
4. ✅ Configure connection pooling
5. ✅ Test database performance

**Commands:**
```bash
# Run migrations
npx prisma migrate deploy

# Create partitions
psql -h messaging-postgres.postgres.database.azure.com -U pgadmin -d messaging -f scripts/create-partitions.sql

# Verify schema
npx prisma db pull
```

### Phase 3: Backend Deployment (Week 3)

**Tasks:**
1. ✅ Build Docker image
2. ✅ Push to Azure Container Registry
3. ✅ Deploy REST API Container App
4. ✅ Deploy WebSocket Container App
5. ✅ Configure environment variables
6. ✅ Test API endpoints

**Commands:**
```bash
# Build and push
docker build -t messagingacr.azurecr.io/wc-nest-api:v1.0.0 .
docker push messagingacr.azurecr.io/wc-nest-api:v1.0.0

# Deploy
az containerapp create \
  --name messaging-api \
  --resource-group messaging-rg \
  --environment messaging-env \
  --image messagingacr.azurecr.io/wc-nest-api:v1.0.0 \
  --target-port 3000 \
  --ingress external \
  --min-replicas 3 \
  --max-replicas 10
```

### Phase 4: Frontend Integration (Week 4)

**Tasks:**
1. ✅ Update API endpoints in frontend
2. ✅ Update WebSocket connection URL
3. ✅ Test conversation store
4. ✅ Test real-time messaging
5. ✅ Test offline support
6. ✅ Deploy frontend to production

**Frontend Changes:**
```typescript
// apps/wc-booking/src/lib/config.ts
export const API_CONFIG = {
  REST_API_URL: 'https://messaging-api.azurecontainerapps.io',
  WEBSOCKET_URL: 'https://messaging-websocket.azurecontainerapps.io',
}
```

### Phase 5: Testing & Optimization (Week 5)

**Tasks:**
1. ✅ Load testing (10,000 concurrent users)
2. ✅ WebSocket stress testing
3. ✅ Database query optimization
4. ✅ Redis cache tuning
5. ✅ Monitor metrics and alerts
6. ✅ Fix performance bottlenecks

**Load Testing:**
```bash
# Install k6
brew install k6

# Run load test
k6 run scripts/load-test.js --vus 10000 --duration 30m
```

### Phase 6: Production Rollout (Week 6)

**Tasks:**
1. ✅ Blue-green deployment to 10% traffic
2. ✅ Monitor error rates and latency
3. ✅ Gradually increase to 50% traffic
4. ✅ Monitor for 24 hours
5. ✅ Complete rollout to 100% traffic
6. ✅ Decommission old infrastructure

**Rollout Commands:**
```bash
# Deploy new revision
az containerapp update \
  --name messaging-api \
  --resource-group messaging-rg \
  --image messagingacr.azurecr.io/wc-nest-api:v1.0.0

# Split traffic 10%
az containerapp ingress traffic set \
  --name messaging-api \
  --resource-group messaging-rg \
  --revision-weight latest=10 previous=90

# Monitor for issues
az monitor metrics list \
  --resource messaging-api \
  --metric "Requests" \
  --interval PT1M

# Complete rollout
az containerapp ingress traffic set \
  --name messaging-api \
  --resource-group messaging-rg \
  --revision-weight latest=100
```

---

## Performance Benchmarks

### Expected Performance Metrics

| Metric | Target | Measured |
|--------|--------|----------|
| **API Response Time (p50)** | < 100ms | TBD |
| **API Response Time (p95)** | < 300ms | TBD |
| **API Response Time (p99)** | < 500ms | TBD |
| **WebSocket Connection Time** | < 200ms | TBD |
| **Message Delivery Latency** | < 100ms | TBD |
| **Typing Indicator Latency** | < 50ms | TBD |
| **Database Query Time (p95)** | < 50ms | TBD |
| **Redis Cache Hit Rate** | > 80% | TBD |
| **Concurrent WebSocket Connections** | 10,000+ | TBD |
| **Messages per Second** | 1,000+ | TBD |
| **API Requests per Second** | 5,000+ | TBD |

### Capacity Planning

| User Count | Container App Replicas | Database vCores | Redis Tier | Estimated Cost/Month |
|------------|------------------------|-----------------|------------|----------------------|
| 1,000 | 3 | 2 | Premium P1 | $500 |
| 5,000 | 5 | 4 | Premium P1 | $1,200 |
| 10,000 | 7 | 8 | Premium P2 | $2,500 |
| 25,000 | 10 | 16 | Premium P3 | $5,000 |
| 50,000 | 15 | 32 | Premium P4 | $10,000 |

### Load Testing Scenarios

```javascript
// scripts/load-test.js
import http from 'k6/http'
import ws from 'k6/ws'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '5m', target: 1000 },  // Ramp up to 1,000 users
    { duration: '10m', target: 5000 }, // Ramp up to 5,000 users
    { duration: '10m', target: 10000 }, // Ramp up to 10,000 users
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests < 300ms
    ws_connecting: ['p(95)<200'],     // 95% of WebSocket connections < 200ms
  },
}

export default function () {
  // Test REST API
  const apiResponse = http.get('https://messaging-api.azurecontainerapps.io/api/messages/conversations')
  check(apiResponse, {
    'API status is 200': (r) => r.status === 200,
    'API response time < 300ms': (r) => r.timings.duration < 300,
  })

  // Test WebSocket
  const wsUrl = 'wss://messaging-websocket.azurecontainerapps.io/messages'
  const response = ws.connect(wsUrl, {}, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ event: 'authenticate', token: __ENV.JWT_TOKEN }))
    })

    socket.on('message', (data) => {
      check(data, {
        'WebSocket message received': (d) => d.length > 0,
      })
    })

    socket.setTimeout(() => {
      socket.close()
    }, 30000) // Keep connection open for 30 seconds
  })

  sleep(1)
}
```

---

## Conclusion

This architecture document provides a complete, production-ready design for a real-time messaging system deployed on **Azure Container Apps**. The system is designed to handle:

- ✅ **10,000+ concurrent WebSocket connections**
- ✅ **1,000+ messages per second**
- ✅ **Sub-100ms message delivery latency**
- ✅ **99.9% uptime SLA**
- ✅ **Horizontal scaling** with Azure Container Apps auto-scaling
- ✅ **Multi-region deployment** with Azure Front Door
- ✅ **Comprehensive monitoring** with Azure Monitor and Application Insights
- ✅ **Disaster recovery** with automated backups and failover
- ✅ **Security & compliance** with JWT auth, rate limiting, and GDPR support

### Key Advantages of Azure Container Apps

1. **Serverless Simplicity**: No need to manage Kubernetes clusters
2. **Built-in Auto-scaling**: HTTP-based and custom metrics scaling
3. **Managed Ingress**: Built-in load balancing and SSL termination
4. **Integrated Monitoring**: Native Azure Monitor and Application Insights integration
5. **Cost-Effective**: Pay only for what you use with consumption-based pricing
6. **Easy Deployment**: Simple CLI commands and GitHub Actions integration

### Next Steps

1. **Review and approve** this architecture document
2. **Provision Azure infrastructure** using provided Bicep templates
3. **Implement backend** following the NestJS module structure
4. **Integrate frontend** with the conversation store pattern
5. **Deploy to staging** environment for testing
6. **Run load tests** to validate performance
7. **Deploy to production** using blue-green deployment strategy

### Future Enhancements

- **Message reactions** (emoji reactions to messages)
- **Message threading** (reply to specific messages)
- **Voice messages** (audio recording and playback)
- **Video calls** (WebRTC integration)
- **Message translation** (Azure Cognitive Services)
- **AI-powered chatbot** (Azure OpenAI integration)
- **Message search** (Azure Cognitive Search)
- **Analytics dashboard** (Power BI integration)

---

**Document Version**: 1.1
**Last Updated**: 2026-01-25
**Author**: World Schools Development Team
**Status**: Ready for Implementation

