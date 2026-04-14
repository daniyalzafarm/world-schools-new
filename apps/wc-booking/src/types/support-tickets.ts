/**
 * Re-exports support ticket types from the shared @world-schools/wc-types package.
 * Types now have a single source of truth — do not add definitions here.
 */
export {
  SUPPORT_TICKET_STATUS,
  SUPPORT_TICKET_PRIORITY,
  SUPPORT_TICKET_SOURCE_APP,
  SUPPORT_TICKET_REQUESTER_TYPE,
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_PRIORITY_LABELS,
} from '@world-schools/wc-types'

export type {
  SupportTicketStatus,
  SupportTicketPriority,
  SupportTicketSourceApp,
  SupportTicketRequesterType,
  SupportTicketCategory,
  SupportTicketRequesterUser,
  SupportTicketRequesterProvider,
  SupportTicketAssignee,
  SupportTicketLastMessageSender,
  SupportTicketLastMessage,
  SupportTicket,
  PaginatedSupportTickets,
  PaginatedSupportTicketsMeta,
  SupportTicketAttachment,
  SupportTicketMessageResponse,
  ConversationResponseMeta,
  CreateSupportTicketPayload,
  ListSupportTicketsParams,
  ListTicketsParams,
  SupportTicketStats,
} from '@world-schools/wc-types'
