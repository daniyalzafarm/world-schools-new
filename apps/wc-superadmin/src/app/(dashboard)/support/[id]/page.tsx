'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Avatar, BreadcrumbItem, Breadcrumbs, Button, Chip, Divider, Skeleton } from '@heroui/react'
import { type Message, MessageBubble, MessageThread } from '@world-schools/ui-web'
import { ArrowLeft, Calendar, ExternalLink, Tag, User } from 'lucide-react'
import { SlaProgressBar } from '@world-schools/wc-frontend-utils'
import { PageSlot } from '@/components/layout/page-slot'
import { SupportTicketLayout } from '@/components/support/SupportTicketLayout'
import { useAuthStore } from '@/stores/auth-store'
import { usePermissions } from '@/hooks/use-permissions'
import { supportTicketsService } from '@/services/support-tickets.services'
import { messagingAttachmentsService } from '@/services/messaging-attachments.services'
import { useSupportTicketConversation } from '@/hooks/useSupportTicketConversation'
import type {
  SupportTicket,
  SupportTicketMessageResponse,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@/types/support-tickets'

function messageToUiMessage(
  msg: SupportTicketMessageResponse,
  ticket: SupportTicket | null
): Message {
  // In admin view: isUser = message from requester (customer) → left; admin → right
  const isFromRequester =
    ticket &&
    (msg.senderId === ticket.requesterUser?.id || msg.senderId === ticket.requesterProvider?.id)
  return {
    id: msg.id,
    text: msg.content,
    isUser: !!isFromRequester,
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

function getStatusColor(
  s: SupportTicketStatus
): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' {
  switch (s) {
    case 'OPEN':
      return 'primary'
    case 'IN_PROGRESS':
      return 'warning'
    case 'PENDING_REQUESTER':
    case 'PENDING_SUPPORT':
      return 'secondary'
    case 'RESOLVED':
      return 'success'
    case 'CLOSED':
      return 'default'
    default:
      return 'default'
  }
}

function getPriorityColor(
  p: SupportTicketPriority
): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' {
  switch (p) {
    case 'URGENT':
      return 'danger'
    case 'HIGH':
      return 'warning'
    case 'NORMAL':
      return 'primary'
    case 'LOW':
      return 'default'
    default:
      return 'default'
  }
}

function requesterDisplay(ticket: SupportTicket): string {
  if (ticket.requesterUser) {
    const { firstName, lastName, email } = ticket.requesterUser
    return [firstName, lastName].filter(Boolean).join(' ') || email
  }
  if (ticket.requesterProvider) {
    return ticket.requesterProvider.legalCompanyName || ticket.requesterProvider.email || 'Provider'
  }
  return '—'
}

function requesterEmail(ticket: SupportTicket): string {
  if (ticket.requesterUser) return ticket.requesterUser.email
  if (ticket.requesterProvider) return ticket.requesterProvider.email || ''
  return ''
}

export default function SupportTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { user } = useAuthStore()
  const { hasPermission } = usePermissions()
  const canRead = hasPermission('support_tickets.read')
  const canUpdate = hasPermission('support_tickets.update')
  const canAssign = hasPermission('support_tickets.assign')
  const canDelete = hasPermission('support_tickets.delete')

  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportTicketMessageResponse[]>([])
  const [isLoadingTicket, setIsLoadingTicket] = useState(true)
  const [isLoadingConversation, setIsLoadingConversation] = useState(true)
  const [sendingReply, setSendingReply] = useState(false)
  const [replyStatus, setReplyStatus] = useState<SupportTicketStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setError(null)
    setIsLoadingTicket(true)
    supportTicketsService
      .getTicketById(id)
      .then(result => {
        if (result.success) {
          setTicket(result.data)
          setReplyStatus(result.data.status)
        } else setError('Failed to load ticket')
      })
      .catch(() => setError('Failed to load ticket'))
      .finally(() => setIsLoadingTicket(false))
  }, [id])

  const { messages: liveMessages, isLoadingConversation: liveLoading } =
    useSupportTicketConversation({ ticketId: id })

  useEffect(() => {
    setMessages(liveMessages)
    setIsLoadingConversation(liveLoading)
  }, [liveMessages, liveLoading])

  const handleSendReply = useCallback(
    async ({ content, attachments }: { content: string; attachments: File[] }) => {
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
            console.error(
              'Failed to upload one or more attachments for support ticket reply (superadmin)',
              failed
            )
            return
          }

          attachmentIds = uploadResults
            .map(result => (result.success ? result.data.id : null))
            .filter((id): id is string => id != null)
        }

        const addRes = await supportTicketsService.addReply(
          id,
          { content: trimmed, senderId: user.id, attachmentIds },
          'SUPERADMIN'
        )
        if (!addRes.success) return
        // Message will be pushed via websocket and merged by hook; ensure local state also has it
        setMessages(prev =>
          prev.find(m => m.id === addRes.data.id) ? prev : [...prev, addRes.data]
        )
        if (replyStatus) {
          const statusRes = await supportTicketsService.updateStatus(id, {
            status: replyStatus,
          })
          if (statusRes.success) setTicket(statusRes.data)
        }
      } finally {
        setSendingReply(false)
      }
    },
    [id, user?.id, replyStatus, sendingReply]
  )

  const handleMarkResolved = useCallback(async () => {
    if (!id) return
    try {
      const statusRes = await supportTicketsService.updateStatus(id, {
        status: 'RESOLVED',
      })
      if (!statusRes.success) throw new Error()
      setTicket(statusRes.data)
      setReplyStatus('RESOLVED')
    } catch {
      setError('Failed to update status')
    }
  }, [id])

  const handleReopen = useCallback(async () => {
    if (!id) return
    try {
      const reopenRes = await supportTicketsService.reopenTicket(id, {
        reason: 'Reopened from detail page',
      })
      if (!reopenRes.success) throw new Error()
      setTicket(reopenRes.data)
      setReplyStatus(reopenRes.data.status)
    } catch {
      setError('Failed to reopen')
    }
  }, [id])

  const handleAssign = useCallback(
    async (assignedToUserId: string | null) => {
      if (!id) return
      try {
        const assignRes = await supportTicketsService.assignTicket(id, {
          assignedToUserId,
        })
        if (!assignRes.success) throw new Error()
        setTicket(assignRes.data)
      } catch {
        setError('Failed to assign')
      }
    },
    [id]
  )

  const handleDelete = useCallback(async () => {
    if (!id) return
    if (!confirm('Soft delete this ticket?')) return
    try {
      const delRes = await supportTicketsService.softDeleteTicket(id)
      if (!delRes.success) throw new Error()
      router.push('/support')
    } catch {
      setError('Failed to delete')
    }
  }, [id, router])

  const enhancedMessages: Message[] = messages.map(m => messageToUiMessage(m, ticket))

  if (!id) {
    return (
      <PageSlot>
        <p className="text-gray-500 dark:text-gray-400">Invalid ticket ID.</p>
        <Link href="/support">
          <Button variant="flat" className="mt-2">
            Back to list
          </Button>
        </Link>
      </PageSlot>
    )
  }

  if (!canRead) {
    return (
      <PageSlot>
        <p className="text-gray-500 dark:text-gray-400">
          You don&apos;t have permission to view support tickets.
        </p>
        <Link href="/support">
          <Button variant="flat" className="mt-2">
            Back to list
          </Button>
        </Link>
      </PageSlot>
    )
  }

  if (error && !isLoadingTicket) {
    return (
      <PageSlot>
        <p className="text-red-500">{error}</p>
        <Link href="/support">
          <Button variant="flat" startContent={<ArrowLeft size={16} />}>
            Back to list
          </Button>
        </Link>
      </PageSlot>
    )
  }

  if (isLoadingTicket || !ticket) {
    return (
      <PageSlot>
        <Skeleton className="h-8 w-64 rounded" />
        <Skeleton className="h-32 w-full rounded mt-4" />
      </PageSlot>
    )
  }

  const displayNumber = ticket.ticketNumber
  const canReopen = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'

  const headerActions = (
    <>
      <Button variant="flat" isDisabled>
        Merge
      </Button>
      <Button variant="flat" isDisabled>
        Duplicate
      </Button>
      {canUpdate && canReopen && (
        <Button variant="flat" onPress={handleReopen}>
          Reopen
        </Button>
      )}
      {canUpdate && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
        <Button color="primary" onPress={handleMarkResolved}>
          Mark Resolved
        </Button>
      )}
    </>
  )

  const rightSidebar = (
    <div className="flex flex-col gap-5 p-5">
      {/* Requester */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-default-500">Requester</h3>
        <div className="flex items-center gap-3 rounded-lg bg-default-100 p-3 dark:bg-default-50/40">
          <Avatar name={requesterDisplay(ticket)} size="md" />
          <div>
            <p className="text-sm font-semibold text-foreground">{requesterDisplay(ticket)}</p>
            <p className="text-xs text-default-500">{requesterEmail(ticket)}</p>
          </div>
        </div>
        <Button variant="bordered" fullWidth as={Link} href="#">
          View profile
        </Button>
      </section>

      {/* Ticket details */}
      <section className="flex flex-col gap-4">
        <Divider />
        <h3 className="text-xs font-bold uppercase tracking-wide text-default-500">
          Ticket details
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-default-500">Status</dt>
            <dd>
              <Chip size="sm" color={getStatusColor(ticket.status)} variant="flat">
                {ticket.status}
              </Chip>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-default-500">Priority</dt>
            <dd>
              <Chip size="sm" color={getPriorityColor(ticket.priority)} variant="flat">
                {ticket.priority}
              </Chip>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-default-500">Category</dt>
            <dd className="text-foreground">{ticket.category?.name ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-default-500">Created</dt>
            <dd className="text-foreground">
              {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-default-500">Last update</dt>
            <dd className="text-foreground">
              {ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>

        {/* SLA progress bars */}
        {(ticket.firstResponseDueAt || ticket.resolutionDueAt) && (
          <div className="mt-3 flex flex-col gap-3">
            {ticket.firstResponseDueAt && (
              <SlaProgressBar
                label="First response"
                dueAt={ticket.firstResponseDueAt}
                completedAt={ticket.firstRespondedAt}
                breachedAt={ticket.slaFirstResponseBreachedAt}
              />
            )}
            {ticket.resolutionDueAt && (
              <SlaProgressBar
                label="Resolution"
                dueAt={ticket.resolutionDueAt}
                completedAt={ticket.resolvedAt}
                breachedAt={ticket.slaResolutionBreachedAt}
              />
            )}
          </div>
        )}
      </section>

      {/* Assigned to */}
      <section className="flex flex-col gap-4">
        <Divider />
        <h3 className="text-xs font-bold uppercase tracking-wide text-default-500">Assigned to</h3>
        {ticket.assignedToUser ? (
          <div className="flex items-center gap-2 rounded-lg bg-default-100 p-3 dark:bg-default-50/40">
            <Avatar
              name={[ticket.assignedToUser.firstName, ticket.assignedToUser.lastName]
                .filter(Boolean)
                .join(' ')}
              size="sm"
            />
            <span className="text-sm font-medium text-foreground">
              {[ticket.assignedToUser.firstName, ticket.assignedToUser.lastName]
                .filter(Boolean)
                .join(' ') || ticket.assignedToUser.email}
            </span>
          </div>
        ) : (
          <p className="text-sm text-default-500">Unassigned</p>
        )}
        {canAssign && (
          <Button
            size="sm"
            variant="flat"
            className="self-start"
            onPress={() => handleAssign(null)}
          >
            Reassign
          </Button>
        )}
      </section>

      {/* Linked items */}
      {(ticket.bookingId || ticket.campId || ticket.sessionId) && (
        <section className="flex flex-col gap-4">
          <Divider />
          <h3 className="text-xs font-bold uppercase tracking-wide text-default-500">
            Linked items
          </h3>
          <div className="space-y-1 text-sm">
            {ticket.bookingId && (
              <Link
                href={`/bookings/${ticket.bookingId}`}
                className="flex items-center gap-1 text-primary"
              >
                <ExternalLink size={14} /> Booking
              </Link>
            )}
            {ticket.campId && (
              <Link
                href={`/camps/${ticket.campId}`}
                className="flex items-center gap-1 text-primary"
              >
                <ExternalLink size={14} /> Camp
              </Link>
            )}
            {ticket.sessionId && (
              <Link
                href={`/sessions/${ticket.sessionId}`}
                className="flex items-center gap-1 text-primary"
              >
                <ExternalLink size={14} /> Session
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Actions (secondary) */}
      <section className="flex flex-col gap-4">
        <Divider />
        <h3 className="text-xs font-bold uppercase tracking-wide text-default-500">Actions</h3>
        <div className="flex flex-col gap-2">
          {canAssign && (
            <Button color="secondary" onPress={() => handleAssign(null)}>
              Reassign
            </Button>
          )}
          {canUpdate && (
            <Button variant="flat" color="warning">
              Change priority
            </Button>
          )}
          {canDelete && (
            <Button color="danger" variant="flat" onPress={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </section>

      <Divider />

      {/* Activity (placeholder) */}
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-default-500">Activity</h3>
        <p className="text-sm text-default-500">No activity timeline yet.</p>
      </section>
    </div>
  )

  return (
    <SupportTicketLayout
      breadcrumb={
        <Breadcrumbs variant="light" color="foreground">
          <BreadcrumbItem key="support-list" href="/support">
            Support Tickets
          </BreadcrumbItem>
          <BreadcrumbItem key="support-ticket">{displayNumber}</BreadcrumbItem>
        </Breadcrumbs>
      }
      title={
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Ticket #{displayNumber}
          </h1>
          <Chip color={getStatusColor(ticket.status)} variant="flat">
            {ticket.status.replace('_', ' ')}
          </Chip>
          <Chip color={getPriorityColor(ticket.priority)} variant="flat">
            {ticket.priority}
          </Chip>
        </div>
      }
      actions={headerActions}
      rightSidebar={rightSidebar}
    >
      <div className="flex h-full flex-col">
        <div className="space-y-2 border-b border-gray-200 p-6 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{ticket.subject}</h2>
          <p className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar size={14} /> Opened{' '}
              {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}
            </span>
            ·
            <span className="flex items-center gap-1">
              <User size={14} /> {requesterDisplay(ticket)}
            </span>
            ·
            <span className="flex items-center gap-1">
              <Tag size={14} /> {ticket.category?.name ?? '—'}
            </span>
          </p>
        </div>
        <div className="flex flex-1 flex-col min-h-0">
          {/* {canUpdate && (
            <div className="flex items-center gap-2 border-b border-gray-200 p-2 dark:border-gray-700">
              <Select
                label="Status when sending"
                size="sm"
                selectedKeys={replyStatus ? [replyStatus] : []}
                onSelectionChange={keys =>
                  setReplyStatus((Array.from(keys)[0] as SupportTicketStatus) || null)
                }
                className="max-w-48"
              >
                <SelectItem key="OPEN">Keep Open</SelectItem>
                <SelectItem key="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem key="PENDING_REQUESTER">Pending (Requester)</SelectItem>
                <SelectItem key="PENDING_SUPPORT">Pending (Support)</SelectItem>
                <SelectItem key="RESOLVED">Resolved</SelectItem>
              </Select>
            </div>
          )} */}
          <MessageThread
            messages={enhancedMessages}
            renderMessage={msg => (
              <MessageBubble
                message={msg}
                senderName={requesterDisplay(ticket)}
                isAdminView={true}
              />
            )}
            onSend={handleSendReply}
            isLoading={isLoadingConversation}
            placeholder="Type a reply..."
            disabled={sendingReply || !user || !canUpdate}
            helpText={false}
            className="flex-1 min-h-0"
            scrollAreaClassName="flex-1 min-h-0"
          />
        </div>
      </div>
    </SupportTicketLayout>
  )
}
