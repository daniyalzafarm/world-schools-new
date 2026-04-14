import type { Message, MessageAttachment } from '@world-schools/ui-web'
import type {
  SupportTicket,
  SupportTicketAttachment,
  SupportTicketMessageResponse,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@world-schools/wc-types'

// ---------------------------------------------------------------------------
// Tab filtering
// ---------------------------------------------------------------------------

export type TabId = 'all' | 'open' | 'pending' | 'closed'

export const OPEN_TAB_STATUSES: SupportTicketStatus[] = ['OPEN', 'IN_PROGRESS']
export const CLOSED_TAB_STATUSES: SupportTicketStatus[] = ['RESOLVED', 'CLOSED']

export function filterByTab(tickets: SupportTicket[], tab: TabId): SupportTicket[] {
  if (tab === 'all') return tickets
  if (tab === 'open') return tickets.filter(t => OPEN_TAB_STATUSES.includes(t.status))
  if (tab === 'pending')
    return tickets.filter(t => t.status === 'PENDING_REQUESTER' || t.status === 'PENDING_SUPPORT')
  if (tab === 'closed') return tickets.filter(t => CLOSED_TAB_STATUSES.includes(t.status))
  return tickets
}

// ---------------------------------------------------------------------------
// Status / priority colour helpers
// ---------------------------------------------------------------------------

/**
 * Returns Tailwind class string for a status chip/pill.
 * Used on both list cards and the detail page header.
 */
export function getStatusChipColorClass(status: SupportTicketStatus): string {
  switch (status) {
    case 'OPEN':
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case 'PENDING_REQUESTER':
    case 'PENDING_SUPPORT':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    case 'RESOLVED':
    case 'CLOSED':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  }
}

/**
 * Returns the icon background/text colour class for a ticket card icon.
 */
export function getStatusIconColorClass(status: SupportTicketStatus): string {
  if (OPEN_TAB_STATUSES.includes(status)) {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
  }
  if (status === 'PENDING_REQUESTER') {
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
  }
  return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
}

/**
 * Returns Tailwind class string for a priority badge.
 * Returns empty string for LOW / NORMAL (not shown to avoid noise).
 */
export function getPriorityBadgeClass(priority: SupportTicketPriority): string {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Ticket preview text (used on list cards)
// ---------------------------------------------------------------------------

export function ticketPreviewText(ticket: SupportTicket, currentUserId: string): string {
  const msg = ticket.lastMessage
  if (!msg?.content) return ticket.description ?? '—'
  const senderName =
    msg.senderId === currentUserId
      ? 'You'
      : msg.sender
        ? [msg.sender.firstName, msg.sender.lastName].filter(Boolean).join(' ') || 'Support'
        : 'Support'
  return `${senderName}: ${msg.content}`
}

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function formatStartedLabel(createdAt?: string | null): string {
  if (!createdAt) return 'Started —'
  const date = new Date(createdAt)
  return `Started ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

// ---------------------------------------------------------------------------
// Attachment mime-type → MessageAttachment.fileType
// ---------------------------------------------------------------------------

function toMessageAttachment(att: SupportTicketAttachment): MessageAttachment {
  let fileType: MessageAttachment['fileType'] = 'OTHER'
  const mime = att.mimeType ?? ''
  if (mime.startsWith('image/')) fileType = 'IMAGE'
  else if (mime.startsWith('video/')) fileType = 'VIDEO'
  else if (mime.startsWith('audio/')) fileType = 'AUDIO'
  else if (
    mime === 'application/pdf' ||
    mime.includes('document') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('powerpoint') ||
    mime === 'text/plain' ||
    mime === 'text/csv'
  ) {
    fileType = 'DOCUMENT'
  }

  return {
    id: att.id,
    fileName: att.fileName,
    fileSize: att.sizeBytes,
    mimeType: att.mimeType,
    fileType,
    url: att.url,
  }
}

// ---------------------------------------------------------------------------
// Message shape adapter (SupportTicketMessageResponse → ui-web Message)
// ---------------------------------------------------------------------------

/**
 * Converts a backend SupportTicketMessageResponse into the ui-web Message shape
 * for use with MessageBubble / MessageThread.
 *
 * isUser = true  → message comes from the current logged-in user (right side)
 * isUser = false → message from support or other party (left side)
 */
export function messageToUiMessage(
  msg: SupportTicketMessageResponse,
  currentUserId: string
): Message {
  return {
    id: msg.id,
    text: msg.content,
    isUser: msg.senderId === currentUserId,
    timestamp: msg.sentAt ? new Date(msg.sentAt) : undefined,
    isTransferRequest: false,
    isTransferSummary: false,
    isChatbot: msg.senderType === 'CHATBOT',
    status: msg.status,
    deliveredAt: msg.deliveredAt ? new Date(msg.deliveredAt) : null,
    readAt: msg.readAt ? new Date(msg.readAt) : null,
    attachments: Array.isArray(msg.attachments) ? msg.attachments.map(toMessageAttachment) : null,
  }
}
