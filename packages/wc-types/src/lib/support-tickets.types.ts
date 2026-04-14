/**
 * Support Ticket domain types — single source of truth for all wc-* apps.
 *
 * Used by: wc-booking, wc-provider, wc-superadmin (frontend) and
 * wc-nest-api (backend response DTOs mirror these shapes).
 */

// ---------------------------------------------------------------------------
// Enums (const objects + derived union types)
// ---------------------------------------------------------------------------

export const SUPPORT_TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_REQUESTER: 'PENDING_REQUESTER',
  PENDING_SUPPORT: 'PENDING_SUPPORT',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUS)[keyof typeof SUPPORT_TICKET_STATUS]

export const SUPPORT_TICKET_PRIORITY = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const
export type SupportTicketPriority =
  (typeof SUPPORT_TICKET_PRIORITY)[keyof typeof SUPPORT_TICKET_PRIORITY]

export const SUPPORT_TICKET_SOURCE_APP = {
  WC_BOOKING: 'WC_BOOKING',
  WC_PROVIDER: 'WC_PROVIDER',
  WC_SUPERADMIN: 'WC_SUPERADMIN',
  API: 'API',
} as const
export type SupportTicketSourceApp =
  (typeof SUPPORT_TICKET_SOURCE_APP)[keyof typeof SUPPORT_TICKET_SOURCE_APP]

export const SUPPORT_TICKET_REQUESTER_TYPE = {
  PARENT: 'PARENT',
  PROVIDER: 'PROVIDER',
} as const
export type SupportTicketRequesterType =
  (typeof SUPPORT_TICKET_REQUESTER_TYPE)[keyof typeof SUPPORT_TICKET_REQUESTER_TYPE]

// ---------------------------------------------------------------------------
// Display helpers (pure data — no React dependency)
// ---------------------------------------------------------------------------

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  PENDING_REQUESTER: 'Pending your reply',
  PENDING_SUPPORT: 'Pending support',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

export const SUPPORT_TICKET_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
}

// ---------------------------------------------------------------------------
// Supporting entity interfaces
// ---------------------------------------------------------------------------

export interface SupportTicketCategory {
  id: string
  key: string
  name: string
  description?: string | null
  audience: string
}

export interface SupportTicketRequesterUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

export interface SupportTicketRequesterProvider {
  id: string
  legalCompanyName: string | null
  email: string | null
}

export interface SupportTicketAssignee {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

export interface SupportTicketLastMessageSender {
  id: string
  firstName: string | null
  lastName: string | null
}

export interface SupportTicketLastMessage {
  id: string
  content: string
  senderId: string
  senderType: string
  sentAt: string
  sender?: SupportTicketLastMessageSender | null
}

// ---------------------------------------------------------------------------
// Main ticket entity (superset — includes all admin + requester fields)
// ---------------------------------------------------------------------------

export interface SupportTicket {
  id: string
  ticketNumber: string
  subject: string
  description?: string | null
  lastMessage?: SupportTicketLastMessage | null

  requesterType: SupportTicketRequesterType
  requesterUser?: SupportTicketRequesterUser | null
  requesterProvider?: SupportTicketRequesterProvider | null

  sourceApp: SupportTicketSourceApp
  category?: SupportTicketCategory | null
  priority: SupportTicketPriority
  status: SupportTicketStatus
  tags: string[]

  conversationId: string

  assignedToUser?: SupportTicketAssignee | null
  assignedAt?: string | null

  // SLA fields
  slaPolicyId?: string | null
  firstResponseDueAt?: string | null
  firstRespondedAt?: string | null
  resolutionDueAt?: string | null
  resolvedAt?: string | null
  closedAt?: string | null
  slaFirstResponseBreachedAt?: string | null
  slaResolutionBreachedAt?: string | null

  // Resolution / closure metadata
  resolvedByUserId?: string | null
  resolutionCode?: string | null
  resolutionSummary?: string | null
  closedByUserId?: string | null
  closureReason?: string | null

  // Reopen tracking
  reopenedCount: number
  lastReopenedAt?: string | null
  lastReopenedByUserId?: string | null

  // Activity timestamps
  lastRequesterReplyAt?: string | null
  lastSupportReplyAt?: string | null

  // Linked entities (optional)
  bookingId?: string | null
  campId?: string | null
  sessionId?: string | null

  // CSAT
  satisfactionScore?: number | null
  satisfactionComment?: string | null
  satisfactionSubmittedAt?: string | null

  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedSupportTickets {
  data: SupportTicket[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface PaginatedSupportTicketsMeta {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

// ---------------------------------------------------------------------------
// Attachment (typed instead of `unknown`)
// ---------------------------------------------------------------------------

export interface SupportTicketAttachment {
  id: string
  url: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

// ---------------------------------------------------------------------------
// Conversation / messaging
// ---------------------------------------------------------------------------

/** Message shape from GET …/support-tickets/:id/conversation */
export interface SupportTicketMessageResponse {
  id: string
  conversationId: string
  senderId: string
  senderType: string
  content: string
  contentType?: string
  /** Typed attachment array (replaces the previous `unknown` type) */
  attachments?: SupportTicketAttachment[] | null
  type?: string
  metadata?: unknown
  replyToId?: string | null
  forwardedFromId?: string | null
  forwardCount?: number
  isPinned?: boolean
  pinnedAt?: string | null
  pinnedBy?: string | null
  priority?: string | null
  scheduledFor?: string | null
  scheduledBy?: string | null
  isScheduled?: boolean
  status?: string
  deliveredAt?: string | null
  readAt?: string | null
  sentAt: string
  deliveryLatencyMs?: number | null
  editedAt?: string | null
  deletedAt?: string | null
  deletedBy?: string | null
  isDeleted?: boolean
  deletionType?: string | null
  createdAt: string
  updatedAt: string
  sender?: { id: string; firstName: string | null; lastName: string | null; email: string }
}

export interface ConversationResponseMeta {
  limit: number
  nextCursor?: string | null
  hasMore: boolean
}

// ---------------------------------------------------------------------------
// Request payload shapes
// ---------------------------------------------------------------------------

export interface CreateSupportTicketPayload {
  requesterType: SupportTicketRequesterType
  requesterUserId?: string
  requesterProviderId?: string
  sourceApp: SupportTicketSourceApp
  categoryKey: string
  priority?: SupportTicketPriority
  subject: string
  description: string
  bookingId?: string
  campId?: string
  sessionId?: string
  attachmentIds?: string[]
}

export interface ListSupportTicketsParams {
  status?: SupportTicketStatus
  priority?: SupportTicketPriority
  requesterType?: SupportTicketRequesterType
  requesterUserId?: string
  requesterProviderId?: string
  categoryKey?: string
  sourceApp?: SupportTicketSourceApp
  searchTerm?: string
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// Admin-specific types
// ---------------------------------------------------------------------------

export interface SupportTicketStats {
  open: number
  inProgress: number
  pending: number
  resolved: number
  closed: number
  total: number
}

/**
 * Alias for ListSupportTicketsParams used by the superadmin service.
 * Prefer ListSupportTicketsParams for new code.
 */
export type ListTicketsParams = ListSupportTicketsParams
