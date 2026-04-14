import React, { useMemo } from 'react'
import { Button, Skeleton, Spinner } from '@heroui/react'
import { type Message, MessageBubble, MessageThread } from '@world-schools/ui-web'
import { AlertTriangle, ArrowLeft, Calendar } from 'lucide-react'
import type { SupportTicket, SupportTicketMessageResponse } from '@world-schools/wc-types'
import {
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_PRIORITY_LABELS,
} from '@world-schools/wc-types'
import {
  getStatusChipColorClass,
  getPriorityBadgeClass,
  formatStartedLabel,
  messageToUiMessage,
} from './support-tickets-ui-utils'
import { SlaProgressBar } from './SlaProgressBar'

export interface SupportTicketDetailContentProps {
  ticket: SupportTicket | null
  isLoadingTicket: boolean
  messages: SupportTicketMessageResponse[]
  isLoadingConversation: boolean
  error: string | null
  sendingReply: boolean
  updatingStatus: boolean
  currentUserId: string
  onSendReply: (params: { content: string; attachments: File[] }) => Promise<void>
  onMarkResolved: () => void
  onBack: () => void
}

/**
 * Shared ticket detail view for wc-booking and wc-provider.
 *
 * Renders:
 * - Header with ticket subject, status pill, priority badge, ticket number, date
 * - "Mark resolved" button (hidden when ticket is already resolved/closed)
 * - PENDING_REQUESTER action-required banner
 * - SLA first-response progress bar
 * - Conversation thread with reply input
 */
export function SupportTicketDetailContent({
  ticket,
  isLoadingTicket,
  messages,
  isLoadingConversation,
  error,
  sendingReply,
  updatingStatus,
  currentUserId,
  onSendReply,
  onMarkResolved,
  onBack,
}: SupportTicketDetailContentProps) {
  const enhancedMessages: Message[] = useMemo(
    () => messages.map(m => messageToUiMessage(m, currentUserId)),
    [messages, currentUserId]
  )

  // Loading state
  if (isLoadingTicket || !ticket) {
    return (
      <div className="h-full max-w-3xl mx-auto bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3 py-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-64 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
        </div>
        <Skeleton className="mt-4 h-64 w-full rounded-xl" />
      </div>
    )
  }

  const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
  const isPendingRequester = ticket.status === 'PENDING_REQUESTER'

  const assignedName =
    ticket.assignedToUser &&
    [ticket.assignedToUser.firstName, ticket.assignedToUser.lastName].filter(Boolean).length
      ? [ticket.assignedToUser.firstName, ticket.assignedToUser.lastName].filter(Boolean).join(' ')
      : (ticket.assignedToUser?.email ?? 'World Camps Support')

  const priorityClass = getPriorityBadgeClass(ticket.priority)
  const showSlaBar = !isResolved && !!ticket.firstResponseDueAt && !ticket.firstRespondedAt

  return (
    <div className="h-full max-w-3xl mx-auto bg-white dark:bg-gray-900">
      <div className="flex h-full flex-col bg-white dark:bg-gray-900">
        {/* Header */}
        <header className="flex items-center gap-4 border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-6">
          <Button isIconOnly variant="bordered" size="sm" radius="full" onPress={onBack}>
            <ArrowLeft size={16} />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-50 sm:text-lg">
                {ticket.subject}
              </h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {/* Status pill */}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusChipColorClass(ticket.status)}`}
              >
                {SUPPORT_TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
              </span>

              {/* Priority badge (HIGH and URGENT only) */}
              {priorityClass && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass}`}
                >
                  {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}
                </span>
              )}

              {/* Ticket number */}
              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded-md dark:bg-slate-800">
                {ticket.ticketNumber}
              </span>

              <span>·</span>

              {/* Created date */}
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} />
                {formatStartedLabel(ticket.createdAt)}
              </span>
            </div>
          </div>

          {/* Mark resolved button */}
          {!isResolved && (
            <Button
              color="secondary"
              onPress={onMarkResolved}
              isDisabled={updatingStatus}
              startContent={updatingStatus ? <Spinner size="sm" color="white" /> : null}
            >
              {updatingStatus ? 'Marking…' : 'Mark resolved'}
            </Button>
          )}
        </header>

        {/* Inline error banner (when ticket is loaded but an action failed) */}
        {error && ticket && (
          <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* PENDING_REQUESTER — action required banner */}
        {isPendingRequester && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
            <AlertTriangle
              size={16}
              className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>Your reply is needed</strong> — the support team is waiting for your response.
            </p>
          </div>
        )}

        {/* SLA first-response progress bar */}
        {showSlaBar && (
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <SlaProgressBar
              label="First response"
              dueAt={ticket.firstResponseDueAt}
              completedAt={ticket.firstRespondedAt}
            />
          </div>
        )}

        {/* Conversation thread + reply input */}
        <div className="flex flex-1 flex-col min-h-0">
          <MessageThread
            messages={enhancedMessages}
            renderMessage={msg => (
              <MessageBubble message={msg} senderName={assignedName} isAdminView={false} />
            )}
            onSend={onSendReply}
            isLoading={isLoadingConversation}
            placeholder={isResolved ? 'This ticket is resolved.' : 'Type your message...'}
            disabled={sendingReply || isResolved}
            helpText={!isResolved}
            renderLoading={() => (
              <div className="flex h-full min-h-48 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                <Spinner size="lg" label="Loading conversation..." />
              </div>
            )}
            emptyMessage={
              <div className="flex h-full min-h-48 items-center justify-center">
                <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                  <p>No messages yet.</p>
                  {!isResolved && <p className="mt-1">Send a message to start the conversation.</p>}
                </div>
              </div>
            }
            scrollAreaClassName="flex-1 min-h-0"
          />
        </div>
      </div>
    </div>
  )
}
