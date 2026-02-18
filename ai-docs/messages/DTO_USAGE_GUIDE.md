# Messaging DTOs - Usage Guide

**Quick reference for using messaging DTOs in controllers and services**

---

## 📦 Import DTOs

```typescript
// Import from barrel file
import {
  SendMessageDto,
  GetMessagesDto,
  CreateConversationDto,
  MessageResponseDto,
  PaginatedMessagesResponseDto,
} from '@/modules/messaging/dto'
```

---

## 🔧 Controller Usage Examples

### 1. **Send Message Endpoint**

```typescript
@Post('messages')
async sendMessage(@Body() dto: SendMessageDto): Promise<MessageResponseDto> {
  return this.messagesService.sendMessage(dto)
}
```

**Request Body**:
```json
{
  "conversationId": "uuid",
  "senderId": "uuid",
  "senderType": "USER",
  "content": "Hello, world!",
  "contentType": "TEXT",
  "idempotencyKey": "unique-key-123"
}
```

---

### 2. **Get Messages with Pagination**

```typescript
@Get('conversations/:id/messages')
async getMessages(
  @Param('id') conversationId: string,
  @Query() dto: GetMessagesDto,
): Promise<PaginatedMessagesResponseDto> {
  return this.messagesService.getMessages({ ...dto, conversationId })
}
```

**Query Parameters**:
```
GET /conversations/uuid/messages?limit=50&cursor=uuid&direction=before
```

---

### 3. **Create Conversation**

```typescript
@Post('conversations')
async createConversation(
  @Body() dto: CreateConversationDto,
): Promise<ConversationResponseDto> {
  return this.conversationsService.createConversation(dto)
}
```

**Request Body**:
```json
{
  "userId": "uuid",
  "participantId": "uuid",
  "participantType": "provider",
  "contextType": "BOOKING",
  "contextId": "uuid",
  "initialMessage": "I have a question about my booking",
  "subject": "Booking Question"
}
```

---

### 4. **Search Messages**

```typescript
@Get('search/messages')
async searchMessages(
  @Query() dto: SearchMessagesDto,
): Promise<SearchResultsResponseDto> {
  return this.searchService.searchMessages(dto)
}
```

**Query Parameters**:
```
GET /search/messages?userId=uuid&query=booking&conversationId=uuid&limit=20
```

---

### 5. **Add Reaction**

```typescript
@Post('messages/:id/reactions')
async addReaction(
  @Param('id') messageId: string,
  @Body() dto: Omit<AddReactionDto, 'messageId'>,
): Promise<ReactionResponseDto> {
  return this.messagesService.addReaction({ ...dto, messageId })
}
```

**Request Body**:
```json
{
  "userId": "uuid",
  "emoji": "👍"
}
```

---

## ✅ Validation Examples

### **Valid Request**
```typescript
const dto: SendMessageDto = {
  conversationId: '123e4567-e89b-12d3-a456-426614174000',
  senderId: '123e4567-e89b-12d3-a456-426614174001',
  senderType: 'USER',
  content: 'Hello!',
  contentType: 'TEXT',
  idempotencyKey: 'msg-2024-01-01-12345',
}
// ✅ Passes validation
```

### **Invalid Request - Missing Required Field**
```typescript
const dto = {
  conversationId: '123e4567-e89b-12d3-a456-426614174000',
  senderId: '123e4567-e89b-12d3-a456-426614174001',
  // Missing senderType (required)
  content: 'Hello!',
  // Missing idempotencyKey (required)
}
// ❌ Validation error: senderType should not be empty
// ❌ Validation error: idempotencyKey should not be empty
```

### **Invalid Request - Wrong Type**
```typescript
const dto = {
  conversationId: 'not-a-uuid', // ❌ Invalid UUID
  senderId: '123e4567-e89b-12d3-a456-426614174001',
  senderType: 'INVALID_TYPE', // ❌ Not in SenderType enum
  content: 'x'.repeat(20000), // ❌ Exceeds 10,000 char limit
  idempotencyKey: 'key',
}
// ❌ Validation error: conversationId must be a UUID
// ❌ Validation error: senderType must be a valid enum value
// ❌ Validation error: content must be shorter than or equal to 10000 characters
```

---

## 🎯 Common Patterns

### **Pattern 1: Pagination**
```typescript
// Offset-based pagination (conversations)
const dto: GetConversationsDto = {
  userId: 'uuid',
  filter: 'unread',
  limit: 50,
  offset: 0,
}

// Cursor-based pagination (messages)
const dto: GetMessagesDto = {
  conversationId: 'uuid',
  limit: 50,
  cursor: 'last-message-uuid',
  direction: 'before',
}
```

### **Pattern 2: Optional Fields**
```typescript
// Minimal request
const dto: SendMessageDto = {
  conversationId: 'uuid',
  senderId: 'uuid',
  senderType: 'USER',
  content: 'Hello!',
  idempotencyKey: 'key',
}

// With optional fields
const dto: SendMessageDto = {
  conversationId: 'uuid',
  senderId: 'uuid',
  senderType: 'USER',
  content: 'Hello!',
  contentType: 'TEXT',
  replyToId: 'uuid',
  priority: 'HIGH',
  scheduledFor: new Date('2024-01-01T12:00:00Z'),
  idempotencyKey: 'key',
}
```

### **Pattern 3: Enum Values**
```typescript
// Always use enum values from Prisma
import { SenderType, MessagePriority } from '@prisma/client'

const dto: SendMessageDto = {
  senderType: SenderType.USER, // ✅ Type-safe
  priority: MessagePriority.HIGH, // ✅ Type-safe
  // ...
}
```

---

## 🚨 Common Validation Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `should not be empty` | Required field missing | Add the required field |
| `must be a UUID` | Invalid UUID format | Use valid UUID v4 format |
| `must be a valid enum value` | Invalid enum value | Use values from Prisma enum |
| `must be shorter than or equal to X characters` | String too long | Reduce string length |
| `must not be less than X` | Number too small | Increase number value |
| `must not be greater than X` | Number too large | Decrease number value |
| `emoji must be a valid emoji character` | Invalid emoji | Use valid Unicode emoji |

---

## 📚 DTO Reference

### **Conversation DTOs**
- `CreateConversationDto` - Create conversation
- `GetConversationsDto` - List conversations
- `UpdateConversationSettingsDto` - Update settings
- `AssignConversationDto` - Assign conversation
- `UpdateConversationStatusDto` - Update status
- `AddLabelDto` - Add label
- `RemoveLabelDto` - Remove label

### **Message DTOs**
- `SendMessageDto` - Send message
- `GetMessagesDto` - Get messages
- `EditMessageDto` - Edit message
- `DeleteMessageDto` - Delete message
- `MarkAsReadDto` - Mark as read
- `MarkAsDeliveredDto` - Mark as delivered
- `AddReactionDto` - Add reaction
- `RemoveReactionDto` - Remove reaction
- `BookmarkMessageDto` - Bookmark message
- `PinMessageDto` - Pin message
- `ForwardMessageDto` - Forward message
- `ScheduleMessageDto` - Schedule message
- `ReportMessageDto` - Report message

### **Search DTOs**
- `SearchMessagesDto` - Search messages
- `SearchConversationsDto` - Search conversations

### **Response DTOs**
- `MessageResponseDto` - Message response
- `ConversationResponseDto` - Conversation response
- `PaginatedMessagesResponseDto` - Paginated messages
- `PaginatedConversationsResponseDto` - Paginated conversations
- `SearchResultsResponseDto` - Search results
- `SuccessResponseDto` - Success response
- `ErrorResponseDto` - Error response

---

## 🎉 Best Practices

1. **Always use barrel imports** from `@/modules/messaging/dto`
2. **Use Prisma enums** for type safety
3. **Validate at controller level** using `@Body()`, `@Query()`, `@Param()` decorators
4. **Return response DTOs** for consistent API responses
5. **Use idempotency keys** for message sending to prevent duplicates
6. **Handle validation errors** with proper error messages
7. **Document API endpoints** with Swagger decorators (future task)

---

**For more details, see**: `PHASE_2_TASK_2.4_SUMMARY.md`

