# Frontend Implementation Plan - Real-Time Messaging System

**Version**: 1.0  
**Date**: 2026-02-11  
**Status**: Implementation Ready  
**Target Apps**: wc-booking (User), wc-provider (Provider)  
**Estimated Timeline**: 4-6 weeks (MVP: 2-3 weeks)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Backend Review Summary](#backend-review-summary)
3. [Implementation Phases](#implementation-phases)
4. [Phase 1: TypeScript Types & DTOs](#phase-1-typescript-types--dtos)
5. [Phase 2: API Client & Services](#phase-2-api-client--services)
6. [Phase 3: WebSocket Integration](#phase-3-websocket-integration)
7. [Phase 4: Enhanced Zustand Store](#phase-4-enhanced-zustand-store)
8. [Phase 5: wc-booking Integration](#phase-5-wc-booking-integration)
9. [Phase 6: wc-provider Implementation](#phase-6-wc-provider-implementation)
10. [Phase 7: Real-time Features](#phase-7-real-time-features)
11. [Phase 8: Advanced Features & Testing](#phase-8-advanced-features--testing)
12. [Provider Conversation Assignment Logic](#provider-conversation-assignment-logic)
13. [Technical Considerations](#technical-considerations)

---

## Executive Summary

This document provides a comprehensive implementation plan for integrating the real-time messaging system with the frontend applications (wc-booking and wc-provider). The backend is fully implemented with NestJS, Prisma, Socket.io, and Redis.

### Key Metrics
- **Total Phases**: 8 phases with clear deliverables
- **New Files**: ~40 files (types, services, stores, components, hooks)
- **Modified Files**: ~15 files (existing UI components, stores)
- **Backend Endpoints**: 32 REST endpoints + 11 WebSocket events
- **Target**: Replace all mock data with real API integration

### Architecture Alignment
- ✅ **Backend**: Fully implemented (Phases 1-7 complete)
- ✅ **REST API**: 32 endpoints across 6 controllers
- ✅ **WebSocket**: 11 event handlers with JWT authentication
- ✅ **Real-time**: Delivery receipts, read receipts, typing indicators, presence tracking
- ✅ **Security**: Rate limiting, RBAC, input sanitization, GDPR compliance

---

## Backend Review Summary

### Backend Implementation Status

**Completed Phases** (7/8):
1. ✅ **Phase 1**: Database & Core Setup - Prisma migration with 15 tables, 13 enums, 67 indexes
2. ✅ **Phase 2**: Core Services Layer - 7 services with 48 passing unit tests
3. ✅ **Phase 3**: REST API Endpoints - 32 endpoints across 6 controllers
4. ✅ **Phase 4**: WebSocket Gateway - 11 event handlers with Redis pub/sub
5. ✅ **Phase 5**: Real-time Features - <100ms latency, delivery/read receipts
6. ✅ **Phase 6**: Advanced Features - Reactions, threading, mentions, bookmarks, etc.
7. ✅ **Phase 7**: Security & Compliance - Rate limiting, GDPR, abuse reporting, security audit

### Key Backend Components

#### REST API Controllers (6 controllers, 32 endpoints)

1. **ConversationsController** (`/messaging/conversations`)
   - `POST /` - Create conversation
   - `GET /` - Get all conversations (with filters)
   - `GET /:id` - Get conversation by ID
   - `PATCH /:id/settings` - Update conversation settings
   - `POST /:id/mark-read` - Mark all messages as read
   - `POST /:id/assign` - Assign conversation to provider user
   - `PATCH /:id/status` - Update conversation status
   - `POST /:id/labels` - Add label to conversation
   - `DELETE /:id/labels/:labelId` - Remove label from conversation
   - `GET /:id/metrics` - Get conversation metrics

2. **MessagesController** (`/messaging/messages`)
   - `POST /` - Send message (with rate limiting)
   - `GET /` - Get messages (paginated)
   - `GET /:id` - Get message by ID
   - `GET /:id/thread` - Get message thread (replies)
   - `GET /:id/edit-history` - Get message edit history
   - `PATCH /:id` - Edit message
   - `DELETE /:id` - Delete message
   - `POST /:id/reactions` - Add reaction
   - `DELETE /:id/reactions` - Remove reaction
   - `POST /:id/bookmark` - Bookmark message
   - `DELETE /:id/bookmark` - Remove bookmark
   - `POST /:id/pin` - Pin message
   - `DELETE /:id/pin` - Unpin message
   - `POST /:id/forward` - Forward message
   - `POST /:id/report` - Report message

3. **AttachmentsController** (`/messaging/attachments`)
   - `POST /upload` - Upload file attachment
   - `GET /:id` - Get attachment metadata
   - `GET /:id/download` - Download attachment

4. **SearchController** (`/messaging/search`)
   - `GET /messages` - Search messages (full-text search)
   - `GET /conversations` - Search conversations

5. **GdprController** (`/messaging/gdpr`)
   - `GET /export` - Export all user data
   - `DELETE /delete-all` - Delete all user data

6. **ReportsController** (`/messaging/reports`)
   - `POST /` - Submit abuse report
   - `GET /` - Get all reports (admin only)
   - `GET /:id` - Get report by ID (admin only)
   - `PATCH /:id/review` - Review report (admin only)

#### WebSocket Events (11 event handlers)

**Namespace**: `/messages`

1. **Connection Lifecycle**
   - `afterInit()` - Gateway initialization
   - `handleConnection()` - New connection handling
   - `handleDisconnect()` - Cleanup on disconnect

2. **Authentication**
   - `authenticate` - JWT authentication event

3. **Conversation Management**
   - `conversation:join` - Join conversation room
   - `conversation:leave` - Leave conversation room

4. **Real-time Features**
   - `message:send` - Send message via WebSocket
   - `message:delivered` - Mark message as delivered
   - `message:read` - Mark message as read
   - `typing:start` - Start typing indicator
   - `typing:stop` - Stop typing indicator
   - `presence:update` - Update presence status

#### Prisma Schema Models (15 models)

**Core Models**:
- `Conversation` - Main conversation entity
- `ConversationParticipant` - User participation in conversations
- `Message` - Message entity
- `MessageReadReceipt` - Read receipt tracking
- `MessageDeliveryReceipt` - Delivery receipt tracking

**Advanced Features**:
- `MessageReaction` - Emoji reactions
- `MessageEditHistory` - Edit history tracking
- `MessageMention` - @mentions tracking
- `MessageBookmark` - User bookmarks
- `MessageReport` - Abuse reports
- `MessageAttachment` - File attachments
- `UserPresence` - Online/offline status
- `ConversationLabel` - Labels for organizing
- `ConversationLabelAssignment` - Label assignments

---

## Implementation Phases

| Phase | Focus Area | Duration | Dependencies | Priority |
|-------|-----------|----------|--------------|----------|
| **Phase 1** | TypeScript Types & DTOs | 2-3 days | None | 🔴 Critical |
| **Phase 2** | API Client & Services | 3-4 days | Phase 1 | 🔴 Critical |
| **Phase 3** | WebSocket Integration | 3-4 days | Phase 1, 2 | 🔴 Critical |
| **Phase 4** | Enhanced Zustand Store | 3-4 days | Phase 1, 2, 3 | 🔴 Critical |
| **Phase 5** | wc-booking Integration | 5-7 days | Phase 1-4 | 🔴 Critical |
| **Phase 6** | wc-provider Implementation | 7-10 days | Phase 1-4 | 🟠 High |
| **Phase 7** | Real-time Features | 4-5 days | Phase 5, 6 | 🟠 High |
| **Phase 8** | Advanced Features & Testing | 5-7 days | All phases | 🟡 Medium |

**Total Estimated Time**: 32-48 days (4-6 weeks with parallel work)
**MVP Timeline**: 16-22 days (2-3 weeks)

---

## Architecture Decision: Shared Utilities in wc-frontend-utils

### Why Use wc-frontend-utils Instead of Creating New Packages?

The messaging system will be used across **all three World Camps applications**:
- `apps/wc-booking` (user-facing booking portal)
- `apps/wc-provider` (provider portal)
- `apps/wc-superadmin` (super admin portal)

To avoid code duplication and maintain consistency, **all shared messaging utilities will be centralized in the existing `@world-schools/wc-frontend-utils` package** rather than creating separate packages.

### Existing Pattern: createAuthStore

The `wc-frontend-utils` package already follows this pattern with authentication:

```typescript
// Existing: packages/wc-frontend-utils/src/lib/create-auth-store.ts
export function createAuthStore(config: AuthStoreConfig) {
  // Shared authentication logic (~390 lines)
  return { useAuthStore }
}

// Usage in each app (configuration only):
// apps/wc-booking/src/stores/auth-store.ts
export const { useAuthStore } = createAuthStore({
  apiClient,
  authService,
  storageKeyPrefix: 'wc_booking',
  usingRequest: false,
})
```

### Messaging Will Follow the Same Pattern

```typescript
// New: packages/wc-frontend-utils/src/lib/messaging/create-messaging-store.ts
export function createMessagingStore(config: MessagingStoreConfig) {
  // Shared messaging logic (~700 lines)
  return { useMessagingStore }
}

// Usage in each app (configuration only):
// apps/wc-booking/src/stores/messaging-store.ts
export const { useMessagingStore } = createMessagingStore({
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
  storageKeyPrefix: 'wc_booking',
  isProviderApp: false,
})
```

### Benefits of This Approach

1. **Code Reduction**: 50% less code (~1,750 lines saved)
   - **Without Factory**: ~3,500 lines total (duplicated stores in each app)
   - **With Factory**: ~1,750 lines total (shared utilities only)

2. **Maintenance**: 67% less effort
   - **Without Factory**: Changes must be made in 3 places (each app's store)
   - **With Factory**: Changes made in 1 place (shared factory)

3. **Consistency**: Guaranteed consistent behavior
   - **Without Factory**: Risk of inconsistent implementations across apps
   - **With Factory**: Single source of truth ensures identical behavior

4. **Architecture**: Follows established patterns
   - **Without Factory**: Violates existing conventions
   - **With Factory**: Matches `createAuthStore` pattern exactly

### Package Structure

All messaging utilities will be organized under:

```
packages/wc-frontend-utils/src/lib/messaging/
├── types/                    # TypeScript types & DTOs
├── api/                      # API client
├── websocket/                # WebSocket service
├── hooks/                    # React hooks
├── components/               # Shared components
├── utils/                    # Utilities
└── create-messaging-store.ts # Store factory
```

### Single Import Source

All apps will import from a single package:

```typescript
import {
  // Types
  Conversation,
  Message,
  SendMessageDto,
  // API
  conversationsApi,
  messagesApi,
  // WebSocket
  SocketService,
  // Hooks
  useSocket,
  useTypingIndicator,
  // Store factory
  createMessagingStore,
} from '@world-schools/wc-frontend-utils'
```

---

## Phase 1: TypeScript Types & DTOs

**Duration**: 2-3 days
**Dependencies**: None
**Priority**: 🔴 Critical Path

### Objectives
- Create TypeScript types matching backend Prisma schema
- Create DTOs matching backend request/response DTOs
- Set up shared types package for reusability across apps
- Ensure type safety for all API interactions

### Deliverables

#### 1.1 Shared Types in wc-frontend-utils
**Location**: `packages/wc-frontend-utils/src/lib/messaging/types/`

**Files to Create**:

1. **`packages/wc-frontend-utils/src/lib/messaging/types/models.ts`** (~300 lines)
   - `Conversation` - Matches Prisma `Conversation` model
   - `ConversationParticipant` - Matches Prisma `ConversationParticipant` model
   - `Message` - Matches Prisma `Message` model
   - `MessageReadReceipt` - Matches Prisma `MessageReadReceipt` model
   - `MessageDeliveryReceipt` - Matches Prisma `MessageDeliveryReceipt` model
   - `MessageReaction` - Matches Prisma `MessageReaction` model
   - `MessageEditHistory` - Matches Prisma `MessageEditHistory` model
   - `MessageMention` - Matches Prisma `MessageMention` model
   - `MessageBookmark` - Matches Prisma `MessageBookmark` model
   - `MessageReport` - Matches Prisma `MessageReport` model
   - `MessageAttachment` - Matches Prisma `MessageAttachment` model
   - `UserPresence` - Matches Prisma `UserPresence` model
   - `ConversationLabel` - Matches Prisma `ConversationLabel` model

2. **`packages/wc-frontend-utils/src/lib/messaging/types/enums.ts`** (~100 lines)
   - `ConversationType` - USER_PROVIDER, USER_SUPERADMIN, GROUP
   - `ConversationStatus` - OPEN, RESOLVED, CLOSED
   - `SenderType` - USER, PROVIDER, SUPERADMIN, SYSTEM
   - `ContentType` - TEXT, HTML, MARKDOWN
   - `MessageType` - TEXT, IMAGE, FILE, SYSTEM
   - `MessageStatus` - PENDING, SENT, DELIVERED, READ, FAILED
   - `MessagePriority` - LOW, NORMAL, HIGH, URGENT
   - `PresenceStatus` - ONLINE, OFFLINE, AWAY
   - `DeletionType` - SOFT, HARD
   - `ReportReason` - SPAM, HARASSMENT, INAPPROPRIATE, OTHER
   - `ReportStatus` - PENDING, UNDER_REVIEW, RESOLVED, DISMISSED
   - `ContextType` - BOOKING, PROVIDER, CAMP, OTHER

3. **`packages/wc-frontend-utils/src/lib/messaging/types/conversation.dto.ts`** (~150 lines)
   - `CreateConversationDto` - Matches backend DTO
   - `GetConversationsDto` - Matches backend DTO
   - `UpdateConversationSettingsDto` - Matches backend DTO
   - `UpdateConversationStatusDto` - Matches backend DTO
   - `AssignConversationDto` - Matches backend DTO
   - `AddLabelDto` - Matches backend DTO
   - `RemoveLabelDto` - Matches backend DTO

4. **`packages/wc-frontend-utils/src/lib/messaging/types/message.dto.ts`** (~200 lines)
   - `SendMessageDto` - Matches backend DTO
   - `GetMessagesDto` - Matches backend DTO
   - `EditMessageDto` - Matches backend DTO
   - `DeleteMessageDto` - Matches backend DTO
   - `AddReactionDto` - Matches backend DTO
   - `RemoveReactionDto` - Matches backend DTO
   - `BookmarkMessageDto` - Matches backend DTO
   - `PinMessageDto` - Matches backend DTO
   - `ForwardMessageDto` - Matches backend DTO
   - `ReportMessageDto` - Matches backend DTO
   - `MarkAsReadDto` - Matches backend DTO
   - `MarkAsDeliveredDto` - Matches backend DTO

5. **`packages/wc-frontend-utils/src/lib/messaging/types/response.dto.ts`** (~250 lines)
   - `UserResponseDto` - User information
   - `ProviderResponseDto` - Provider information
   - `ParticipantResponseDto` - Conversation participant
   - `MessageResponseDto` - Message with relations
   - `ConversationResponseDto` - Conversation with relations
   - `PaginatedMessagesResponseDto` - Paginated messages
   - `PaginatedConversationsResponseDto` - Paginated conversations
   - `ConversationMetricsResponseDto` - Conversation metrics
   - `ReadReceiptResponseDto` - Read receipt
   - `DeliveryReceiptResponseDto` - Delivery receipt
   - `ReactionResponseDto` - Message reaction
   - `MentionResponseDto` - Message mention
   - `EditHistoryResponseDto` - Edit history entry

6. **`packages/wc-frontend-utils/src/lib/messaging/types/websocket.dto.ts`** (~100 lines)
   - `AuthenticateDto` - WebSocket authentication
   - `JoinConversationDto` - Join conversation room
   - `LeaveConversationDto` - Leave conversation room
   - `TypingStartDto` - Start typing indicator
   - `TypingStopDto` - Stop typing indicator
   - `PresenceUpdateDto` - Update presence status
   - `MessageDeliveredEventDto` - Message delivered event
   - `MessageReadEventDto` - Message read event
   - `TypingEventDto` - Typing indicator event
   - `PresenceEventDto` - Presence update event

7. **`packages/wc-frontend-utils/src/lib/messaging/types/index.ts`** (~50 lines)
   - Export all types, enums, and DTOs

### Code Examples

#### Example: Conversation Type
```typescript
// packages/wc-frontend-utils/src/lib/messaging/types/models.ts
import type {
  ConversationType,
  ConversationStatus,
  ContextType,
} from './enums'

export interface Conversation {
  id: string
  type: ConversationType
  createdAt: Date
  updatedAt: Date
  lastMessageId: string | null
  lastActivityAt: Date

  // Metadata
  subject: string | null
  contextType: ContextType | null
  contextId: string | null
  metadata: Record<string, any> | null

  // Status
  status: ConversationStatus
  resolvedAt: Date | null
  resolvedBy: string | null
  closedAt: Date | null
  closedBy: string | null

  // Assignment (for provider conversations)
  assignedToUserId: string | null
  assignedAt: Date | null
  assignedBy: string | null

  // Relations (optional, populated by API)
  participants?: ConversationParticipant[]
  lastMessage?: Message
  labels?: ConversationLabel[]
}
```

#### Example: Send Message DTO
```typescript
// packages/wc-frontend-utils/src/lib/messaging/types/message.dto.ts
import type { SenderType, ContentType, MessagePriority } from './enums'

export interface SendMessageDto {
  conversationId: string
  senderId: string
  senderType: SenderType
  content: string
  contentType?: ContentType
  attachmentIds?: string[]
  replyToId?: string
  priority?: MessagePriority
  scheduledFor?: Date
  idempotencyKey: string
}
```

### Success Criteria
- [ ] All Prisma models have corresponding TypeScript types
- [ ] All backend DTOs have corresponding frontend DTOs
- [ ] Types are properly exported from package
- [ ] No TypeScript errors in types package
- [ ] Types can be imported in wc-booking and wc-provider apps

---

## Phase 2: API Client & Services

**Duration**: 3-4 days
**Dependencies**: Phase 1
**Priority**: 🔴 Critical Path

### Objectives
- Create API client for messaging endpoints
- Implement service layer for conversations and messages
- Add error handling and retry logic
- Implement request/response interceptors
- Add TypeScript type safety for all API calls

### Deliverables

#### 2.1 Messaging API Client
**Location**: `packages/wc-frontend-utils/src/lib/messaging/api/`

**Files to Create**:

1. **`packages/wc-frontend-utils/src/lib/messaging/api/conversations.api.ts`** (~200 lines)
   - `createConversation(dto: CreateConversationDto): Promise<ConversationResponseDto>`
   - `getConversations(dto: GetConversationsDto): Promise<PaginatedConversationsResponseDto>`
   - `getConversationById(id: string): Promise<ConversationResponseDto>`
   - `updateConversationSettings(id: string, dto: UpdateConversationSettingsDto): Promise<void>`
   - `markAllAsRead(conversationId: string): Promise<void>`
   - `assignConversation(id: string, dto: AssignConversationDto): Promise<void>`
   - `updateConversationStatus(id: string, dto: UpdateConversationStatusDto): Promise<void>`
   - `addLabel(id: string, dto: AddLabelDto): Promise<void>`
   - `removeLabel(id: string, labelId: string): Promise<void>`
   - `getConversationMetrics(id: string): Promise<ConversationMetricsResponseDto>`

2. **`packages/wc-frontend-utils/src/lib/messaging/api/messages.api.ts`** (~300 lines)
   - `sendMessage(dto: SendMessageDto): Promise<MessageResponseDto>`
   - `getMessages(dto: GetMessagesDto): Promise<PaginatedMessagesResponseDto>`
   - `getMessageById(id: string): Promise<MessageResponseDto>`
   - `getMessageThread(id: string): Promise<MessageResponseDto[]>`
   - `getMessageEditHistory(id: string): Promise<EditHistoryResponseDto[]>`
   - `editMessage(id: string, dto: EditMessageDto): Promise<MessageResponseDto>`
   - `deleteMessage(id: string, dto: DeleteMessageDto): Promise<void>`
   - `addReaction(id: string, dto: AddReactionDto): Promise<void>`
   - `removeReaction(id: string, emoji: string): Promise<void>`
   - `bookmarkMessage(id: string, dto: BookmarkMessageDto): Promise<void>`
   - `unbookmarkMessage(id: string): Promise<void>`
   - `pinMessage(id: string): Promise<void>`
   - `unpinMessage(id: string): Promise<void>`
   - `forwardMessage(id: string, dto: ForwardMessageDto): Promise<MessageResponseDto>`
   - `reportMessage(id: string, dto: ReportMessageDto): Promise<void>`

3. **`packages/wc-frontend-utils/src/lib/messaging/api/attachments.api.ts`** (~100 lines)
   - `uploadAttachment(file: File, conversationId: string): Promise<MessageAttachment>`
   - `getAttachment(id: string): Promise<MessageAttachment>`
   - `downloadAttachment(id: string): Promise<Blob>`

4. **`packages/wc-frontend-utils/src/lib/messaging/api/search.api.ts`** (~80 lines)
   - `searchMessages(query: string, filters?: SearchFilters): Promise<PaginatedMessagesResponseDto>`
   - `searchConversations(query: string): Promise<PaginatedConversationsResponseDto>`

5. **`packages/wc-frontend-utils/src/lib/messaging/api/index.ts`** (~30 lines)
   - Export all API functions

### Code Examples

#### Example: Conversations API
```typescript
// packages/wc-frontend-utils/src/lib/messaging/api/conversations.api.ts
import type {
  CreateConversationDto,
  GetConversationsDto,
  UpdateConversationSettingsDto,
  ConversationResponseDto,
  PaginatedConversationsResponseDto,
} from '../types'
import { apiClient } from '@world-schools/wc-utils'

export const conversationsApi = {
  async createConversation(
    dto: CreateConversationDto
  ): Promise<ConversationResponseDto> {
    const response = await apiClient.post('/messaging/conversations', dto)
    return response.data.data
  },

  async getConversations(
    dto: GetConversationsDto
  ): Promise<PaginatedConversationsResponseDto> {
    const response = await apiClient.get('/messaging/conversations', {
      params: dto,
    })
    return response.data.data
  },

  async getConversationById(id: string): Promise<ConversationResponseDto> {
    const response = await apiClient.get(`/messaging/conversations/${id}`)
    return response.data.data
  },

  async updateConversationSettings(
    id: string,
    dto: UpdateConversationSettingsDto
  ): Promise<void> {
    await apiClient.patch(`/messaging/conversations/${id}/settings`, dto)
  },

  async markAllAsRead(conversationId: string): Promise<void> {
    await apiClient.post(`/messaging/conversations/${conversationId}/mark-read`)
  },
}
```

#### Example: Messages API with Retry Logic
```typescript
// packages/wc-frontend-utils/src/lib/messaging/api/messages.api.ts
import type {
  SendMessageDto,
  GetMessagesDto,
  MessageResponseDto,
  PaginatedMessagesResponseDto,
} from '../types'
import { apiClient } from '../client'

export const messagesApi = {
  async sendMessage(dto: SendMessageDto): Promise<MessageResponseDto> {
    // Retry logic for failed sends
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await apiClient.post('/messaging/messages', dto)
        return response.data.data
      } catch (error) {
        lastError = error as Error

        // Don't retry on 4xx errors (client errors)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          throw error
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          )
        }
      }
    }

    throw lastError
  },

  async getMessages(
    dto: GetMessagesDto
  ): Promise<PaginatedMessagesResponseDto> {
    const response = await apiClient.get('/messaging/messages', {
      params: dto,
    })
    return response.data.data
  },
}
```

### Success Criteria
- [ ] All REST API endpoints have corresponding client methods
- [ ] All methods are properly typed with TypeScript
- [ ] Error handling implemented for all API calls
- [ ] Retry logic implemented for critical operations
- [ ] Request/response interceptors configured
- [ ] API client can be used in wc-booking and wc-provider apps

---

## Phase 3: WebSocket Integration

**Duration**: 3-4 days
**Dependencies**: Phase 1, 2
**Priority**: 🔴 Critical Path

### Objectives
- Implement Socket.io client for real-time communication
- Create WebSocket service with event handlers
- Implement connection lifecycle management
- Add automatic reconnection logic
- Integrate with JWT authentication

### Deliverables

#### 3.1 WebSocket Service
**Location**: `packages/wc-frontend-utils/src/lib/messaging/websocket/`

**Files to Create**:

1. **`packages/wc-frontend-utils/src/lib/messaging/websocket/socket.service.ts`** (~400 lines)
   - `SocketService` class for WebSocket management
   - Connection lifecycle methods
   - Event emitters and listeners
   - Automatic reconnection
   - JWT authentication integration

2. **`packages/wc-frontend-utils/src/lib/messaging/websocket/events.ts`** (~150 lines)
   - Event type definitions
   - Event payload interfaces
   - Event handler types

3. **`packages/wc-frontend-utils/src/lib/messaging/websocket/index.ts`** (~20 lines)
   - Export WebSocket utilities

#### 3.2 React Hooks for WebSocket
**Location**: `packages/wc-frontend-utils/src/lib/messaging/hooks/`

**Files to Create**:

1. **`packages/wc-frontend-utils/src/lib/messaging/hooks/use-socket.ts`** (~200 lines)
   - React hook for WebSocket connection
   - Connection state management
   - Event subscription helpers

2. **`packages/wc-frontend-utils/src/lib/messaging/hooks/use-typing-indicator.ts`** (~100 lines)
   - React hook for typing indicators
   - Auto-stop after 5 seconds

3. **`packages/wc-frontend-utils/src/lib/messaging/hooks/use-presence.ts`** (~100 lines)
   - React hook for presence tracking
   - Online/offline status

4. **`packages/wc-frontend-utils/src/lib/messaging/hooks/index.ts`** (~20 lines)
   - Export all hooks

### Code Examples

#### Example: Socket Service
```typescript
// packages/wc-frontend-utils/src/lib/messaging/websocket/socket.service.ts
import { io, Socket } from 'socket.io-client'
import type {
  AuthenticateDto,
  JoinConversationDto,
  LeaveConversationDto,
  TypingStartDto,
  TypingStopDto,
  PresenceUpdateDto,
  SendMessageDto,
  MarkAsReadDto,
  MarkAsDeliveredDto,
} from '../types'

export class SocketService {
  private socket: Socket | null = null
  private token: string | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  constructor(private baseUrl: string) {}

  /**
   * Connect to WebSocket server
   */
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.token = token

      this.socket = io(`${this.baseUrl}/messages`, {
        transports: ['websocket', 'polling'],
        auth: {
          token,
        },
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      })

      this.socket.on('connect', () => {
        console.log('WebSocket connected:', this.socket?.id)
        this.reconnectAttempts = 0
        resolve()
      })

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error)
        this.reconnectAttempts++

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Max reconnection attempts reached'))
        }
      })

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
      })

      // Set up event listeners
      this.setupEventListeners()
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  /**
   * Join a conversation room
   */
  joinConversation(dto: JoinConversationDto): void {
    this.socket?.emit('conversation:join', dto)
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(dto: LeaveConversationDto): void {
    this.socket?.emit('conversation:leave', dto)
  }

  /**
   * Send typing start indicator
   */
  startTyping(dto: TypingStartDto): void {
    this.socket?.emit('typing:start', dto)
  }

  /**
   * Send typing stop indicator
   */
  stopTyping(dto: TypingStopDto): void {
    this.socket?.emit('typing:stop', dto)
  }

  /**
   * Update presence status
   */
  updatePresence(dto: PresenceUpdateDto): void {
    this.socket?.emit('presence:update', dto)
  }

  /**
   * Mark message as delivered
   */
  markAsDelivered(dto: MarkAsDeliveredDto): void {
    this.socket?.emit('message:delivered', dto)
  }

  /**
   * Mark message as read
   */
  markAsRead(dto: MarkAsReadDto): void {
    this.socket?.emit('message:read', dto)
  }

  /**
   * Listen for new messages
   */
  onNewMessage(callback: (message: MessageResponseDto) => void): () => void {
    this.socket?.on('message:new', callback)
    return () => this.socket?.off('message:new', callback)
  }

  /**
   * Listen for message delivered events
   */
  onMessageDelivered(
    callback: (data: { messageId: string; userId: string }) => void
  ): () => void {
    this.socket?.on('message:delivered', callback)
    return () => this.socket?.off('message:delivered', callback)
  }

  /**
   * Listen for message read events
   */
  onMessageRead(
    callback: (data: { messageId: string; userId: string }) => void
  ): () => void {
    this.socket?.on('message:read', callback)
    return () => this.socket?.off('message:read', callback)
  }

  /**
   * Listen for typing indicators
   */
  onTyping(
    callback: (data: { conversationId: string; userId: string; isTyping: boolean }) => void
  ): () => void {
    this.socket?.on('typing:update', callback)
    return () => this.socket?.off('typing:update', callback)
  }

  /**
   * Listen for presence updates
   */
  onPresenceUpdate(
    callback: (data: { userId: string; status: PresenceStatus }) => void
  ): () => void {
    this.socket?.on('presence:update', callback)
    return () => this.socket?.off('presence:update', callback)
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts')
    })

    this.socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed')
    })
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }
}
```

#### Example: useSocket Hook
```typescript
// packages/wc-frontend-utils/src/lib/messaging/hooks/useSocket.ts
import { useEffect, useState, useCallback } from 'react'
import { SocketService } from '../websocket/socket.service'
import { useAuthStore } from '@/stores/auth-store'

export function useSocket(baseUrl: string) {
  const [socket, setSocket] = useState<SocketService | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { token } = useAuthStore()

  useEffect(() => {
    if (!token) return

    const socketService = new SocketService(baseUrl)

    socketService.connect(token)
      .then(() => {
        setSocket(socketService)
        setIsConnected(true)
      })
      .catch((error) => {
        console.error('Failed to connect to WebSocket:', error)
      })

    return () => {
      socketService.disconnect()
      setIsConnected(false)
    }
  }, [baseUrl, token])

  const joinConversation = useCallback((conversationId: string) => {
    socket?.joinConversation({ conversationId })
  }, [socket])

  const leaveConversation = useCallback((conversationId: string) => {
    socket?.leaveConversation({ conversationId })
  }, [socket])

  return {
    socket,
    isConnected,
    joinConversation,
    leaveConversation,
  }
}
```

### Success Criteria
- [ ] WebSocket service connects to backend successfully
- [ ] JWT authentication works for WebSocket connection
- [ ] All WebSocket events have corresponding methods
- [ ] Automatic reconnection works correctly
- [ ] React hooks provide easy integration
- [ ] Connection state is properly managed

---

## Phase 4: Enhanced Zustand Store (Factory Pattern)

**Duration**: 3-4 days
**Dependencies**: Phase 1, 2, 3
**Priority**: 🔴 Critical Path

### Objectives
- Create shared messaging store factory (following `createAuthStore` pattern)
- Add message state management
- Integrate WebSocket events
- Implement optimistic UI updates
- Add offline message queue
- Implement real-time features (typing, presence, receipts)
- Support app-specific configuration (provider assignment logic)

### Deliverables

#### 4.1 Shared Messaging Store Factory
**Location**: `packages/wc-frontend-utils/src/lib/messaging/create-messaging-store.ts`

**Files to Create**:

1. **`packages/wc-frontend-utils/src/lib/messaging/create-messaging-store.ts`** (~700 lines)
   - Factory function for creating messaging store
   - Accepts `MessagingStoreConfig` for app-specific behavior
   - Shared logic for all apps:
     - Conversation management
     - Message state management
     - WebSocket integration
     - Optimistic updates
     - Offline queue
     - Real-time features (typing, presence, receipts)
   - Conditional provider-specific logic:
     - Conversation assignment (when `isProviderApp: true`)
     - Assignment state management
     - Reply permission checks

#### 4.2 App-Specific Store Configuration
**Location**: Each app's `src/stores/messaging-store.ts`

**Files to Create/Modify**:

1. **`apps/wc-booking/src/stores/messaging-store.ts`** (~30 lines)
   - Configuration only
   - Imports and configures `createMessagingStore`
   - Sets `isProviderApp: false`

2. **`apps/wc-provider/src/stores/messaging-store.ts`** (~40 lines)
   - Configuration only
   - Imports and configures `createMessagingStore`
   - Sets `isProviderApp: true, enableAssignment: true`

3. **`apps/wc-superadmin/src/stores/messaging-store.ts`** (~30 lines)
   - Configuration only
   - Imports and configures `createMessagingStore`
   - Sets `isProviderApp: false`

### Code Examples

#### Example 1: Messaging Store Factory (Shared)

```typescript
// packages/wc-frontend-utils/src/lib/messaging/create-messaging-store.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type {
  ConversationResponseDto,
  MessageResponseDto,
  SendMessageDto,
  PresenceStatus,
} from './types'
import { conversationsApi, messagesApi } from './api'
import { SocketService } from './websocket'

/**
 * Configuration for creating a messaging store
 */
export interface MessagingStoreConfig {
  /**
   * Base URL for API and WebSocket
   */
  baseUrl: string

  /**
   * Prefix for storage keys (e.g., 'wc_booking', 'wc_provider')
   */
  storageKeyPrefix: string

  /**
   * Whether this is a provider app (enables assignment logic)
   */
  isProviderApp?: boolean

  /**
   * Whether to enable conversation assignment features
   */
  enableAssignment?: boolean
}

interface MessagingState {
  // Conversations
  conversations: ConversationResponseDto[]
  activeConversationId: string | null

  // Messages (keyed by conversationId)
  messages: Record<string, MessageResponseDto[]>

  // WebSocket
  socket: SocketService | null
  isConnected: boolean

  // Real-time features
  typingUsers: Record<string, string[]> // conversationId -> userId[]
  userPresence: Record<string, PresenceStatus> // userId -> status

  // Offline support
  pendingMessages: MessageResponseDto[]
  failedMessages: MessageResponseDto[]

  // Loading states
  isLoadingConversations: boolean
  isLoadingMessages: Record<string, boolean>
}

interface MessagingActions {
  // Conversations
  fetchConversations: () => Promise<void>
  setActiveConversation: (conversationId: string | null) => void
  updateConversation: (conversationId: string, updates: Partial<ConversationResponseDto>) => void

  // Messages
  fetchMessages: (conversationId: string) => Promise<void>
  sendMessage: (dto: SendMessageDto) => Promise<void>
  addMessage: (message: MessageResponseDto) => void
  updateMessage: (messageId: string, updates: Partial<MessageResponseDto>) => void
  deleteMessage: (messageId: string) => void

  // Real-time features
  markAsRead: (conversationId: string, messageId: string) => Promise<void>
  markAsDelivered: (messageId: string) => Promise<void>
  startTyping: (conversationId: string) => void
  stopTyping: (conversationId: string) => void

  // WebSocket
  connectSocket: (token: string) => Promise<void>
  disconnectSocket: () => void
  joinConversation: (conversationId: string) => void
  leaveConversation: (conversationId: string) => void

  // Offline support
  retryFailedMessages: () => Promise<void>

  // Provider-specific actions (conditionally added)
  assignConversation?: (conversationId: string, userId: string) => Promise<void>
  canReplyToConversation?: (conversationId: string) => boolean
}

type MessagingStore = MessagingState & MessagingActions

/**
 * Factory function for creating a messaging store
 * Follows the same pattern as createAuthStore
 */
export function createMessagingStore(config: MessagingStoreConfig) {
  const { baseUrl, storageKeyPrefix, isProviderApp, enableAssignment } = config

  const useMessagingStore = create<MessagingStore>()(
    devtools(
      persist(
        immer((set, get) => ({
          // Initial state
          conversations: [],
          activeConversationId: null,
          messages: {},
          socket: null,
          isConnected: false,
          typingUsers: {},
          userPresence: {},
          pendingMessages: [],
          failedMessages: [],
          isLoadingConversations: false,
          isLoadingMessages: {},

          // Fetch conversations
          fetchConversations: async () => {
            set((state) => {
              state.isLoadingConversations = true
            })

            try {
              const response = await conversationsApi.getConversations({
                limit: 100,
              })

              set((state) => {
                state.conversations = response.data
                state.isLoadingConversations = false
              })
            } catch (error) {
              console.error('Failed to fetch conversations:', error)
              set((state) => {
                state.isLoadingConversations = false
              })
            }
          },

          // Fetch messages for conversation
          fetchMessages: async (conversationId) => {
            set((state) => {
              state.isLoadingMessages[conversationId] = true
            })

          try {
            const response = await messagesApi.getMessages({
              conversationId,
              limit: 50,
            })

            set((state) => {
              state.messages[conversationId] = response.data
              state.isLoadingMessages[conversationId] = false
            })
          } catch (error) {
            console.error('Failed to fetch messages:', error)
            set((state) => {
              state.isLoadingMessages[conversationId] = false
            })
          }
        },

        // Send message with optimistic update
        sendMessage: async (dto) => {
          // Provider-specific logic: Auto-assign conversation on first reply
          if (isProviderApp && enableAssignment) {
            const conversation = get().conversations.find(
              (c) => c.id === dto.conversationId
            )

            // Auto-assign if unassigned
            if (conversation && !conversation.assignedToUserId) {
              await get().assignConversation?.(dto.conversationId, dto.senderId)
            }
          }

          const optimisticMessage: MessageResponseDto = {
            id: `temp-${Date.now()}`,
            ...dto,
            status: 'PENDING',
            sentAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          } as MessageResponseDto

          // Optimistic update
          set((state) => {
            if (!state.messages[dto.conversationId]) {
              state.messages[dto.conversationId] = []
            }
            state.messages[dto.conversationId].push(optimisticMessage)
            state.pendingMessages.push(optimisticMessage)
          })

          try {
            const sentMessage = await messagesApi.sendMessage(dto)

            // Replace optimistic message with real message
            set((state) => {
              const messages = state.messages[dto.conversationId]
              const index = messages.findIndex((m) => m.id === optimisticMessage.id)
              if (index !== -1) {
                messages[index] = sentMessage
              }
              state.pendingMessages = state.pendingMessages.filter(
                (m) => m.id !== optimisticMessage.id
              )
            })
          } catch (error) {
            console.error('Failed to send message:', error)

            // Mark as failed
            set((state) => {
              const messages = state.messages[dto.conversationId]
              const index = messages.findIndex((m) => m.id === optimisticMessage.id)
              if (index !== -1) {
                messages[index].status = 'FAILED'
              }
              state.failedMessages.push(optimisticMessage)
              state.pendingMessages = state.pendingMessages.filter(
                (m) => m.id !== optimisticMessage.id
              )
            })
          }
        },

        // WebSocket connection
        connectSocket: async (token) => {
          const socket = new SocketService(baseUrl)
          await socket.connect(token)

          // Set up event listeners
          socket.onNewMessage((message) => {
            get().addMessage(message)
          })

          socket.onMessageUpdated((message) => {
            get().updateMessage(message.id, message)
          })

          socket.onTypingStart((data) => {
            set((state) => {
              if (!state.typingUsers[data.conversationId]) {
                state.typingUsers[data.conversationId] = []
              }
              if (!state.typingUsers[data.conversationId].includes(data.userId)) {
                state.typingUsers[data.conversationId].push(data.userId)
              }
            })
          })

          socket.onTypingStop((data) => {
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
            state.isConnected = true
          })
        },

        // ... other shared actions (addMessage, updateMessage, deleteMessage, etc.)
        // ... (truncated for brevity - full implementation would be ~700 lines)

        // Provider-specific actions (conditionally added)
        ...(isProviderApp && enableAssignment
          ? {
              assignConversation: async (conversationId, userId) => {
                await conversationsApi.assignConversation(conversationId, {
                  assignedToUserId: userId,
                })

                set((state) => {
                  const conversation = state.conversations.find(
                    (c) => c.id === conversationId
                  )
                  if (conversation) {
                    conversation.assignedToUserId = userId
                    conversation.assignedAt = new Date()
                  }
                })
              },

              canReplyToConversation: (conversationId) => {
                const conversation = get().conversations.find(
                  (c) => c.id === conversationId
                )
                if (!conversation) return false

                // If unassigned, anyone can reply
                if (!conversation.assignedToUserId) return true

                // If assigned, only assigned user can reply
                // (currentUserId would come from auth store or config)
                return conversation.assignedToUserId === get().currentUserId
              },
            }
          : {}),
        })),
        {
          name: `${storageKeyPrefix}_messaging`,
          partialize: (state) => ({
            conversations: state.conversations,
            messages: state.messages,
          }),
        }
      )
    )
  )

  return { useMessagingStore }
}
```

#### Example 2: App-Specific Configuration (wc-booking)

```typescript
// apps/wc-booking/src/stores/messaging-store.ts
import { createMessagingStore } from '@world-schools/wc-frontend-utils'

export const { useMessagingStore } = createMessagingStore({
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
  storageKeyPrefix: 'wc_booking',
  isProviderApp: false,
  enableAssignment: false,
})
```

#### Example 3: App-Specific Configuration (wc-provider)

```typescript
// apps/wc-provider/src/stores/messaging-store.ts
import { createMessagingStore } from '@world-schools/wc-frontend-utils'

export const { useMessagingStore } = createMessagingStore({
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
  storageKeyPrefix: 'wc_provider',
  isProviderApp: true,
  enableAssignment: true,
})

// Usage in provider app:
// const canReply = useMessagingStore((state) => state.canReplyToConversation?.(conversationId))
// if (canReply) {
//   await useMessagingStore.getState().sendMessage(dto)
// }
```

### Success Criteria
- [ ] `createMessagingStore` factory function created in `wc-frontend-utils`
- [ ] Factory accepts `MessagingStoreConfig` for app-specific behavior
- [ ] All three apps (wc-booking, wc-provider, wc-superadmin) use the factory
- [ ] Provider-specific logic (assignment) works correctly when `isProviderApp: true`
- [ ] Zustand store manages conversations and messages
- [ ] WebSocket events update store in real-time
- [ ] Optimistic UI updates work correctly
- [ ] Offline message queue implemented
- [ ] Typing indicators work
- [ ] Presence tracking works
- [ ] Read/delivery receipts update in real-time
- [ ] No code duplication across apps (configuration only)

---

## Phase 5: wc-booking UI Integration

**Duration**: 4-5 days
**Dependencies**: Phase 1, 2, 3, 4
**Priority**: 🔴 Critical Path

### Objectives
- Replace mock data with real API integration
- Integrate WebSocket for real-time updates
- Implement optimistic UI updates
- Add loading and error states
- Implement message delivery/read receipts UI
- Add typing indicators UI
- Implement offline support UI

### Deliverables

#### 5.1 Update Messages Page
**Location**: `apps/wc-booking/src/app/messages/page.tsx`

**Tasks**:

1. **Replace Mock Data** (~100 lines modified)
   - Remove all mock data (`mockHistory`, `mockConversations`)
   - Replace with `useMessagingStore` hook
   - Fetch conversations on mount
   - Fetch messages when conversation selected

2. **Integrate WebSocket** (~50 lines)
   - Connect to WebSocket on mount
   - Join active conversation room
   - Handle real-time message updates
   - Handle typing indicators
   - Handle presence updates

3. **Update Message Sending** (~80 lines)
   - Replace mock send with `sendMessage` action
   - Add idempotency key generation
   - Show optimistic UI updates
   - Handle send failures with retry UI

4. **Add Real-time Features UI** (~100 lines)
   - Display typing indicators ("User is typing...")
   - Show message delivery status (sent, delivered, read)
   - Display read receipts with timestamps
   - Show online/offline status for participants

5. **Add Loading States** (~50 lines)
   - Show skeleton loaders for conversations
   - Show skeleton loaders for messages
   - Show loading spinner when sending messages
   - Show loading state for attachments

6. **Add Error Handling** (~60 lines)
   - Display error messages for failed sends
   - Show retry button for failed messages
   - Display connection status (connected/disconnected)
   - Show offline mode indicator

### Code Example: Updated Messages Page

```typescript
// apps/wc-booking/src/app/messages/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useMessagingStore } from '@/stores/messaging-store'
import { useAuthStore } from '@/stores/auth-store'
import { MessageBubble } from '@/components/messages/MessageBubble'
import { TypingIndicator } from '@/components/messages/TypingIndicator'
import { ConnectionStatus } from '@/components/messages/ConnectionStatus'

export default function MessagesPage() {
  const { user, token } = useAuthStore()
  const {
    conversations,
    activeConversationId,
    messages,
    isConnected,
    typingUsers,
    fetchConversations,
    setActiveConversation,
    sendMessage,
    connectSocket,
    startTyping,
    stopTyping,
  } = useMessagingStore()

  const [messageInput, setMessageInput] = useState('')
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null)

  // Connect to WebSocket on mount
  useEffect(() => {
    if (token) {
      connectSocket(token)
    }
  }, [token, connectSocket])

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Get active conversation messages
  const activeMessages = activeConversationId
    ? messages[activeConversationId] || []
    : []

  // Get typing users for active conversation
  const activeTypingUsers = activeConversationId
    ? typingUsers[activeConversationId] || []
    : []

  // Handle message input change
  const handleInputChange = (value: string) => {
    setMessageInput(value)

    // Send typing indicator
    if (activeConversationId && value.length > 0) {
      startTyping(activeConversationId)

      // Auto-stop typing after 5 seconds
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }

      const timeout = setTimeout(() => {
        stopTyping(activeConversationId)
      }, 5000)

      setTypingTimeout(timeout)
    } else if (activeConversationId) {
      stopTyping(activeConversationId)
    }
  }

  // Handle send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeConversationId || !user) return

    const idempotencyKey = `${user.id}-${Date.now()}-${Math.random()}`

    await sendMessage({
      conversationId: activeConversationId,
      senderId: user.id,
      senderType: 'USER',
      content: messageInput.trim(),
      idempotencyKey,
    })

    setMessageInput('')

    // Stop typing indicator
    stopTyping(activeConversationId)
    if (typingTimeout) {
      clearTimeout(typingTimeout)
    }
  }

  return (
    <div className="flex h-screen">
      {/* Connection Status */}
      <ConnectionStatus isConnected={isConnected} />

      {/* Conversations List */}
      <div className="w-1/3 border-r">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            onClick={() => setActiveConversation(conversation.id)}
            className={`p-4 cursor-pointer ${
              activeConversationId === conversation.id ? 'bg-blue-50' : ''
            }`}
          >
            <h3>{conversation.subject || 'Conversation'}</h3>
            <p className="text-sm text-gray-500">
              {conversation.lastMessage?.content}
            </p>
          </div>
        ))}
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isCurrentUser={message.senderId === user?.id}
            />
          ))}

          {/* Typing Indicator */}
          {activeTypingUsers.length > 0 && (
            <TypingIndicator users={activeTypingUsers} />
          )}
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="w-full p-2 border rounded"
          />
        </div>
      </div>
    </div>
  )
}
```

### Success Criteria
- [ ] Mock data completely removed
- [ ] Real API integration working
- [ ] WebSocket connection established
- [ ] Real-time messages appear instantly
- [ ] Typing indicators work
- [ ] Message status (sent/delivered/read) displayed
- [ ] Offline support with retry functionality
- [ ] Loading states implemented
- [ ] Error handling implemented

---

## Phase 6: wc-provider Implementation

**Duration**: 5-6 days
**Dependencies**: Phase 1, 2, 3, 4
**Priority**: 🔴 Critical Path

### Objectives
- Create messaging UI for provider app
- Implement **shared conversation visibility** for all provider users in organization
- Implement **conversation assignment logic** (assign on first reply)
- Implement **exclusive reply rights** after assignment
- Add conversation reassignment capability
- Display assignment status in UI

### Deliverables

#### 6.1 Provider Messaging Store Configuration
**Location**: `apps/wc-provider/src/stores/messaging-store.ts`

**Key Differences from wc-booking**:
- Uses `createMessagingStore` factory with `isProviderApp: true`
- Enables conversation assignment features with `enableAssignment: true`
- Shared factory handles assignment logic automatically
- Filter conversations by provider organization
- Track assignment status (unassigned, assigned to me, assigned to others)
- Implement assignment logic on first reply (handled by factory)
- Prevent replies to conversations assigned to others (handled by factory)

**Files to Create/Modify**:

1. **`apps/wc-provider/src/stores/messaging-store.ts`** (~40 lines)
   - Configuration only (uses `createMessagingStore` factory)
   - Sets `isProviderApp: true, enableAssignment: true`
   - All assignment logic is in the shared factory

2. **`apps/wc-provider/src/app/messages/page.tsx`** (~500 lines)
   - Provider messaging UI
   - Conversation list with assignment indicators
   - Tabs: All Conversations, Unassigned, My Conversations
   - Assignment status badges
   - Reassignment UI

3. **`apps/wc-provider/src/components/messages/ConversationAssignment.tsx`** (~150 lines)
   - Assignment status display
   - Reassignment modal
   - Assignment history

4. **`apps/wc-provider/src/components/messages/AssignmentBadge.tsx`** (~80 lines)
   - Visual indicator for assignment status
   - Color-coded badges (unassigned, assigned to me, assigned to others)

### Code Example: Provider Messaging Store Configuration

```typescript
// apps/wc-provider/src/stores/messaging-store.ts
import { createMessagingStore } from '@world-schools/wc-frontend-utils'

/**
 * Provider messaging store with assignment features enabled
 *
 * The shared factory (createMessagingStore) handles:
 * - Auto-assignment on first reply
 * - Assignment validation (canReplyToConversation)
 * - Assignment state management
 * - All standard messaging features
 */
export const { useMessagingStore } = createMessagingStore({
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
  storageKeyPrefix: 'wc_provider',
  isProviderApp: true,
  enableAssignment: true,
})

/**
 * Usage in provider components:
 *
 * // Check if current user can reply
 * const canReply = useMessagingStore((state) =>
 *   state.canReplyToConversation?.(conversationId)
 * )
 *
 * // Send message (auto-assigns if unassigned)
 * if (canReply) {
 *   await useMessagingStore.getState().sendMessage(dto)
 * }
 *
 * // Manually assign/reassign conversation
 * await useMessagingStore.getState().assignConversation?.(conversationId, userId)
 */
```

### Code Example: Provider Messages Page with Assignment UI

```typescript
// apps/wc-provider/src/app/messages/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useMessagingStore } from '@/stores/messaging-store'
import { useAuthStore } from '@/stores/auth-store'
import { AssignmentBadge } from '@/components/messages/AssignmentBadge'
import { ConversationAssignment } from '@/components/messages/ConversationAssignment'

type ConversationFilter = 'all' | 'unassigned' | 'mine'

export default function ProviderMessagesPage() {
  const { user, token } = useAuthStore()
  const {
    conversations,
    activeConversationId,
    messages,
    fetchConversations,
    setActiveConversation,
    sendMessage,
    connectSocket,
    canReplyToConversation,
    assignConversation,
  } = useMessagingStore()

  const [filter, setFilter] = useState<ConversationFilter>('all')
  const [messageInput, setMessageInput] = useState('')

  // Connect to WebSocket on mount
  useEffect(() => {
    if (token) {
      connectSocket(token)
    }
  }, [token, connectSocket])

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Filter conversations based on selected filter
  const filteredConversations = useMemo(() => {
    if (filter === 'unassigned') {
      return conversations.filter((c) => !c.assignedToUserId)
    }
    if (filter === 'mine') {
      return conversations.filter((c) => c.assignedToUserId === user?.id)
    }
    return conversations
  }, [conversations, filter, user?.id])

  // Get active conversation
  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  )

  // Check if current user can reply to active conversation
  const canReply = activeConversationId
    ? canReplyToConversation?.(activeConversationId) ?? false
    : false

  // Handle send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeConversationId || !user) return

    if (!canReply) {
      alert('This conversation is assigned to another user')
      return
    }

    const idempotencyKey = `${user.id}-${Date.now()}-${Math.random()}`

    // sendMessage will auto-assign if unassigned (handled by factory)
    await sendMessage({
      conversationId: activeConversationId,
      senderId: user.id,
      senderType: 'PROVIDER',
      content: messageInput.trim(),
      idempotencyKey,
    })

    setMessageInput('')
  }

  // Handle manual assignment
  const handleAssignConversation = async (userId: string) => {
    if (!activeConversationId) return
    await assignConversation?.(activeConversationId, userId)
  }

  return (
    <div className="flex h-screen">
      {/* Conversations List */}
      <div className="w-1/3 border-r flex flex-col">
        {/* Filter Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 p-3 ${
              filter === 'all' ? 'bg-blue-50 border-b-2 border-blue-500' : ''
            }`}
          >
            All ({conversations.length})
          </button>
          <button
            onClick={() => setFilter('unassigned')}
            className={`flex-1 p-3 ${
              filter === 'unassigned' ? 'bg-blue-50 border-b-2 border-blue-500' : ''
            }`}
          >
            Unassigned ({conversations.filter((c) => !c.assignedToUserId).length})
          </button>
          <button
            onClick={() => setFilter('mine')}
            className={`flex-1 p-3 ${
              filter === 'mine' ? 'bg-blue-50 border-b-2 border-blue-500' : ''
            }`}
          >
            Mine ({conversations.filter((c) => c.assignedToUserId === user?.id).length})
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setActiveConversation(conversation.id)}
              className={`p-4 cursor-pointer border-b ${
                activeConversationId === conversation.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <h3 className="font-medium">{conversation.subject || 'Conversation'}</h3>
                <AssignmentBadge
                  assignedToUserId={conversation.assignedToUserId}
                  currentUserId={user?.id}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {conversation.lastMessage?.content}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with Assignment Info */}
        {activeConversation && (
          <div className="border-b p-4 bg-gray-50">
            <ConversationAssignment
              conversation={activeConversation}
              currentUserId={user?.id}
              onAssign={handleAssignConversation}
            />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ... messages display ... */}
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          {canReply ? (
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="w-full p-2 border rounded"
            />
          ) : (
            <div className="text-center text-gray-500 p-4">
              This conversation is assigned to another user. You cannot reply.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

### Success Criteria
- [ ] Provider messaging UI created
- [ ] Shared visibility works (all provider users see conversations)
- [ ] Assignment on first reply works
- [ ] Exclusive reply rights enforced
- [ ] Assignment status displayed in UI
- [ ] Reassignment functionality works
- [ ] Filters work (all, unassigned, my conversations)
- [ ] Cannot reply to conversations assigned to others

---

## Phase 7: Real-time Features Integration

**Duration**: 3-4 days
**Dependencies**: Phase 5, 6
**Priority**: 🟡 High Priority

### Objectives
- Integrate all real-time features into UI
- Implement typing indicators with auto-stop
- Add presence tracking UI
- Implement delivery/read receipts UI
- Add notification system
- Implement sound/visual alerts

### Deliverables

#### 7.1 Real-time UI Components

**Files to Create**:

1. **`apps/wc-booking/src/components/messages/TypingIndicator.tsx`** (~80 lines)
   - Animated typing indicator
   - Display user names who are typing
   - Auto-hide when typing stops

2. **`apps/wc-booking/src/components/messages/PresenceIndicator.tsx`** (~60 lines)
   - Online/offline/away status dot
   - Last seen timestamp
   - Color-coded status

3. **`apps/wc-booking/src/components/messages/MessageStatus.tsx`** (~100 lines)
   - Message delivery status icons
   - Read receipts with user avatars
   - Timestamp display

4. **`apps/wc-booking/src/components/messages/NotificationBadge.tsx`** (~50 lines)
   - Unread message count
   - Visual badge on conversation list
   - Clear on read

5. **`apps/wc-booking/src/hooks/useNotifications.ts`** (~150 lines)
   - Browser notification permission
   - Show notification on new message
   - Play sound on new message
   - Handle notification click

### Code Example: Typing Indicator with Auto-stop

```typescript
// apps/wc-booking/src/hooks/useTypingIndicator.ts
import { useEffect, useRef } from 'react'
import { useMessagingStore } from '@/stores/messaging-store'

export function useTypingIndicator(conversationId: string) {
  const { startTyping, stopTyping } = useMessagingStore()
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleTyping = () => {
    // Start typing indicator
    startTyping(conversationId)

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Auto-stop after 5 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(conversationId)
    }, 5000)
  }

  const handleStopTyping = () => {
    stopTyping(conversationId)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      stopTyping(conversationId)
    }
  }, [conversationId, stopTyping])

  return { handleTyping, handleStopTyping }
}
```

### Success Criteria
- [ ] Typing indicators work with auto-stop
- [ ] Presence status displayed correctly
- [ ] Delivery/read receipts shown
- [ ] Browser notifications work
- [ ] Sound alerts implemented
- [ ] Unread count badges work

---

## Phase 8: Testing & Deployment

**Duration**: 4-5 days
**Dependencies**: All previous phases
**Priority**: 🟡 High Priority

### Objectives
- Write integration tests
- Write E2E tests
- Perform load testing
- Create deployment checklist
- Document deployment process

### Deliverables

#### 8.1 Integration Tests

**Files to Create**:

1. **`apps/wc-booking/src/__tests__/messaging/messaging-store.test.ts`** (~300 lines)
   - Test conversation fetching
   - Test message sending
   - Test optimistic updates
   - Test WebSocket integration
   - Test offline queue

2. **`apps/wc-provider/src/__tests__/messaging/assignment.test.ts`** (~250 lines)
   - Test conversation assignment
   - Test assignment validation
   - Test reassignment
   - Test exclusive reply rights

#### 8.2 E2E Tests

**Files to Create**:

1. **`apps/wc-booking-e2e/src/messaging/send-message.spec.ts`** (~150 lines)
   - Test sending message
   - Test receiving message
   - Test typing indicators
   - Test read receipts

2. **`apps/wc-provider-e2e/src/messaging/assignment.spec.ts`** (~200 lines)
   - Test conversation assignment flow
   - Test multiple provider users
   - Test assignment conflicts

#### 8.3 Deployment Checklist

**File to Create**:

1. **`ai-docs/messages/FRONTEND_DEPLOYMENT_CHECKLIST.md`** (~200 lines)
   - Environment variables setup
   - WebSocket URL configuration
   - CORS configuration
   - Build and deployment steps
   - Monitoring setup
   - Rollback plan

### Success Criteria
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Load testing completed
- [ ] Deployment checklist created
- [ ] Documentation complete
- [ ] Ready for production deployment

---

## Provider Conversation Assignment Logic (Detailed)

This section provides detailed implementation guidance for the provider-specific conversation assignment feature.

### Business Rules

1. **Shared Visibility**
   - All users within a provider organization can see ALL conversations initiated with that provider
   - Conversations are visible regardless of assignment status
   - This enables team collaboration and visibility

2. **Assignment on First Reply**
   - When a user initiates a conversation with a provider, the conversation starts **unassigned**
   - When ANY provider user sends the **first reply**, the conversation is **automatically assigned** to that user
   - Assignment is permanent unless manually reassigned

3. **Exclusive Reply Rights**
   - After assignment, **ONLY** the assigned provider user can send messages in that conversation
   - Other provider users can view the conversation but cannot reply
   - UI should clearly indicate who can reply

4. **Reassignment**
   - Authorized users (e.g., managers) can reassign conversations to different provider users
   - Reassignment updates `assignedToUserId`, `assignedAt`, and `assignedBy` fields
   - Reassignment history is tracked in audit logs

### Database Schema (Already Implemented)

The backend Prisma schema already includes the necessary fields in the `Conversation` model:

```prisma
model Conversation {
  id                String   @id @default(uuid())
  // ... other fields

  // Assignment fields
  assignedToUserId  String?
  assignedAt        DateTime?
  assignedBy        String?

  // Relations
  assignedToUser    User?    @relation("AssignedConversations", fields: [assignedToUserId], references: [id])
}
```

### Backend API Endpoints (Already Implemented)

The backend already provides the necessary endpoints:

1. **GET `/messaging/conversations`** with `providerId` filter
   - Returns all conversations for a provider organization
   - Includes assignment information

2. **POST `/messaging/conversations/:id/assign`**
   - Assigns conversation to a specific user
   - Request body: `{ assignedToUserId: string }`

3. **POST `/messaging/messages`** with assignment logic
   - Backend should auto-assign on first provider reply
   - Backend should validate that sender is assigned user (if already assigned)

### Frontend Implementation

#### 1. Fetching Provider Conversations

```typescript
// Fetch all conversations for provider organization
const fetchProviderConversations = async (providerId: string) => {
  const response = await conversationsApi.getConversations({
    providerId, // Backend filters by provider organization
    limit: 100,
  })

  return response.data // All conversations visible to this provider
}
```

#### 2. Filtering Conversations by Assignment Status

```typescript
// Filter conversations by assignment status
const getUnassignedConversations = (conversations: ConversationResponseDto[]) => {
  return conversations.filter(c => !c.assignedToUserId)
}

const getMyConversations = (
  conversations: ConversationResponseDto[],
  currentUserId: string
) => {
  return conversations.filter(c => c.assignedToUserId === currentUserId)
}

const getOthersConversations = (
  conversations: ConversationResponseDto[],
  currentUserId: string
) => {
  return conversations.filter(
    c => c.assignedToUserId && c.assignedToUserId !== currentUserId
  )
}
```

#### 3. Validating Reply Permission

```typescript
// Check if current user can reply to conversation
const canReplyToConversation = (
  conversation: ConversationResponseDto,
  currentUserId: string
): boolean => {
  // If unassigned, anyone can reply (and will be assigned)
  if (!conversation.assignedToUserId) {
    return true
  }

  // If assigned, only assigned user can reply
  return conversation.assignedToUserId === currentUserId
}
```

#### 4. Sending Message with Auto-Assignment

```typescript
// Send message with automatic assignment
const sendMessageWithAssignment = async (
  dto: SendMessageDto,
  conversation: ConversationResponseDto,
  currentUserId: string
) => {
  // Validate permission
  if (!canReplyToConversation(conversation, currentUserId)) {
    throw new Error('Cannot reply to conversation assigned to another user')
  }

  // If unassigned, assign to current user first
  if (!conversation.assignedToUserId) {
    await conversationsApi.assignConversation(conversation.id, {
      assignedToUserId: currentUserId,
    })
  }

  // Send message
  await messagesApi.sendMessage(dto)
}
```

#### 5. UI States

**Conversation List Item**:
```typescript
// Display assignment status in conversation list
const ConversationListItem = ({ conversation, currentUserId }) => {
  const getAssignmentBadge = () => {
    if (!conversation.assignedToUserId) {
      return <Badge color="yellow">Unassigned</Badge>
    }

    if (conversation.assignedToUserId === currentUserId) {
      return <Badge color="green">Assigned to Me</Badge>
    }

    return (
      <Badge color="gray">
        Assigned to {conversation.assignedToUser?.name}
      </Badge>
    )
  }

  return (
    <div className="conversation-item">
      <h3>{conversation.subject}</h3>
      {getAssignmentBadge()}
    </div>
  )
}
```

**Message Input**:
```typescript
// Disable input if cannot reply
const MessageInput = ({ conversation, currentUserId }) => {
  const canReply = canReplyToConversation(conversation, currentUserId)

  if (!canReply) {
    return (
      <div className="text-gray-500 p-4 text-center">
        This conversation is assigned to {conversation.assignedToUser?.name}.
        Only they can reply.
      </div>
    )
  }

  return <input type="text" placeholder="Type a message..." />
}
```

### Preventing Simultaneous Replies (Race Condition)

**Problem**: Two provider users might try to reply to an unassigned conversation simultaneously.

**Solution**: Backend should handle this with database-level locking or optimistic concurrency control.

**Frontend Handling**:
```typescript
// Handle assignment conflict error
const sendMessageWithAssignment = async (dto: SendMessageDto) => {
  try {
    await messagesApi.sendMessage(dto)
  } catch (error) {
    if (error.response?.status === 409) {
      // Conflict: conversation was assigned to someone else
      // Refresh conversation data
      await fetchConversations()

      // Show error message
      toast.error(
        'This conversation was just assigned to another user. Please refresh.'
      )
    } else {
      throw error
    }
  }
}
```

### Success Criteria
- [ ] All provider users see all conversations for their organization
- [ ] Unassigned conversations clearly marked
- [ ] First reply auto-assigns conversation
- [ ] Only assigned user can reply after assignment
- [ ] UI prevents replies to conversations assigned to others
- [ ] Reassignment works correctly
- [ ] Race conditions handled gracefully

---

## Technical Considerations

### Performance Optimization

#### 1. Message Pagination
```typescript
// Implement infinite scroll for messages
const fetchMoreMessages = async (conversationId: string, cursor: string) => {
  const response = await messagesApi.getMessages({
    conversationId,
    cursor, // Cursor-based pagination
    limit: 50,
  })

  // Append to existing messages
  set((state) => {
    state.messages[conversationId] = [
      ...state.messages[conversationId],
      ...response.data,
    ]
  })
}
```

#### 2. Conversation List Virtualization
```typescript
// Use react-window for large conversation lists
import { FixedSizeList } from 'react-window'

const ConversationList = ({ conversations }) => {
  return (
    <FixedSizeList
      height={600}
      itemCount={conversations.length}
      itemSize={80}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <ConversationListItem conversation={conversations[index]} />
        </div>
      )}
    </FixedSizeList>
  )
}
```

#### 3. Debounced Typing Indicators
```typescript
// Debounce typing indicator to reduce WebSocket traffic
import { debounce } from 'lodash'

const debouncedStartTyping = debounce((conversationId: string) => {
  socket.startTyping({ conversationId })
}, 500)
```

### Error Handling Strategies

#### 1. Network Error Recovery
```typescript
// Retry failed API calls with exponential backoff
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error

      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
    }
  }

  throw new Error('Max retries exceeded')
}
```

#### 2. WebSocket Reconnection
```typescript
// Automatic reconnection with state recovery
const handleReconnect = async () => {
  // Reconnect to WebSocket
  await connectSocket(token)

  // Rejoin active conversation
  if (activeConversationId) {
    joinConversation(activeConversationId)
  }

  // Fetch latest messages to catch up
  await fetchMessages(activeConversationId)
}
```

#### 3. Optimistic Update Rollback
```typescript
// Rollback optimistic updates on failure
const sendMessageWithRollback = async (dto: SendMessageDto) => {
  const optimisticMessage = createOptimisticMessage(dto)

  // Add optimistic message
  addMessage(optimisticMessage)

  try {
    const sentMessage = await messagesApi.sendMessage(dto)

    // Replace with real message
    updateMessage(optimisticMessage.id, sentMessage)
  } catch (error) {
    // Rollback: remove optimistic message
    deleteMessage(optimisticMessage.id)

    // Show error
    toast.error('Failed to send message')
  }
}
```

### Offline Support Implementation

#### 1. Offline Queue
```typescript
// Queue messages when offline
const queueOfflineMessage = (dto: SendMessageDto) => {
  set((state) => {
    state.offlineQueue.push({
      ...dto,
      queuedAt: new Date(),
    })
  })

  // Save to localStorage
  localStorage.setItem('offlineQueue', JSON.stringify(get().offlineQueue))
}

// Process queue when back online
const processOfflineQueue = async () => {
  const queue = get().offlineQueue

  for (const message of queue) {
    try {
      await messagesApi.sendMessage(message)

      // Remove from queue
      set((state) => {
        state.offlineQueue = state.offlineQueue.filter(
          m => m.idempotencyKey !== message.idempotencyKey
        )
      })
    } catch (error) {
      console.error('Failed to send queued message:', error)
    }
  }
}
```

#### 2. Online/Offline Detection
```typescript
// Listen for online/offline events
useEffect(() => {
  const handleOnline = () => {
    setIsOnline(true)
    processOfflineQueue()
    connectSocket(token)
  }

  const handleOffline = () => {
    setIsOnline(false)
    disconnectSocket()
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}, [])
```

### Security Considerations

#### 1. XSS Prevention
```typescript
// Sanitize message content before rendering
import DOMPurify from 'dompurify'

const MessageContent = ({ content }: { content: string }) => {
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  })

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}
```

#### 2. Token Refresh
```typescript
// Refresh JWT token before expiration
const refreshTokenBeforeExpiry = async () => {
  const token = getToken()
  const decoded = jwtDecode(token)
  const expiresIn = decoded.exp * 1000 - Date.now()

  // Refresh 5 minutes before expiry
  if (expiresIn < 5 * 60 * 1000) {
    const newToken = await authApi.refreshToken()
    setToken(newToken)

    // Reconnect WebSocket with new token
    disconnectSocket()
    await connectSocket(newToken)
  }
}
```

#### 3. Rate Limiting (Client-side)
```typescript
// Prevent spam by rate limiting on client
const rateLimitedSendMessage = (() => {
  const messageTimestamps: number[] = []
  const maxMessages = 10
  const timeWindow = 60 * 1000 // 1 minute

  return async (dto: SendMessageDto) => {
    const now = Date.now()

    // Remove old timestamps
    const recentTimestamps = messageTimestamps.filter(
      t => now - t < timeWindow
    )

    if (recentTimestamps.length >= maxMessages) {
      throw new Error('Rate limit exceeded. Please slow down.')
    }

    messageTimestamps.push(now)

    return await messagesApi.sendMessage(dto)
  }
})()
```

---

## Migration Strategy

### Phase 1: Preparation (Day 1)

1. **Backup Existing Code**
   ```bash
   git checkout -b feature/messaging-integration
   git commit -m "Backup: Before messaging integration"
   ```

2. **Install Dependencies**
   ```bash
   # Install Socket.io client (only new dependency needed)
   npm install socket.io-client

   # Note: zustand, immer already installed in wc-frontend-utils
   # Note: dompurify for XSS prevention (optional, install if needed)
   npm install dompurify
   npm install -D @types/dompurify
   ```

3. **Enhance wc-frontend-utils Package**
   ```bash
   # No new packages needed!
   # All messaging utilities will be added to existing wc-frontend-utils package

   # Create messaging directory structure in wc-frontend-utils
   mkdir -p packages/wc-frontend-utils/src/lib/messaging/{types,api,websocket,hooks,stores}
   ```

### Phase 2: Incremental Migration (Days 2-5)

1. **Day 2: Types & DTOs in wc-frontend-utils**
   - Create all TypeScript types in `packages/wc-frontend-utils/src/lib/messaging/types/`
   - Create all DTOs matching backend
   - Export from `packages/wc-frontend-utils/src/index.ts`
   - Test type imports in wc-booking

2. **Day 3: API Client in wc-frontend-utils**
   - Implement API client in `packages/wc-frontend-utils/src/lib/messaging/api/`
   - Test API calls with Postman/Insomnia
   - Verify error handling
   - Export from main index

3. **Day 4: WebSocket Service in wc-frontend-utils**
   - Implement WebSocket service in `packages/wc-frontend-utils/src/lib/messaging/websocket/`
   - Test connection and authentication
   - Test event handlers
   - Export from main index

4. **Day 5: Messaging Store Factory in wc-frontend-utils**
   - Create `createMessagingStore` factory in `packages/wc-frontend-utils/src/lib/messaging/stores/`
   - Implement conditional provider logic (assignment features)
   - Test state management
   - Test WebSocket integration
   - Export from main index

### Phase 3: UI Integration (Days 6-10)

1. **Day 6-7: wc-booking Integration**
   - Create store configuration (~30 lines) using `createMessagingStore`
   - Replace mock data with real API
   - Integrate WebSocket
   - Test real-time features

2. **Day 8-10: wc-provider Implementation**
   - Create store configuration (~40 lines) with `isProviderApp: true, enableAssignment: true`
   - Create provider messaging UI with assignment features
   - Test assignment workflow (auto-assign on first reply)
   - Test exclusive reply rights enforcement

### Phase 4: Testing & Deployment (Days 11-15)

1. **Day 11-12: Integration Testing**
   - Write integration tests
   - Test all user flows
   - Fix bugs

2. **Day 13-14: E2E Testing**
   - Write E2E tests
   - Test cross-app communication
   - Load testing

3. **Day 15: Deployment**
   - Deploy to staging
   - Smoke testing
   - Deploy to production

### Rollback Plan

If critical issues are discovered:

1. **Immediate Rollback**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Feature Flag Rollback**
   ```typescript
   // Use feature flag to disable messaging
   const MESSAGING_ENABLED = process.env.NEXT_PUBLIC_MESSAGING_ENABLED === 'true'

   if (!MESSAGING_ENABLED) {
     return <LegacyMessagingUI />
   }
   ```

3. **Database Rollback**
   - Backend database schema is already deployed
   - No database rollback needed for frontend changes

### Success Metrics

Track these metrics post-deployment:

1. **Performance**
   - Message delivery latency < 100ms
   - WebSocket connection success rate > 99%
   - API response time < 200ms

2. **User Engagement**
   - Number of messages sent per day
   - Number of active conversations
   - Average response time

3. **Error Rates**
   - Failed message send rate < 1%
   - WebSocket disconnection rate < 5%
   - API error rate < 2%

---

## Conclusion

This comprehensive frontend implementation plan provides a structured approach to integrating the real-time messaging system with the wc-booking and wc-provider applications. The plan is broken down into 8 incremental phases, each with clear objectives, deliverables, and success criteria.

### Key Highlights

- **Shared Utilities Architecture**: All messaging utilities centralized in `@world-schools/wc-frontend-utils` package
- **Factory Pattern**: `createMessagingStore` factory following existing `createAuthStore` pattern for consistency
- **Code Efficiency**: 50% code reduction (~1,750 lines saved) by using factory instead of duplicating stores
- **Maintenance Benefits**: 67% less maintenance effort - changes in one place instead of three
- **Single Import Source**: All apps import from `@world-schools/wc-frontend-utils` for guaranteed consistency
- **Incremental Approach**: Each phase delivers working functionality
- **Provider Assignment Logic**: Detailed implementation for shared visibility and exclusive reply rights (handled by factory)
- **Real-time Features**: Full integration of typing indicators, presence tracking, and receipts
- **Offline Support**: Message queuing and retry logic
- **Security**: XSS prevention, token refresh, rate limiting
- **Testing**: Comprehensive integration and E2E tests
- **Migration Strategy**: Step-by-step migration with rollback plan

### Architecture Benefits

By using the `wc-frontend-utils` package with factory pattern:

1. **Consistency**: Follows existing `createAuthStore` pattern
2. **DRY Principle**: No code duplication across apps
3. **Type Safety**: Shared types guarantee consistency
4. **Maintainability**: Single source of truth for all messaging logic
5. **Scalability**: Easy to add new apps (just configure the factory)
6. **Testing**: Test factory once instead of testing each app's store

### Next Steps

1. Review this plan with the team
2. Confirm technical approach and timelines
3. Begin Phase 1: Add TypeScript Types & DTOs to `wc-frontend-utils`
4. Follow incremental implementation approach
5. Test thoroughly after each phase
6. Ensure all apps use the factory pattern consistently

**Estimated Total Time**: 32-48 days (4-6 weeks)
**MVP Timeline**: 16-22 days (2-3 weeks) - Phases 1-5

**Key Deliverables**:
- ~700 lines of shared factory code in `wc-frontend-utils`
- ~30-40 lines of configuration per app (3 apps)
- Total: ~820 lines vs. ~2,650 lines with separate stores (69% reduction)

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Author**: AI Assistant
**Status**: Ready for Review

