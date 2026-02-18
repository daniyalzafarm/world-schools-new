# Phase 2: API Client & Services - Implementation Plan

## Architecture Analysis Summary

### Existing Layered Architecture Pattern

After analyzing all three apps (wc-booking, wc-provider, wc-superadmin), the architecture follows a **3-layer pattern**:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Zustand Store (State Management)                  │
│ - Created via factory: createAuthStore()                   │
│ - Accepts: apiClient + authService                         │
│ - Manages: state, actions, side effects                    │
└─────────────────────────────────────────────────────────────┘
                            ↓ uses
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Service Layer (Business Logic)                    │
│ - Created via factory: createAuthService()                 │
│ - Accepts: apiClient + endpointPrefix                      │
│ - Returns: service methods (login, logout, etc.)           │
│ - Handles: API calls, data transformation                  │
└─────────────────────────────────────────────────────────────┘
                            ↓ uses
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: API Client (HTTP Communication)                   │
│ - Created via factory: createApiClient()                   │
│ - Accepts: baseURL, auth config                            │
│ - Returns: HTTP methods (get, post, put, patch, del)       │
│ - Handles: requests, auth, token refresh, interceptors     │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Findings

#### 1. **API Client Layer** (`createApiClient`)
- **Location**: `packages/wc-utils/src/lib/api-client.ts`
- **Purpose**: Low-level HTTP communication
- **Created Once Per App**: Each app creates ONE instance in `src/utils/api-client.ts`
- **Configuration**: baseURL, auth mode, storage prefix, refresh endpoint
- **Returns**: `{ get, post, put, patch, del, postFile, postFormData, setTokens, getTokens, clearTokens, hasValidTokens }`
- **Features**: Auto token refresh, request/response interceptors, error handling

#### 2. **Service Layer** (`createAuthService`)
- **Location**: `packages/wc-utils/src/lib/create-auth-service.ts`
- **Purpose**: Business logic and API endpoint abstraction
- **Created Once Per App**: Each app creates ONE instance in `src/services/auth.services.ts`
- **Configuration**: `{ apiClient, endpointPrefix }`
- **Returns**: `{ login, refreshToken, getProfile, changePassword, logout }`
- **Pattern**: Service methods use the provided `apiClient` to make HTTP calls
- **Endpoint Construction**: `${endpointPrefix}/${method}` (e.g., `user/auth/login`)

**Example from `createAuthService`**:
```typescript
export function createAuthService(config: AuthServiceConfig): AuthService {
  const { apiClient, endpointPrefix } = config

  const login = async (credentials: LoginCredentials) => {
    return await apiClient.post<{ user: User }>(
      `${endpointPrefix}/login`,
      credentials,
      undefined,
      true // Attach response headers
    )
  }

  const getProfile = async () => {
    return await apiClient.get<User>(`${endpointPrefix}/profile`)
  }

  return { login, refreshToken, getProfile, changePassword, logout }
}
```

#### 3. **Store Layer** (`createAuthStore`)
- **Location**: `packages/wc-frontend-utils/src/lib/create-auth-store.ts`
- **Purpose**: State management with Zustand
- **Created Once Per App**: Each app creates ONE instance in `src/stores/auth-store.ts`
- **Configuration**: `{ apiClient, authService, storageKeyPrefix, usingRequest }`
- **Returns**: `{ useAuthStore }` hook
- **Pattern**: Store actions call service methods and update state

**Example from `createAuthStore`**:
```typescript
export function createAuthStore(config: AuthStoreConfig) {
  const { apiClient, authService, storageKeyPrefix, usingRequest } = config

  const useAuthStore = create<AuthStore>()(
    immer((set, get) => ({
      user: null,
      isAuthenticated: false,
      
      login: async (credentials: LoginCredentials) => {
        set(draft => { draft.isLoading = true })
        
        // Use auth service for API call
        const response = await authService.login(credentials)
        
        if (response.success) {
          set(draft => {
            draft.user = response.data.user
            draft.isAuthenticated = true
          })
        }
      },
      
      logout: async () => {
        await authService.logout()
        apiClient.clearTokens()
        set(draft => {
          draft.user = null
          draft.isAuthenticated = false
        })
      }
    }))
  )

  return { useAuthStore }
}
```

### App-Level Integration Pattern

Each app follows this exact pattern:

**1. Create API Client** (`apps/wc-booking/src/utils/api-client.ts`):
```typescript
import { createApiClient } from '@world-schools/wc-utils'

const apiClient = createApiClient({
  baseURL: config.app.apiUrl,
  usingRequest: config.auth.usingRequest,
  storageKeyPrefix: 'wc_user',
  refreshEndpoint: '/user/auth/refresh',
})

export default apiClient
```

**2. Create Service** (`apps/wc-booking/src/services/auth.services.ts`):
```typescript
import { createAuthService } from '@world-schools/wc-utils'
import apiClient from '@/utils/api-client'

const authService = createAuthService({
  apiClient,
  endpointPrefix: 'user/auth',
})

export const { login, refreshToken, getProfile, changePassword, logout } = authService

// App-specific methods can be added here
export async function signup(data) {
  return apiClient.post('user/auth/register', data)
}
```

**3. Create Store** (`apps/wc-booking/src/stores/auth-store.ts`):
```typescript
import { createAuthStore } from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'
import * as authService from '@/services/auth.services'

const { useAuthStore } = createAuthStore({
  apiClient,
  authService,
  storageKeyPrefix: 'wc_user',
  usingRequest: config.auth.usingRequest,
})

export { useAuthStore }
```

---

## Backend API Endpoint Structure

### Messaging API Routes

Based on the backend controllers analysis:

**Base Path**: `/messaging`

#### Conversations Endpoints (`/messaging/conversations`)
- `POST /messaging/conversations` - Create conversation
- `GET /messaging/conversations` - Get all conversations (with filters)
- `GET /messaging/conversations/:id` - Get conversation by ID
- `PATCH /messaging/conversations/:id/settings` - Update settings (pin, star, mute, archive)
- `POST /messaging/conversations/:id/assign` - Assign conversation
- `PATCH /messaging/conversations/:id/status` - Update status
- `POST /messaging/conversations/:id/labels` - Add label
- `DELETE /messaging/conversations/:id/labels/:labelId` - Remove label
- `GET /messaging/conversations/:id/metrics` - Get metrics

#### Messages Endpoints (`/messaging/messages`)
- `POST /messaging/messages` - Send message
- `GET /messaging/messages` - Get messages (with pagination)
- `GET /messaging/messages/mentions` - Get mentioned messages
- `GET /messaging/messages/:id` - Get message by ID
- `GET /messaging/messages/:id/thread` - Get message thread
- `GET /messaging/messages/:id/edit-history` - Get edit history
- `PATCH /messaging/messages/:id` - Edit message
- `DELETE /messaging/messages/:id` - Delete message
- `POST /messaging/messages/:id/read` - Mark as read
- `POST /messaging/messages/:id/delivered` - Mark as delivered
- `POST /messaging/messages/:id/reactions` - Add reaction
- `DELETE /messaging/messages/:id/reactions` - Remove reaction
- `POST /messaging/messages/:id/bookmark` - Bookmark message
- `DELETE /messaging/messages/:id/bookmark` - Remove bookmark
- `POST /messaging/messages/:id/pin` - Pin message
- `DELETE /messaging/messages/:id/pin` - Unpin message
- `POST /messaging/messages/:id/forward` - Forward message
- `POST /messaging/messages/:id/schedule` - Schedule message
- `POST /messaging/messages/:id/report` - Report message

---

## Phase 2 Implementation Plan

### ❌ **What NOT to Do**

1. **DO NOT create a messaging API client factory** - The messaging services will use the existing `apiClient` instance
2. **DO NOT create separate HTTP client wrappers** - The `createApiClient` already provides all HTTP methods
3. **DO NOT duplicate the API client pattern** - Each app already has ONE `apiClient` instance

### ✅ **What TO Do**

Create **service layer factories** that follow the exact same pattern as `createAuthService`:

1. **Create `createConversationsService` factory** in `packages/wc-frontend-utils`
2. **Create `createMessagesService` factory** in `packages/wc-frontend-utils`
3. **Services accept `apiClient` and return service methods**
4. **Services will be used by the messaging store factory (Phase 4)**

---

## Detailed Implementation

### File Structure

```
packages/wc-frontend-utils/src/lib/messaging/
├── types/                          # ✅ Phase 1 (Complete)
│   ├── enums.ts
│   ├── models.ts
│   ├── dtos.ts
│   ├── utils.ts
│   └── index.ts
├── services/                       # 🔴 Phase 2 (New)
│   ├── create-conversations-service.ts
│   ├── create-messages-service.ts
│   └── index.ts
└── store/                          # Phase 4 (Future)
    └── create-messaging-store.ts
```

### Implementation Tasks

#### Task 2.1: Create Conversations Service Factory

**File**: `packages/wc-frontend-utils/src/lib/messaging/services/create-conversations-service.ts`

**Purpose**: Provides all conversation-related API methods

**Configuration**:
```typescript
interface ConversationsServiceConfig {
  apiClient: ApiClient
  endpointPrefix?: string // Default: 'messaging/conversations'
}
```

**Service Methods** (15 methods):
1. `createConversation(dto: CreateConversationDto)` → `POST /messaging/conversations`
2. `getConversations(dto: GetConversationsDto)` → `GET /messaging/conversations`
3. `getConversationById(id: string)` → `GET /messaging/conversations/:id`
4. `updateConversationSettings(id: string, dto: UpdateConversationSettingsDto)` → `PATCH /messaging/conversations/:id/settings`
5. `assignConversation(id: string, dto: AssignConversationDto)` → `POST /messaging/conversations/:id/assign`
6. `updateConversationStatus(id: string, dto: UpdateConversationStatusDto)` → `PATCH /messaging/conversations/:id/status`
7. `addLabel(id: string, dto: AddLabelDto)` → `POST /messaging/conversations/:id/labels`
8. `removeLabel(id: string, labelId: string)` → `DELETE /messaging/conversations/:id/labels/:labelId`
9. `getConversationMetrics(id: string)` → `GET /messaging/conversations/:id/metrics`
10. `createLabel(dto: CreateLabelDto)` → `POST /messaging/labels`
11. `getLabels()` → `GET /messaging/labels`
12. `updateLabel(id: string, dto: Partial<CreateLabelDto>)` → `PATCH /messaging/labels/:id`
13. `deleteLabel(id: string)` → `DELETE /messaging/labels/:id`
14. `archiveConversation(id: string)` → Helper method (calls updateConversationSettings)
15. `unarchiveConversation(id: string)` → Helper method (calls updateConversationSettings)

**Return Type**:
```typescript
interface ConversationsService {
  createConversation: (dto: CreateConversationDto) => Promise<ApiResult<ConversationResponseDto>>
  getConversations: (dto: GetConversationsDto) => Promise<ApiResult<PaginatedConversationsResponseDto>>
  getConversationById: (id: string) => Promise<ApiResult<ConversationResponseDto>>
  updateConversationSettings: (id: string, dto: UpdateConversationSettingsDto) => Promise<ApiResult<ConversationResponseDto>>
  assignConversation: (id: string, dto: AssignConversationDto) => Promise<ApiResult<ConversationResponseDto>>
  updateConversationStatus: (id: string, dto: UpdateConversationStatusDto) => Promise<ApiResult<ConversationResponseDto>>
  addLabel: (id: string, dto: AddLabelDto) => Promise<ApiResult<SuccessResponseDto>>
  removeLabel: (id: string, labelId: string) => Promise<ApiResult<SuccessResponseDto>>
  getConversationMetrics: (id: string) => Promise<ApiResult<ConversationMetricsResponseDto>>
  createLabel: (dto: CreateLabelDto) => Promise<ApiResult<LabelResponseDto>>
  getLabels: () => Promise<ApiResult<LabelResponseDto[]>>
  updateLabel: (id: string, dto: Partial<CreateLabelDto>) => Promise<ApiResult<LabelResponseDto>>
  deleteLabel: (id: string) => Promise<ApiResult<SuccessResponseDto>>
  archiveConversation: (id: string) => Promise<ApiResult<ConversationResponseDto>>
  unarchiveConversation: (id: string) => Promise<ApiResult<ConversationResponseDto>>
}
```

**Implementation Pattern** (matches `createAuthService`):
```typescript
export function createConversationsService(config: ConversationsServiceConfig): ConversationsService {
  const { apiClient, endpointPrefix = 'messaging/conversations' } = config

  const createConversation = async (dto: CreateConversationDto) => {
    return await apiClient.post<ConversationResponseDto>(endpointPrefix, dto)
  }

  const getConversations = async (dto: GetConversationsDto) => {
    return await apiClient.get<PaginatedConversationsResponseDto>(endpointPrefix, {
      params: dto
    })
  }

  const getConversationById = async (id: string) => {
    return await apiClient.get<ConversationResponseDto>(`${endpointPrefix}/${id}`)
  }

  // ... more methods

  return {
    createConversation,
    getConversations,
    getConversationById,
    // ... all methods
  }
}
```

---

#### Task 2.2: Create Messages Service Factory

**File**: `packages/wc-frontend-utils/src/lib/messaging/services/create-messages-service.ts`

**Purpose**: Provides all message-related API methods

**Configuration**:
```typescript
interface MessagesServiceConfig {
  apiClient: ApiClient
  endpointPrefix?: string // Default: 'messaging/messages'
}
```

**Service Methods** (20 methods):
1. `sendMessage(dto: SendMessageDto)` → `POST /messaging/messages`
2. `getMessages(dto: GetMessagesDto)` → `GET /messaging/messages`
3. `getMentionedMessages(limit?: number, cursor?: string)` → `GET /messaging/messages/mentions`
4. `getMessageById(id: string)` → `GET /messaging/messages/:id`
5. `getMessageThread(id: string)` → `GET /messaging/messages/:id/thread`
6. `getMessageEditHistory(id: string, limit?: number, cursor?: string)` → `GET /messaging/messages/:id/edit-history`
7. `editMessage(id: string, dto: EditMessageDto)` → `PATCH /messaging/messages/:id`
8. `deleteMessage(id: string, dto: DeleteMessageDto)` → `DELETE /messaging/messages/:id`
9. `markAsRead(id: string, dto: MarkAsReadDto)` → `POST /messaging/messages/:id/read`
10. `markAsDelivered(id: string, dto: MarkAsDeliveredDto)` → `POST /messaging/messages/:id/delivered`
11. `addReaction(id: string, dto: AddReactionDto)` → `POST /messaging/messages/:id/reactions`
12. `removeReaction(id: string, dto: RemoveReactionDto)` → `DELETE /messaging/messages/:id/reactions`
13. `bookmarkMessage(id: string, dto: BookmarkMessageDto)` → `POST /messaging/messages/:id/bookmark`
14. `unbookmarkMessage(id: string, dto: UnbookmarkMessageDto)` → `DELETE /messaging/messages/:id/bookmark`
15. `pinMessage(id: string, dto: PinMessageDto)` → `POST /messaging/messages/:id/pin`
16. `unpinMessage(id: string, dto: UnpinMessageDto)` → `DELETE /messaging/messages/:id/pin`
17. `forwardMessage(id: string, dto: ForwardMessageDto)` → `POST /messaging/messages/:id/forward`
18. `scheduleMessage(dto: ScheduleMessageDto)` → `POST /messaging/messages/:id/schedule`
19. `reportMessage(id: string, dto: ReportMessageDto)` → `POST /messaging/messages/:id/report`
20. `getBookmarkedMessages(limit?: number, cursor?: string)` → Helper method

**Return Type**:
```typescript
interface MessagesService {
  sendMessage: (dto: SendMessageDto) => Promise<ApiResult<MessageResponseDto>>
  getMessages: (dto: GetMessagesDto) => Promise<ApiResult<PaginatedMessagesResponseDto>>
  getMentionedMessages: (limit?: number, cursor?: string) => Promise<ApiResult<PaginatedMessagesResponseDto>>
  getMessageById: (id: string) => Promise<ApiResult<MessageResponseDto>>
  getMessageThread: (id: string) => Promise<ApiResult<MessageResponseDto[]>>
  getMessageEditHistory: (id: string, limit?: number, cursor?: string) => Promise<ApiResult<EditHistoryResponseDto[]>>
  editMessage: (id: string, dto: EditMessageDto) => Promise<ApiResult<MessageResponseDto>>
  deleteMessage: (id: string, dto: DeleteMessageDto) => Promise<ApiResult<SuccessResponseDto>>
  markAsRead: (id: string, dto: MarkAsReadDto) => Promise<ApiResult<SuccessResponseDto>>
  markAsDelivered: (id: string, dto: MarkAsDeliveredDto) => Promise<ApiResult<SuccessResponseDto>>
  addReaction: (id: string, dto: AddReactionDto) => Promise<ApiResult<ReactionResponseDto>>
  removeReaction: (id: string, dto: RemoveReactionDto) => Promise<ApiResult<SuccessResponseDto>>
  bookmarkMessage: (id: string, dto: BookmarkMessageDto) => Promise<ApiResult<BookmarkResponseDto>>
  unbookmarkMessage: (id: string, dto: UnbookmarkMessageDto) => Promise<ApiResult<SuccessResponseDto>>
  pinMessage: (id: string, dto: PinMessageDto) => Promise<ApiResult<SuccessResponseDto>>
  unpinMessage: (id: string, dto: UnpinMessageDto) => Promise<ApiResult<SuccessResponseDto>>
  forwardMessage: (id: string, dto: ForwardMessageDto) => Promise<ApiResult<MessageResponseDto>>
  scheduleMessage: (dto: ScheduleMessageDto) => Promise<ApiResult<MessageResponseDto>>
  reportMessage: (id: string, dto: ReportMessageDto) => Promise<ApiResult<SuccessResponseDto>>
  getBookmarkedMessages: (limit?: number, cursor?: string) => Promise<ApiResult<PaginatedMessagesResponseDto>>
}
```

**Implementation Pattern** (matches `createAuthService`):
```typescript
export function createMessagesService(config: MessagesServiceConfig): MessagesService {
  const { apiClient, endpointPrefix = 'messaging/messages' } = config

  const sendMessage = async (dto: SendMessageDto) => {
    return await apiClient.post<MessageResponseDto>(endpointPrefix, dto)
  }

  const getMessages = async (dto: GetMessagesDto) => {
    return await apiClient.get<PaginatedMessagesResponseDto>(endpointPrefix, {
      params: dto
    })
  }

  const editMessage = async (id: string, dto: EditMessageDto) => {
    return await apiClient.patch<MessageResponseDto>(`${endpointPrefix}/${id}`, dto)
  }

  const deleteMessage = async (id: string, dto: DeleteMessageDto) => {
    return await apiClient.del<SuccessResponseDto>(`${endpointPrefix}/${id}`, {
      data: dto
    })
  }

  const markAsRead = async (id: string, dto: MarkAsReadDto) => {
    return await apiClient.post<SuccessResponseDto>(`${endpointPrefix}/${id}/read`, dto)
  }

  // ... more methods

  return {
    sendMessage,
    getMessages,
    editMessage,
    deleteMessage,
    markAsRead,
    // ... all methods
  }
}
```

---

#### Task 2.3: Create Barrel Export

**File**: `packages/wc-frontend-utils/src/lib/messaging/services/index.ts`

```typescript
/**
 * Messaging Services Barrel Export
 *
 * Central export point for all messaging service factories.
 *
 * @example
 * ```typescript
 * import { createConversationsService, createMessagesService } from '@world-schools/wc-frontend-utils'
 * import apiClient from '@/utils/api-client'
 *
 * const conversationsService = createConversationsService({ apiClient })
 * const messagesService = createMessagesService({ apiClient })
 * ```
 */

export * from './create-conversations-service'
export * from './create-messages-service'
```

---

#### Task 2.4: Update Main Package Export

**File**: `packages/wc-frontend-utils/src/index.ts`

Add export for messaging services:
```typescript
// Messaging types (enums, models, DTOs, utilities)
export * from './lib/messaging/types'

// Messaging services (conversations, messages)
export * from './lib/messaging/services'
```

---

## How Apps Will Use the Services (Phase 4 Preview)

### App-Level Service Creation

Each app will create service instances in `src/services/messaging.services.ts`:

**Example**: `apps/wc-booking/src/services/messaging.services.ts`
```typescript
import { createConversationsService, createMessagesService } from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'

// Create conversations service instance
const conversationsService = createConversationsService({
  apiClient,
  endpointPrefix: 'messaging/conversations', // Optional, this is the default
})

// Create messages service instance
const messagesService = createMessagesService({
  apiClient,
  endpointPrefix: 'messaging/messages', // Optional, this is the default
})

// Export service methods
export const {
  createConversation,
  getConversations,
  getConversationById,
  updateConversationSettings,
  assignConversation,
  updateConversationStatus,
  addLabel,
  removeLabel,
  getConversationMetrics,
  createLabel,
  getLabels,
  updateLabel,
  deleteLabel,
  archiveConversation,
  unarchiveConversation,
} = conversationsService

export const {
  sendMessage,
  getMessages,
  getMentionedMessages,
  getMessageById,
  getMessageThread,
  getMessageEditHistory,
  editMessage,
  deleteMessage,
  markAsRead,
  markAsDelivered,
  addReaction,
  removeReaction,
  bookmarkMessage,
  unbookmarkMessage,
  pinMessage,
  unpinMessage,
  forwardMessage,
  scheduleMessage,
  reportMessage,
  getBookmarkedMessages,
} = messagesService
```

### Store Integration (Phase 4)

The messaging store factory will accept the services:

**Example**: `apps/wc-booking/src/stores/messaging-store.ts`
```typescript
import { createMessagingStore } from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'
import * as conversationsService from '@/services/messaging.services'
import * as messagesService from '@/services/messaging.services'

const { useMessagingStore } = createMessagingStore({
  apiClient,
  conversationsService,
  messagesService,
  isProviderApp: false, // Provider app will set this to true
})

export { useMessagingStore }
```

---

## Success Criteria

### Phase 2 Completion Checklist

- [ ] `create-conversations-service.ts` created with 15 service methods
- [ ] `create-messages-service.ts` created with 20 service methods
- [ ] Both services follow the exact pattern as `createAuthService`
- [ ] Both services accept `{ apiClient, endpointPrefix }` configuration
- [ ] Both services return typed service methods
- [ ] Barrel export created in `services/index.ts`
- [ ] Main package export updated in `src/index.ts`
- [ ] All TypeScript types are correct
- [ ] No TypeScript diagnostics errors
- [ ] Services can be imported from `@world-schools/wc-frontend-utils`

### Code Quality Standards

1. **TypeScript**: Full type safety with proper generics
2. **JSDoc Comments**: Every function and interface documented
3. **Error Handling**: Rely on `apiClient` error handling (already built-in)
4. **Consistency**: Match `createAuthService` pattern exactly
5. **Endpoint Construction**: Use `${endpointPrefix}/${path}` pattern
6. **Return Types**: Use `ApiResult<T>` from `@world-schools/wc-utils`

---

## Estimated Effort

- **Task 2.1**: Create Conversations Service (~2 hours)
- **Task 2.2**: Create Messages Service (~2.5 hours)
- **Task 2.3**: Create Barrel Export (~15 minutes)
- **Task 2.4**: Update Main Export (~15 minutes)
- **Testing & Verification**: (~1 hour)

**Total**: ~6 hours

---

## Next Phase Preview

**Phase 3**: WebSocket Client Integration
- Create WebSocket service factory
- Handle real-time events (new messages, typing, presence)
- Integrate with Socket.io client

**Phase 4**: Zustand Store Factory
- Create `createMessagingStore` factory
- Accept `conversationsService` and `messagesService`
- Manage state for conversations, messages, optimistic updates
- Handle WebSocket events and update state


