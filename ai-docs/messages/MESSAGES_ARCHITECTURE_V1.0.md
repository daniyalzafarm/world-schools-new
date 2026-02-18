# Real-Time Messaging System Architecture

**Version:** 1.0  
**Last Updated:** 2026-01-24  
**Status:** Design Document

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

1. **Horizontal Scalability**: Stateless WebSocket servers with Redis pub/sub
2. **Data Consistency**: PostgreSQL with optimistic locking and event sourcing
3. **Performance**: Multi-layer caching (Redis, CDN) and database indexing
4. **Reliability**: At-least-once delivery with idempotency keys
5. **Security**: End-to-end encryption ready, RBAC integration, rate limiting

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
│                   Azure Load Balancer                                 │
│                   (Application Gateway)                               │
└────────────────────────────┬──────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────▼────────┐          ┌────────▼────────┐
     │  REST API       │          │  WebSocket      │
     │  (NestJS)       │          │  Gateway        │
     │  Stateless      │          │  (Socket.io)    │
     └────────┬────────┘          └────────┬────────┘
              │                             │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────▼────────┐          ┌────────▼────────┐
     │  Redis Cluster  │          │  PostgreSQL     │
     │  (Pub/Sub +     │          │  (Primary DB)   │
     │   Cache)        │          │                 │
     └─────────────────┘          └─────────────────┘
```

### Component Responsibilities

#### **Client Applications (Next.js)**
- **UI Rendering**: Message bubbles, conversation lists, typing indicators
- **State Management**: Zustand stores for conversations and messages
- **WebSocket Client**: Socket.io client for real-time communication
- **Optimistic Updates**: Immediate UI feedback before server confirmation
- **Offline Queue**: Store unsent messages in IndexedDB

#### **REST API (NestJS)**
- **Message CRUD**: Create, read, update, delete messages
- **Conversation Management**: List, archive, pin, mute conversations
- **File Uploads**: Handle media attachments (images, documents)
- **Authentication**: JWT validation and user context
- **Authorization**: RBAC checks for message access

#### **WebSocket Gateway (Socket.io + NestJS)**
- **Connection Management**: Handle client connections/disconnections
- **Real-time Events**: Broadcast messages, typing indicators, read receipts
- **Presence Tracking**: Online/offline status, last seen timestamps
- **Room Management**: User-specific and conversation-specific rooms
- **Authentication**: Validate JWT tokens on connection

#### **Redis Cluster**
- **Pub/Sub**: Distribute messages across WebSocket server instances
- **Session Store**: Track active WebSocket connections
- **Presence Cache**: Store online users and last seen data
- **Message Cache**: Cache recent messages for fast retrieval
- **Rate Limiting**: Track API request counts per user

#### **PostgreSQL Database**
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
| **Database** | PostgreSQL | 15.x | ACID compliance, JSON support, full-text search |
| **ORM** | Prisma | 5.x | Type-safe queries, migrations, existing integration |
| **Cache/Pub-Sub** | Redis | 7.x | In-memory speed, pub/sub, clustering support |
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
| **Container Orchestration** | Azure Kubernetes Service (AKS) | Auto-scaling, health checks |
| **Load Balancer** | Azure Application Gateway | WebSocket support, SSL termination |
| **Monitoring** | Azure Monitor + Application Insights | Integrated logging, metrics |
| **Secrets Management** | Azure Key Vault | Secure credential storage |

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

```typescript
// apps/wc-nest-api/src/modules/messaging/services/redis-pub-sub.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common'
import { Redis } from 'ioredis'
import { Server } from 'socket.io'

@Injectable()
export class RedisPubSubService implements OnModuleInit {
  private publisher: Redis
  private subscriber: Redis

  constructor() {
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
    // Broadcast to Socket.io clients connected to this server instance
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

---

## Frontend State Management

### Enhanced Zustand Store

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

        // Conversations
        setConversations: (conversations) => {
          set((state) => {
            state.conversations = conversations
          })
        },

        updateConversation: (conversationId, updates) => {
          set((state) => {
            const index = state.conversations.findIndex((c) => c.id === conversationId)
            if (index !== -1) {
              state.conversations[index] = { ...state.conversations[index], ...updates }
            }
          })
        },

        // Messages
        setMessages: (conversationId, messages) => {
          set((state) => {
            state.messages[conversationId] = messages
          })
        },

        addMessage: (conversationId, message) => {
          set((state) => {
            if (!state.messages[conversationId]) {
              state.messages[conversationId] = []
            }
            state.messages[conversationId].push(message)

            // Update conversation's last message
            const convIndex = state.conversations.findIndex((c) => c.id === conversationId)
            if (convIndex !== -1) {
              state.conversations[convIndex].lastMessage = message.content
              state.conversations[convIndex].time = message.createdAt
            }
          })
        },

        updateMessage: (messageId, updates) => {
          set((state) => {
            Object.keys(state.messages).forEach((conversationId) => {
              const msgIndex = state.messages[conversationId].findIndex((m) => m.id === messageId)
              if (msgIndex !== -1) {
                state.messages[conversationId][msgIndex] = {
                  ...state.messages[conversationId][msgIndex],
                  ...updates,
                }
              }
            })
          })
        },

        deleteMessage: (messageId) => {
          set((state) => {
            Object.keys(state.messages).forEach((conversationId) => {
              state.messages[conversationId] = state.messages[conversationId].filter(
                (m) => m.id !== messageId
              )
            })
          })
        },

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

          socket.on('message:deleted', (data) => {
            get().deleteMessage(data.messageId)
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

          socket.on('typing:stop', (data) => {
            set((state) => {
              if (state.typingUsers[data.conversationId]) {
                state.typingUsers[data.conversationId] = state.typingUsers[
                  data.conversationId
                ].filter((id) => id !== data.userId)
              }
            })
          })

          set((state) => {
            state.socket = socket
          })
        },

        disconnectSocket: () => {
          const { socket } = get()
          if (socket) {
            socket.disconnect()
            set((state) => {
              state.socket = null
              state.isConnected = false
            })
          }
        },

        joinConversation: (conversationId) => {
          const { socket } = get()
          if (socket) {
            socket.emit('conversation:join', { conversationId })
            set((state) => {
              state.activeConversationId = conversationId
            })
          }
        },

        leaveConversation: (conversationId) => {
          const { socket } = get()
          if (socket) {
            socket.emit('conversation:leave', { conversationId })
          }
        },

        // Send message with optimistic update
        sendMessage: async (conversationId, content) => {
          const tempId = `temp-${Date.now()}`
          const optimisticMessage: Message = {
            id: tempId,
            conversationId,
            content,
            senderId: 'current-user', // Replace with actual user ID
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
            // Mark as failed
            get().updateMessage(tempId, { status: 'FAILED' })

            // Queue for retry
            get().queueMessage(optimisticMessage)
          }
        },

        startTyping: (conversationId) => {
          const { socket } = get()
          if (socket) {
            socket.emit('typing:start', { conversationId })
          }
        },

        stopTyping: (conversationId) => {
          const { socket } = get()
          if (socket) {
            socket.emit('typing:stop', { conversationId })
          }
        },

        markAsRead: (messageId, conversationId) => {
          const { socket } = get()
          if (socket) {
            socket.emit('message:read', { messageId, conversationId })
          }
        },

        queueMessage: (message) => {
          set((state) => {
            state.pendingMessages.push(message)
          })
        },

        syncPendingMessages: async () => {
          const { pendingMessages } = get()

          for (const message of pendingMessages) {
            try {
              await get().sendMessage(message.conversationId, message.content)

              // Remove from queue on success
              set((state) => {
                state.pendingMessages = state.pendingMessages.filter((m) => m.id !== message.id)
              })
            } catch (error) {
              console.error('Failed to sync message:', error)
            }
          }
        },
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

// Usage in store
export async function savePendingMessage(message: OfflineMessage) {
  await offlineDb.messages.add(message)
}

export async function getPendingMessages() {
  return await offlineDb.messages.where('status').equals('pending').toArray()
}

export async function deletePendingMessage(id: string) {
  await offlineDb.messages.delete(id)
}
```

---

## Scalability & Performance

### Horizontal Scaling Strategy

#### **WebSocket Server Scaling**

```yaml
# Kubernetes Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: messaging-gateway
spec:
  replicas: 3  # Start with 3, auto-scale to 10
  selector:
    matchLabels:
      app: messaging-gateway
  template:
    metadata:
      labels:
        app: messaging-gateway
    spec:
      containers:
      - name: messaging-gateway
        image: wc-nest-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: messaging-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: messaging-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

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

  async getUserPresence(userId: string): Promise<PresenceStatus | null> {
    const key = `presence:${userId}`
    return (await this.redis.get(key)) as PresenceStatus | null
  }

  // Invalidate cache on updates
  async invalidateConversationCache(conversationId: string) {
    const pattern = `messages:recent:${conversationId}`
    await this.redis.del(pattern)
  }

  async invalidateUserCache(userId: string) {
    const pattern = `conversations:user:${userId}`
    await this.redis.del(pattern)
  }
}
```

**Cache Hierarchy:**
1. **L1 - Client Memory**: Zustand store (instant access)
2. **L2 - Redis**: Recent messages, conversations (< 5ms)
3. **L3 - PostgreSQL**: Full message history (< 50ms)

#### **Load Balancing for WebSocket**

**Sticky Sessions with Redis Adapter:**

```typescript
// apps/wc-nest-api/src/modules/messaging/messaging.gateway.ts
import { createAdapter } from '@socket.io/redis-adapter'
import { Redis } from 'ioredis'

@WebSocketGateway({
  namespace: '/messages',
  cors: { origin: true, credentials: true },
})
export class MessagingGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server

  async afterInit(server: Server) {
    const pubClient = new Redis(process.env.REDIS_URL)
    const subClient = pubClient.duplicate()

    server.adapter(createAdapter(pubClient, subClient))

    console.log('WebSocket gateway initialized with Redis adapter')
  }
}
```

**Azure Application Gateway Configuration:**
- Enable WebSocket support
- Session affinity based on client IP (optional)
- Health checks on `/health` endpoint
- SSL termination at gateway level

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

3. **Lazy Loading Messages:**
```typescript
// Load messages in chunks (pagination)
async getMessages(conversationId: string, limit = 50, before?: string) {
  return this.prisma.message.findMany({
    where: {
      conversationId,
      ...(before && { createdAt: { lt: new Date(before) } }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } },
      attachments: true,
    },
  })
}
```

4. **CDN for Media:**
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

### End-to-End Encryption (Future Enhancement)

**Client-Side Encryption:**

```typescript
// apps/wc-booking/src/lib/encryption.ts
import { generateKeyPair, encrypt, decrypt } from 'crypto-browserify'

export class MessageEncryption {
  private publicKey: string
  private privateKey: string

  async initialize() {
    // Generate key pair for user
    const { publicKey, privateKey } = await generateKeyPair('rsa', {
      modulusLength: 2048,
    })

    this.publicKey = publicKey
    this.privateKey = privateKey

    // Store public key on server
    await this.uploadPublicKey(publicKey)
  }

  async encryptMessage(content: string, recipientPublicKey: string): Promise<string> {
    // Encrypt with recipient's public key
    const encrypted = await encrypt(recipientPublicKey, content)
    return encrypted.toString('base64')
  }

  async decryptMessage(encryptedContent: string): Promise<string> {
    // Decrypt with own private key
    const buffer = Buffer.from(encryptedContent, 'base64')
    const decrypted = await decrypt(this.privateKey, buffer)
    return decrypted.toString('utf8')
  }
}
```

**Note:** E2E encryption adds complexity and should be implemented in Phase 2 after core messaging is stable.

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

### User Blocking & Reporting

```typescript
// Database model
model BlockedUser {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  blockedId  String   @map("blocked_id")
  reason     String?
  createdAt  DateTime @default(now()) @map("created_at")

  user       User     @relation("BlockedBy", fields: [userId], references: [id])
  blocked    User     @relation("Blocked", fields: [blockedId], references: [id])

  @@unique([userId, blockedId])
  @@index([userId])
  @@map("blocked_users")
}

// Service method
async blockUser(userId: string, blockedId: string, reason?: string) {
  // Create block record
  await this.prisma.blockedUser.create({
    data: { userId, blockedId, reason },
  })

  // Archive all conversations with blocked user
  const conversations = await this.prisma.conversationParticipant.findMany({
    where: {
      userId,
      conversation: {
        participants: {
          some: { userId: blockedId },
        },
      },
    },
  })

  for (const conv of conversations) {
    await this.prisma.conversationParticipant.update({
      where: { id: conv.id },
      data: { archived: true, archivedAt: new Date() },
    })
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

    // Delete attachments
    await this.prisma.messageAttachment.deleteMany({
      where: { uploadedBy: userId },
    })

    console.log(`Deleted all messaging data for user ${userId}`)
  }
}
```

---

## Deployment Architecture

### Azure Infrastructure

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
│  │              Azure Application Gateway                        │ │
│  │         (Regional Load Balancer + SSL Termination)            │ │
│  └────────────────────────┬──────────────────────────────────────┘ │
│                           │                                         │
│  ┌────────────────────────┴──────────────────────────────────────┐ │
│  │          Azure Kubernetes Service (AKS)                       │ │
│  │                                                               │ │
│  │  ┌──────────────────┐      ┌──────────────────┐              │ │
│  │  │  REST API Pods   │      │  WebSocket Pods  │              │ │
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
└─────────────────────────────────────────────────────────────────────┘
```

### Kubernetes Configuration

```yaml
# apps/wc-nest-api/k8s/messaging-deployment.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: messaging
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: messaging-config
  namespace: messaging
data:
  NODE_ENV: "production"
  REDIS_HOST: "redis-cluster.messaging.svc.cluster.local"
  DATABASE_HOST: "postgres.messaging.svc.cluster.local"
---
apiVersion: v1
kind: Secret
metadata:
  name: messaging-secrets
  namespace: messaging
type: Opaque
data:
  JWT_SECRET: <base64-encoded-secret>
  DATABASE_URL: <base64-encoded-connection-string>
  REDIS_PASSWORD: <base64-encoded-password>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: messaging-api
  namespace: messaging
spec:
  replicas: 3
  selector:
    matchLabels:
      app: messaging-api
  template:
    metadata:
      labels:
        app: messaging-api
    spec:
      containers:
      - name: api
        image: worldschools.azurecr.io/wc-nest-api:latest
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 3001
          name: websocket
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: messaging-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: messaging-secrets
              key: DATABASE_URL
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: messaging-secrets
              key: REDIS_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: messaging-secrets
              key: JWT_SECRET
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: messaging-api-service
  namespace: messaging
spec:
  selector:
    app: messaging-api
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: websocket
    port: 3001
    targetPort: 3001
  type: LoadBalancer
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy-messaging.yml
name: Deploy Messaging Service

on:
  push:
    branches: [main]
    paths:
      - 'apps/wc-nest-api/src/modules/messaging/**'
      - 'apps/wc-nest-api/prisma/schema.prisma'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npx nx test wc-nest-api

      - name: Run E2E tests
        run: npx nx e2e wc-nest-api-e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to Azure Container Registry
        uses: azure/docker-login@v1
        with:
          login-server: worldschools.azurecr.io
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      - name: Build and push Docker image
        run: |
          docker build -t worldschools.azurecr.io/wc-nest-api:${{ github.sha }} \
                       -t worldschools.azurecr.io/wc-nest-api:latest \
                       -f apps/wc-nest-api/Dockerfile .
          docker push worldschools.azurecr.io/wc-nest-api:${{ github.sha }}
          docker push worldschools.azurecr.io/wc-nest-api:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Set AKS context
        uses: azure/aks-set-context@v3
        with:
          resource-group: world-schools-rg
          cluster-name: world-schools-aks

      - name: Deploy to AKS
        run: |
          kubectl set image deployment/messaging-api \
            api=worldschools.azurecr.io/wc-nest-api:${{ github.sha }} \
            -n messaging
          kubectl rollout status deployment/messaging-api -n messaging

      - name: Run database migrations
        run: |
          kubectl exec -n messaging deployment/messaging-api -- \
            npx prisma migrate deploy
```

### Monitoring & Alerting

```typescript
// apps/wc-nest-api/src/modules/messaging/messaging.module.ts
import { Module } from '@nestjs/common'
import { PrometheusModule } from '@willsoto/nestjs-prometheus'

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
})
export class MessagingModule {}

// Custom metrics
import { Injectable } from '@nestjs/common'
import { Counter, Histogram } from 'prom-client'
import { InjectMetric } from '@willsoto/nestjs-prometheus'

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('messages_sent_total')
    public messagesSentCounter: Counter<string>,

    @InjectMetric('message_delivery_duration_seconds')
    public messageDeliveryHistogram: Histogram<string>,

    @InjectMetric('active_websocket_connections')
    public activeConnectionsGauge: Gauge<string>,
  ) {}

  recordMessageSent(conversationType: string) {
    this.messagesSentCounter.inc({ type: conversationType })
  }

  recordMessageDelivery(durationMs: number) {
    this.messageDeliveryHistogram.observe(durationMs / 1000)
  }

  setActiveConnections(count: number) {
    this.activeConnectionsGauge.set(count)
  }
}
```

**Azure Monitor Alerts:**

```json
{
  "alerts": [
    {
      "name": "High Message Latency",
      "condition": "avg(message_delivery_duration_seconds) > 0.5",
      "severity": "warning",
      "action": "Send email to ops team"
    },
    {
      "name": "WebSocket Connection Spike",
      "condition": "active_websocket_connections > 10000",
      "severity": "critical",
      "action": "Auto-scale pods + alert ops"
    },
    {
      "name": "Database Connection Pool Exhausted",
      "condition": "database_connections_active / database_connections_max > 0.9",
      "severity": "critical",
      "action": "Scale database + alert ops"
    },
    {
      "name": "Redis Memory Usage High",
      "condition": "redis_memory_used_percent > 80",
      "severity": "warning",
      "action": "Clear old cache + alert ops"
    }
  ]
}
```

### Disaster Recovery Plan

**Backup Strategy:**

```bash
# Daily PostgreSQL backups
0 2 * * * pg_dump -h $DB_HOST -U $DB_USER messaging_db | \
  gzip > /backups/messaging_$(date +\%Y\%m\%d).sql.gz

# Upload to Azure Blob Storage
az storage blob upload \
  --account-name worldschoolsbackups \
  --container-name database-backups \
  --name messaging_$(date +\%Y\%m\%d).sql.gz \
  --file /backups/messaging_$(date +\%Y\%m\%d).sql.gz
```

**Recovery Procedures:**

1. **Database Failure:**
   - Promote read replica to primary (< 5 minutes)
   - Update connection strings in Kubernetes secrets
   - Restart API pods

2. **Redis Failure:**
   - Redis cluster auto-failover (< 30 seconds)
   - WebSocket reconnections handled automatically
   - No data loss (messages persisted in PostgreSQL)

3. **Complete Region Failure:**
   - Failover to secondary Azure region
   - Update DNS to point to secondary region
   - Restore database from latest backup
   - RTO: 30 minutes, RPO: 1 hour

---

## Migration Path

### Phase 1: Database Setup (Week 1)

**Tasks:**
1. Add messaging models to Prisma schema
2. Create and run migrations
3. Seed initial data for testing

```bash
# Add models to apps/wc-nest-api/prisma/schema.prisma
# (Copy models from Database Schema section above)

# Create migration
npx prisma migrate dev --name add_messaging_models

# Generate Prisma client
npx prisma generate

# Seed test data
npx prisma db seed
```

**Seed Script:**

```typescript
// apps/wc-nest-api/prisma/seed-messaging.ts
import { PrismaClient } from './generated/client'

const prisma = new PrismaClient()

async function seedMessaging() {
  // Create test conversations
  const conversation = await prisma.conversation.create({
    data: {
      type: 'USER_PROVIDER',
      participants: {
        create: [
          { userId: 'user-1' },
          { providerId: 'provider-1', userId: 'provider-user-1' },
        ],
      },
    },
  })

  // Create test messages
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        senderId: 'user-1',
        senderType: 'USER',
        content: 'Hello, I have a question about the camp.',
        type: 'REGULAR',
        status: 'SENT',
      },
      {
        conversationId: conversation.id,
        senderId: 'provider-user-1',
        senderType: 'PROVIDER',
        content: 'Hi! I\'d be happy to help. What would you like to know?',
        type: 'REGULAR',
        status: 'SENT',
      },
    ],
  })

  console.log('Messaging data seeded successfully')
}

seedMessaging()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

### Phase 2: Backend Implementation (Weeks 2-3)

**Tasks:**
1. Create messaging module structure
2. Implement REST API endpoints
3. Implement WebSocket gateway
4. Add authentication guards
5. Write unit tests

```bash
# Generate module
npx nx g @nestjs/schematics:module modules/messaging --project=wc-nest-api

# Generate services
npx nx g @nestjs/schematics:service modules/messaging/services/conversations --project=wc-nest-api
npx nx g @nestjs/schematics:service modules/messaging/services/messages --project=wc-nest-api

# Generate controllers
npx nx g @nestjs/schematics:controller modules/messaging/controllers/conversations --project=wc-nest-api
npx nx g @nestjs/schematics:controller modules/messaging/controllers/messages --project=wc-nest-api

# Generate gateway
npx nx g @nestjs/schematics:gateway modules/messaging/messaging --project=wc-nest-api
```

**Testing Strategy:**

```typescript
// apps/wc-nest-api/src/modules/messaging/services/messages.service.spec.ts
import { Test } from '@nestjs/testing'
import { MessagesService } from './messages.service'
import { PrismaService } from '../../core/prisma/prisma.service'

describe('MessagesService', () => {
  let service: MessagesService
  let prisma: PrismaService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MessagesService, PrismaService],
    }).compile()

    service = module.get<MessagesService>(MessagesService)
    prisma = module.get<PrismaService>(PrismaService)
  })

  describe('sendMessage', () => {
    it('should create a new message', async () => {
      const dto = {
        conversationId: 'conv-1',
        content: 'Test message',
        idempotencyKey: 'test-key-1',
      }

      const result = await service.sendMessage('user-1', dto)

      expect(result).toHaveProperty('id')
      expect(result.content).toBe('Test message')
      expect(result.status).toBe('SENT')
    })

    it('should return existing message for duplicate idempotency key', async () => {
      const dto = {
        conversationId: 'conv-1',
        content: 'Test message',
        idempotencyKey: 'duplicate-key',
      }

      const first = await service.sendMessage('user-1', dto)
      const second = await service.sendMessage('user-1', dto)

      expect(first.id).toBe(second.id)
    })
  })
})
```

### Phase 3: Frontend Integration (Week 4)

**Tasks:**
1. Update Zustand store with WebSocket integration
2. Connect UI components to real API
3. Implement offline support
4. Add error handling and retry logic

```typescript
// Migration from mock data to real API
// apps/wc-booking/src/components/layout/messages-sidebar.tsx

// Before (mock data):
const mockConversations = [...]
const [conversations, setConversations] = useState(mockConversations)

// After (real API):
const { conversations, isLoading } = useConversationStore()

useEffect(() => {
  // Fetch conversations from API
  fetch('/api/messages/conversations')
    .then(res => res.json())
    .then(data => setConversations(data))
}, [])
```

### Phase 4: Testing & Optimization (Week 5)

**Load Testing:**

```javascript
// k6 load test script
import http from 'k6/http'
import ws from 'k6/ws'
import { check } from 'k6'

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 1000 },  // Ramp up to 1000 users
    { duration: '5m', target: 1000 },  // Stay at 1000 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
}

export default function () {
  // Test REST API
  const res = http.get('https://api.worldschools.com/api/messages/conversations')
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  })

  // Test WebSocket
  const url = 'wss://api.worldschools.com/messages'
  const params = { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } }

  ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ event: 'conversation:join', data: { conversationId: 'test-1' } }))
    })

    socket.on('message', (data) => {
      check(data, {
        'received message': (d) => d !== null,
      })
    })

    socket.setTimeout(() => {
      socket.close()
    }, 10000)
  })
}
```

### Phase 5: Production Deployment (Week 6)

**Pre-Deployment Checklist:**

- [ ] All tests passing (unit, integration, E2E)
- [ ] Load testing completed (10,000+ concurrent users)
- [ ] Security audit completed
- [ ] Database migrations tested on staging
- [ ] Rollback plan documented
- [ ] Monitoring dashboards configured
- [ ] Alert rules configured
- [ ] On-call rotation scheduled
- [ ] Documentation updated
- [ ] Stakeholders notified

**Deployment Steps:**

```bash
# 1. Deploy to staging
kubectl apply -f k8s/staging/ -n messaging-staging

# 2. Run smoke tests
npm run test:e2e:staging

# 3. Deploy to production (blue-green deployment)
kubectl apply -f k8s/production/ -n messaging-production

# 4. Monitor metrics for 30 minutes
kubectl logs -f deployment/messaging-api -n messaging-production

# 5. Switch traffic to new version
kubectl patch service messaging-api-service -n messaging-production \
  -p '{"spec":{"selector":{"version":"v2"}}}'

# 6. Monitor for issues
# If issues detected, rollback:
kubectl rollout undo deployment/messaging-api -n messaging-production
```

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Message Delivery Latency** | < 100ms (p95) | WebSocket event timestamp diff |
| **API Response Time** | < 200ms (p95) | HTTP request duration |
| **Database Query Time** | < 50ms (p95) | Prisma query duration |
| **WebSocket Connection Time** | < 500ms | Socket.io connection handshake |
| **Concurrent Users** | 10,000+ | Load testing with k6 |
| **Messages per Second** | 1,000+ | Throughput testing |
| **Database Connections** | < 100 | PostgreSQL connection pool |
| **Redis Memory Usage** | < 2GB | Redis INFO command |
| **CPU Usage** | < 70% | Kubernetes metrics |
| **Memory Usage** | < 80% | Kubernetes metrics |

### Scaling Thresholds

**Auto-Scaling Rules:**

```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: messaging-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: messaging-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: active_websocket_connections
      target:
        type: AverageValue
        averageValue: "1000"
```

**Capacity Planning:**

| Users | API Pods | WebSocket Pods | Database vCPUs | Redis Memory |
|-------|----------|----------------|----------------|--------------|
| 1,000 | 2 | 2 | 2 | 512MB |
| 5,000 | 3 | 3 | 4 | 1GB |
| 10,000 | 5 | 5 | 8 | 2GB |
| 25,000 | 8 | 8 | 16 | 4GB |
| 50,000 | 10 | 10 | 32 | 8GB |

### Expected Performance

**Under Normal Load (1,000 concurrent users):**
- Message delivery: 50-80ms (p95)
- API response time: 100-150ms (p95)
- Database queries: 20-40ms (p95)
- CPU usage: 30-40%
- Memory usage: 40-50%

**Under Peak Load (10,000 concurrent users):**
- Message delivery: 80-100ms (p95)
- API response time: 150-200ms (p95)
- Database queries: 40-50ms (p95)
- CPU usage: 60-70%
- Memory usage: 70-80%

---

## Conclusion

This architecture provides a production-ready, scalable real-time messaging system that can handle 10,000+ concurrent users with sub-100ms latency. The design follows industry best practices for:

- **Scalability**: Horizontal scaling with Kubernetes and Redis pub/sub
- **Reliability**: At-least-once delivery, idempotency, offline support
- **Security**: JWT authentication, RBAC, rate limiting, encryption-ready
- **Performance**: Multi-layer caching, database indexing, CDN delivery
- **Observability**: Comprehensive monitoring, logging, and alerting

The migration path provides a clear roadmap from the current mock implementation to a fully functional production system over a 6-week timeline.

### Next Steps

1. **Review & Approval**: Get stakeholder sign-off on architecture
2. **Resource Allocation**: Assign development team and timeline
3. **Infrastructure Setup**: Provision Azure resources (AKS, Redis, PostgreSQL)
4. **Phase 1 Execution**: Begin database schema implementation
5. **Iterative Development**: Follow 6-week migration plan
6. **Production Launch**: Deploy to production with monitoring

### Future Enhancements

- **End-to-end encryption** for sensitive conversations
- **Voice/video calling** integration
- **Message reactions** (emoji reactions)
- **Message threading** for complex conversations
- **AI-powered chatbot** for automated responses
- **Message translation** for international users
- **Advanced search** with filters and facets
- **Message scheduling** for delayed sending

---

**Document Version:** 1.0
**Last Updated:** 2026-01-25
**Author:** World Schools Engineering Team
**Status:** Ready for Review
```

