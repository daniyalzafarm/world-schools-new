/**
 * WebSocket Event Type Contracts
 *
 * Single source of truth for all Socket.io event payloads exchanged between
 * the wc-nest-api backend and wc-* frontend applications.
 *
 * Server → Client events are what the backend emits and the frontend listens to.
 * Client → Server events are what the frontend emits and the backend handles.
 *
 * Using these types in both the NestJS gateway handlers and the frontend
 * WebSocket adapter gives compile-time safety against payload drift.
 */

// ---------------------------------------------------------------------------
// Shared enums (no DB enum — extensible without Prisma migrations)
// ---------------------------------------------------------------------------

export enum NotificationType {
  BookingAccepted = 'booking_accepted',
  BookingDeclined = 'booking_declined',
  BookingExpired = 'booking_expired',
  BookingRequestReceived = 'booking_request_received',
  MessageNew = 'message_new',
  SupportTicketUpdated = 'support_ticket_updated',
  SystemAlert = 'system_alert',
}

export enum NotificationEntityType {
  BookingGroup = 'booking_group',
  Conversation = 'conversation',
  Message = 'message',
  SupportTicket = 'support_ticket',
}

export type WsPresenceStatus = 'online' | 'away' | 'offline'

// ---------------------------------------------------------------------------
// Server → Client payloads
// ---------------------------------------------------------------------------

export interface WsNewMessagePayload {
  message: WsMessageData
}

export interface WsMessageCreatedPayload {
  message: WsMessageData
  /** Client-generated temp ID used for optimistic update correlation */
  tempId: string
}

export interface WsMessageErrorPayload {
  tempId: string
  error: string
}

export interface WsMessageUpdatedPayload {
  conversationId: string
  messageId: string
  content: string
  editedAt: string
}

export interface WsMessageDeletedPayload {
  conversationId: string
  messageId: string
}

export interface WsTypingPayload {
  conversationId: string
  userId: string
}

export interface WsPresencePayload {
  userId: string
  status: WsPresenceStatus
  lastSeenAt: string
}

export interface WsReadReceiptPayload {
  messageId: string
  userId: string
  conversationId: string
  readAt?: string
  senderId?: string
}

export interface WsDeliveredReceiptPayload {
  messageId: string
  userId: string
  conversationId: string
  deliveredAt?: string
  senderId?: string
  deliveryLatencyMs?: number
}

export interface WsReactionPayload {
  conversationId: string
  messageId: string
  userId: string
  emoji: string
}

export interface WsConversationNewPayload {
  conversation: WsConversationData
}

export interface WsConversationAssignedPayload {
  conversationId: string
  assignedToUserId: string | null
  assignedByUserId: string
}

export interface WsBookingStatusPayload {
  bookingGroupId: string
  bookingGroupNumber: string
  newStatus: string
  previousStatus: string
  parentUserId: string
  providerId: string
  campName: string
  respondedAt?: string
}

export interface WsBookingRequestReceivedPayload {
  bookingGroupId: string
  bookingGroupNumber: string
  parentUserId: string
  providerId: string
  campName: string
  requestExpiresAt: string
}

export interface WsNotificationPayload {
  id: string
  type: string
  title: string
  body?: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

export interface WsTicketStatusUpdatedPayload {
  ticketId: string
  status: string
  resolvedAt?: string | null
  closedAt?: string | null
  updatedAt: string
  changedByUserId: string
  requesterUserId?: string | null
  assignedToUserId?: string | null
}

export interface WsTicketAssignedPayload {
  ticketId: string
  assignedToUserId: string | null
  assignedByUserId: string
  assignedAt?: string | null
  requesterUserId?: string | null
  fromAssigneeUserId?: string | null
}

export interface WsOnboardingStatusChangedPayload {
  providerId: string
  newStatus: string
  previousStatus: string
  rejectionReason?: string | null
  rejectionCategory?: string | null
}

export interface WsHeartbeatPingPayload {
  serverTime: number
}

// ---------------------------------------------------------------------------
// Client → Server payloads
// ---------------------------------------------------------------------------

export interface WsSendMessagePayload {
  conversationId: string
  content: string
  tempId: string
  attachmentIds?: string[]
}

export interface WsJoinConversationPayload {
  conversationId: string
}

export interface WsLeaveConversationPayload {
  conversationId: string
}

export interface WsTypingStartPayload {
  conversationId: string
}

export interface WsTypingStopPayload {
  conversationId: string
}

export interface WsPresenceUpdatePayload {
  status: WsPresenceStatus
}

export interface WsMessageReadPayload {
  messageId: string
  conversationId: string
}

export interface WsMessageDeliveredPayload {
  messageId: string
  conversationId: string
  deliveryLatencyMs?: number
}

// Auth lifecycle payloads
export interface WsAuthTokenExpiringPayload {
  /** Milliseconds until token expiry */
  expiresInMs: number
}

export interface WsAuthTokenPayload {
  /** The refreshed access token */
  token: string
}

// ---------------------------------------------------------------------------
// Event name constants (single source of truth — use instead of raw strings)
// ---------------------------------------------------------------------------

/** Socket.io events emitted by the server and received by the client */
export const WsServerEvent = {
  // Messaging
  MessageNew: 'message:new',
  MessageCreated: 'message:created',
  MessageError: 'message:error',
  MessageUpdated: 'message:updated',
  MessageDeleted: 'message:deleted',
  TypingStart: 'typing:start',
  TypingStop: 'typing:stop',
  PresenceUpdate: 'presence:update',
  ReceiptRead: 'receipt:read',
  ReceiptDelivered: 'receipt:delivered',
  ReactionAdded: 'reaction:added',
  ReactionRemoved: 'reaction:removed',
  ConversationNew: 'conversation:new',
  ConversationAssigned: 'conversation:assigned',
  // Booking
  BookingStatusChanged: 'booking:status_changed',
  BookingRequestReceived: 'booking:request_received',
  // Notifications
  NotificationNew: 'notification:new',
  // Support tickets
  TicketStatusUpdated: 'ticket:statusUpdated',
  TicketAssigned: 'ticket:assigned',
  // System
  HeartbeatPing: 'heartbeat:ping',
  // Auth lifecycle
  /** Token is expiring within 4 minutes — client should refresh and send AuthToken */
  AuthTokenExpiring: 'auth:token_expiring',
  /** Token has expired and the session has been terminated */
  AuthExpired: 'auth:expired',
  /** Server confirms the new token is valid */
  AuthTokenRefreshed: 'auth:token_refreshed',
  // Onboarding
  OnboardingStatusChanged: 'onboarding:status_changed',
} as const

/** Socket.io events emitted by the client and received by the server */
export const WsClientEvent = {
  SendMessage: 'send_message',
  JoinConversation: 'join_conversation',
  LeaveConversation: 'leave_conversation',
  TypingStart: 'typing:start',
  TypingStop: 'typing:stop',
  PresenceUpdate: 'presence:update',
  MessageRead: 'message:read',
  MessageDelivered: 'message:delivered',
  HeartbeatPong: 'heartbeat:pong',
  /** Client sends a refreshed access token to keep the session alive */
  AuthToken: 'auth:token',
} as const

// ---------------------------------------------------------------------------
// Typed event maps (for use with socket.io TypeScript generics)
// ---------------------------------------------------------------------------

/** Events the server emits and the client listens to */
export interface WsServerToClientEvents {
  'message:new': (data: WsNewMessagePayload) => void
  'message:created': (data: WsMessageCreatedPayload) => void
  'message:error': (data: WsMessageErrorPayload) => void
  'message:updated': (data: WsMessageUpdatedPayload) => void
  'message:deleted': (data: WsMessageDeletedPayload) => void
  'typing:start': (data: WsTypingPayload) => void
  'typing:stop': (data: WsTypingPayload) => void
  'presence:update': (data: WsPresencePayload) => void
  'receipt:read': (data: WsReadReceiptPayload) => void
  'receipt:delivered': (data: WsDeliveredReceiptPayload) => void
  'reaction:added': (data: WsReactionPayload) => void
  'reaction:removed': (data: WsReactionPayload) => void
  'conversation:new': (data: WsConversationNewPayload) => void
  'conversation:assigned': (data: WsConversationAssignedPayload) => void
  'booking:status_changed': (data: WsBookingStatusPayload) => void
  'booking:request_received': (data: WsBookingRequestReceivedPayload) => void
  'notification:new': (data: WsNotificationPayload) => void
  'ticket:statusUpdated': (data: WsTicketStatusUpdatedPayload) => void
  'ticket:assigned': (data: WsTicketAssignedPayload) => void
  'heartbeat:ping': (data: WsHeartbeatPingPayload) => void
  'auth:token_expiring': (data: WsAuthTokenExpiringPayload) => void
  'auth:expired': (data: Record<string, never>) => void
  'auth:token_refreshed': (data: Record<string, never>) => void
  'onboarding:status_changed': (data: WsOnboardingStatusChangedPayload) => void
}

/** Events the client emits and the server handles */
export interface WsClientToServerEvents {
  send_message: (data: WsSendMessagePayload) => void
  join_conversation: (data: WsJoinConversationPayload) => void
  leave_conversation: (data: WsLeaveConversationPayload) => void
  'typing:start': (data: WsTypingStartPayload) => void
  'typing:stop': (data: WsTypingStopPayload) => void
  'presence:update': (data: WsPresenceUpdatePayload) => void
  'message:read': (data: WsMessageReadPayload) => void
  'message:delivered': (data: WsMessageDeliveredPayload) => void
  'heartbeat:pong': (data: Record<string, never>) => void
  'auth:token': (data: WsAuthTokenPayload) => void
}

// ---------------------------------------------------------------------------
// Shared data shapes (referenced by event payloads above)
// ---------------------------------------------------------------------------

export interface WsMessageData {
  id: string
  conversationId: string
  senderId: string
  senderType: string
  content: string
  status: string
  messageType: string
  contentType: string
  createdAt: string
  updatedAt: string
  tempId?: string
  attachments?: WsAttachmentData[]
}

export interface WsAttachmentData {
  id: string
  url: string
  fileName: string
  fileSize: number
  mimeType: string
}

export interface WsConversationData {
  id: string
  type: string
  status: string
  contextType?: string
  contextId?: string
  createdAt: string
  updatedAt: string
}
