'use client'

import React, { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button, Skeleton, Spinner } from '@heroui/react'
import { type Message, MessageBubble, MessageThread } from '@world-schools/ui-web'
import { ArrowLeft, Calendar } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { supportTicketsService } from '@/services/support-tickets.services'
import { messagingAttachmentsService } from '@/services/messaging-attachments.services'
import { useSupportTicketConversation } from '@/hooks/useSupportTicketConversation'
import type {
  SupportTicket,
  SupportTicketMessageResponse,
  SupportTicketStatus,
} from '@/types/support-tickets'

function messageToUiMessage(msg: SupportTicketMessageResponse, currentUserId: string): Message {
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
    attachments: Array.isArray((msg as any).attachments) ? ((msg as any).attachments as any) : null,
  }
}

function getStatusPillClasses(status: SupportTicketStatus): string {
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

function formatStartedLabel(createdAt?: string | null): string {
  if (!createdAt) return 'Started —'
  const date = new Date(createdAt)
  return `Started ${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`
}

export default function ParentSupportTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const id = params?.id as string | undefined

  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [isLoadingTicket, setIsLoadingTicket] = useState(true)
  const [sendingReply, setSendingReply] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)

  React.useEffect(() => {
    if (!id) return
    setError(null)
    setIsLoadingTicket(true)
    supportTicketsService
      .getTicketById(id)
      .then(result => {
        if (result.success) {
          setTicket(result.data)
        } else {
          setError('Failed to load ticket.')
        }
      })
      .catch(() => setError('Failed to load ticket.'))
      .finally(() => setIsLoadingTicket(false))
  }, [id])

  const {
    messages,
    isLoading: isLoadingConversation,
    sendReply,
  } = useSupportTicketConversation(
    id ? { ticketId: id, conversationId: ticket?.conversationId } : { ticketId: '' }
  )

  const enhancedMessages: Message[] = useMemo(
    () => messages.map(m => messageToUiMessage(m, user?.id ?? '')),
    [messages, user?.id]
  )

  const handleSendReply = async ({
    content,
    attachments,
  }: {
    content: string
    attachments: File[]
  }) => {
    const trimmed = content.trim()
    if (!id || !user?.id || sendingReply) return
    if (!trimmed && attachments.length === 0) return
    setSendingReply(true)
    try {
      let attachmentIds: string[] | undefined

      if (attachments.length > 0) {
        const uploadResults = await Promise.all(
          attachments.map(file => messagingAttachmentsService.uploadAttachment(file))
        )

        const failed = uploadResults.find(result => !result.success)
        if (failed) {
          console.error('Failed to upload one or more attachments for support ticket reply', failed)
          return
        }

        attachmentIds = uploadResults
          .map(result => (result.success ? result.data.id : null))
          .filter((id): id is string => id != null)
      }

      await sendReply(trimmed, attachmentIds)
    } finally {
      setSendingReply(false)
    }
  }

  const handleMarkResolved = useCallback(async () => {
    if (!id || !ticket || updatingStatus) return
    setUpdatingStatus(true)
    setError(null)
    try {
      const res = await supportTicketsService.updateStatus(id, { status: 'RESOLVED' })
      if (!res.success) {
        setError('Failed to update ticket status.')
        return
      }
      setTicket(res.data)
    } catch {
      setError('Failed to update ticket status.')
    } finally {
      setUpdatingStatus(false)
    }
  }, [id, ticket, updatingStatus])

  if (!id) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Invalid ticket ID.</p>
        <Button
          as={Link}
          href="/support/tickets"
          variant="flat"
          startContent={<ArrowLeft size={16} />}
        >
          Back to my tickets
        </Button>
      </div>
    )
  }

  if (error && !isLoadingTicket && !ticket) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Button
          as={Link}
          href="/support/tickets"
          variant="flat"
          startContent={<ArrowLeft size={16} />}
        >
          Back to my tickets
        </Button>
      </div>
    )
  }

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
  const assignedName =
    ticket.assignedToUser &&
    [ticket.assignedToUser.firstName, ticket.assignedToUser.lastName].filter(Boolean).length
      ? [ticket.assignedToUser.firstName, ticket.assignedToUser.lastName].filter(Boolean).join(' ')
      : ticket.assignedToUser?.email || 'World Camps Support'

  return (
    <div className="h-full max-w-3xl mx-auto bg-white dark:bg-gray-900">
      <div className="flex h-full flex-col bg-white dark:bg-gray-900">
        {/* Top bar (similar to messages page) */}
        <header className="flex items-center gap-4 border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-6">
          <Button
            isIconOnly
            variant="bordered"
            size="sm"
            radius="full"
            onPress={() => router.push('/support/tickets')}
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-50 sm:text-lg">
                {ticket.subject}
              </h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusPillClasses(ticket.status)}`}
              >
                {ticket.status === 'PENDING_REQUESTER'
                  ? 'Pending your reply'
                  : ticket.status === 'PENDING_SUPPORT'
                    ? 'Pending support'
                    : ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
              </span>
              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded-md dark:bg-slate-800">
                {ticket.ticketNumber}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} />
                {formatStartedLabel(ticket.createdAt)}
              </span>
            </div>
          </div>
          {!isResolved && (
            <Button
              color="secondary"
              onPress={() => void handleMarkResolved()}
              isDisabled={updatingStatus}
              startContent={updatingStatus ? <Spinner size="sm" color="white" /> : null}
            >
              {updatingStatus ? 'Marking…' : 'Mark resolved'}
            </Button>
          )}
        </header>

        {error && ticket && (
          <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Conversation + input (MessageThread) */}
        <div className="flex flex-1 flex-col min-h-0">
          <MessageThread
            messages={enhancedMessages}
            renderMessage={msg => (
              <MessageBubble
                message={msg}
                senderName={assignedName}
                // Parent view: user messages on the right, support/chatbot on the left,
                // so keep isAdminView=false and use senderName for the other side.
                isAdminView={false}
              />
            )}
            onSend={handleSendReply}
            isLoading={isLoadingConversation}
            placeholder={isResolved ? 'This ticket is resolved.' : 'Type your message...'}
            disabled={sendingReply || !user || isResolved}
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
