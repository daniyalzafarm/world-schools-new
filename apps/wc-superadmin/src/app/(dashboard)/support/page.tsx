'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Avatar,
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Pagination,
  Skeleton,
} from '@heroui/react'
import {
  Input,
  type Message,
  MessageBubble,
  MessageThread,
  SelectField,
  useDebounce,
} from '@world-schools/ui-web'
import { FilterX, Headphones, MessageSquare, MoreVertical } from 'lucide-react'
import { PageSlot } from '@/components/layout/page-slot'
import { useAuthStore } from '@/stores/auth-store'
import { usePermissions } from '@/hooks/use-permissions'
import { supportTicketsService } from '@/services/support-tickets.services'
import { WsClientEvent, WsServerEvent } from '@world-schools/wc-types'
import { globalWsService } from '@/lib/websocket-instance'
import type {
  ListTicketsParams,
  SupportTicket,
  SupportTicketMessageResponse,
  SupportTicketPriority,
  SupportTicketRequesterType,
  SupportTicketStats,
  SupportTicketStatus,
} from '@/types/support-tickets'

const PAGE_SIZE = 20

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

function messageToUiMessage(
  msg: SupportTicketMessageResponse,
  ticket: SupportTicket | null
): Message {
  // In admin view: isUser = message from requester (customer) → left; admin → right
  const isFromRequester =
    ticket &&
    ((ticket.requesterUser != null && msg.senderId === ticket.requesterUser.id) ||
      (ticket.requesterProvider != null && msg.senderId === ticket.requesterProvider.id))
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
  }
}

const STATUS_TABS: { key: string; label: string; status?: SupportTicketStatus }[] = [
  { key: 'open', label: 'Open', status: 'OPEN' },
  { key: 'in_progress', label: 'In Progress', status: 'IN_PROGRESS' },
  { key: 'pending', label: 'Pending', status: undefined },
  { key: 'resolved', label: 'Resolved', status: 'RESOLVED' },
  { key: 'all', label: 'All', status: undefined },
]

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
]

const REQUESTER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Users' },
  { value: 'PARENT', label: 'Parents' },
  { value: 'PROVIDER', label: 'Providers' },
]

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

function ticketPreviewText(ticket: SupportTicket, currentUserId: string): string {
  const msg = ticket.lastMessage
  if (!msg?.content) return ticket.description ?? '—'
  if (msg.senderId === currentUserId) return `You: ${msg.content}`
  const senderName = msg.sender
    ? [msg.sender.firstName, msg.sender.lastName].filter(Boolean).join(' ') ||
      requesterDisplay(ticket)
    : requesterDisplay(ticket)
  return `${senderName}: ${msg.content}`
}

/** Badge variant for ticket list (matches reference HTML: urgent, high, normal, low, parent, provider, etc.) */
function getPriorityBadgeClass(p: SupportTicketPriority): string {
  switch (p) {
    case 'URGENT':
      return 'bg-danger-100 text-danger dark:bg-danger-500/20 dark:text-danger'
    case 'HIGH':
      return 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning'
    case 'NORMAL':
      return 'bg-primary-100 text-primary dark:bg-primary-500/20 dark:text-primary'
    case 'LOW':
      return 'bg-default-100 text-default-600 dark:bg-default-500/20 dark:text-default-600'
    default:
      return 'bg-default-100 text-default-600 dark:bg-default-500/20 dark:text-default-600'
  }
}

function getRequesterBadgeClass(requesterType: SupportTicketRequesterType): string {
  if (requesterType === 'PARENT')
    return 'bg-secondary-100 text-secondary dark:bg-secondary-500/20 dark:text-secondary'
  if (requesterType === 'PROVIDER')
    return 'bg-success-100 text-success dark:bg-success-500/20 dark:text-success'
  return 'bg-default-100 text-default-600 dark:bg-default-500/20 dark:text-default-600'
}

function getCategoryBadgeClass(categoryKey?: string): string {
  if (!categoryKey)
    return 'bg-default-100 text-default-600 dark:bg-default-500/20 dark:text-default-600'
  const key = categoryKey.toLowerCase()
  if (key.includes('payment') || key.includes('refund'))
    return 'bg-success-100 text-success dark:bg-success-500/20 dark:text-success'
  if (key.includes('booking'))
    return 'bg-primary-100 text-primary dark:bg-primary-500/20 dark:text-primary'
  if (key.includes('technical'))
    return 'bg-default-100 text-default-600 dark:bg-default-500/20 dark:text-default-600'
  return 'bg-default-100 text-default-600 dark:bg-default-500/20 dark:text-default-600'
}

export default function SupportTicketsPage() {
  const { user } = useAuthStore()
  const { hasPermission } = usePermissions()
  const canRead = hasPermission('support_tickets.read')
  const canUpdate = hasPermission('support_tickets.update')
  const canAssign = hasPermission('support_tickets.assign')

  const [stats, setStats] = useState<SupportTicketStats | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [meta, setMeta] = useState({ total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false })
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [tabKey, setTabKey] = useState('open')
  const [searchInput, setSearchInput] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [requesterTypeFilter, setRequesterTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [conversationMessages, setConversationMessages] = useState<SupportTicketMessageResponse[]>(
    []
  )
  const [, setConversationMeta] = useState<{
    nextCursor?: string | null
    hasMore: boolean
  }>({ hasMore: false })
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)
  const [replyStatus, setReplyStatus] = useState<SupportTicketStatus | null>(null)

  const debouncedSearch = useDebounce(searchInput, 500)

  const statusFilterForApi = (() => {
    const tab = STATUS_TABS.find(t => t.key === tabKey)
    if (!tab || tab.key === 'all') return undefined
    if (tab.key === 'pending') return 'PENDING_REQUESTER' as SupportTicketStatus
    return tab.status
  })()

  const fetchList = useCallback(async () => {
    setIsLoadingList(true)
    try {
      const params: ListTicketsParams = {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        searchTerm: debouncedSearch || undefined,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        requesterType: requesterTypeFilter === 'all' ? undefined : requesterTypeFilter,
        categoryKey: categoryFilter === 'all' ? undefined : categoryFilter,
        status: statusFilterForApi,
      }
      const result = await supportTicketsService.listTickets(params)
      if (!result.success) throw new Error()
      const { data, total, limit, offset, hasMore } = result.data
      setTickets(data)
      setMeta({ total, limit, offset, hasMore })
    } catch {
      setTickets([])
      setMeta(prev => ({ ...prev, total: 0, hasMore: false }))
    } finally {
      setIsLoadingList(false)
    }
  }, [
    page,
    statusFilterForApi,
    debouncedSearch,
    priorityFilter,
    requesterTypeFilter,
    categoryFilter,
  ])

  useEffect(() => {
    supportTicketsService
      .getTicketStats()
      .then(result => (result.success ? setStats(result.data) : setStats(null)))
      .catch(() => setStats(null))
  }, [])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  useEffect(() => {
    const ws = globalWsService

    const handleTicketStatusUpdated = (data: {
      ticketId: string
      status: SupportTicketStatus
      resolvedAt?: string | null
      closedAt?: string | null
      updatedAt?: string
    }) => {
      setTickets(prev =>
        prev.map(t =>
          t.id === data.ticketId
            ? {
                ...t,
                status: data.status,
                resolvedAt: data.resolvedAt ?? t.resolvedAt,
                closedAt: data.closedAt ?? t.closedAt,
                updatedAt: data.updatedAt ?? t.updatedAt,
              }
            : t
        )
      )
      setSelectedTicket(prev =>
        prev && prev.id === data.ticketId
          ? {
              ...prev,
              status: data.status,
              resolvedAt: data.resolvedAt ?? prev.resolvedAt,
              closedAt: data.closedAt ?? prev.closedAt,
              updatedAt: data.updatedAt ?? prev.updatedAt,
            }
          : prev
      )
    }

    const handleTicketAssigned = (data: {
      ticketId: string
      assignedToUserId: string | null
      assignedAt?: string | null
    }) => {
      setTickets(prev =>
        prev.map(t =>
          t.id === data.ticketId
            ? {
                ...t,
                assignedAt: data.assignedAt ?? t.assignedAt,
              }
            : t
        )
      )
    }

    const unsubStatus = ws.on(WsServerEvent.TicketStatusUpdated, handleTicketStatusUpdated)
    const unsubAssigned = ws.on(WsServerEvent.TicketAssigned, handleTicketAssigned)

    return () => {
      unsubStatus()
      unsubAssigned()
    }
  }, [])

  // Join conversation room when viewing a ticket inline so we receive message:new when requester replies
  useEffect(() => {
    if (!selectedTicket?.conversationId || !globalWsService.isConnected()) return
    globalWsService.emit(WsClientEvent.JoinConversation, {
      conversationId: selectedTicket.conversationId,
    })
    return () => {
      globalWsService.emit(WsClientEvent.LeaveConversation, {
        conversationId: selectedTicket.conversationId,
      })
    }
  }, [selectedTicket?.conversationId])

  // Listen for new messages when viewing a ticket inline
  useEffect(() => {
    if (!selectedTicketId || !selectedTicket?.conversationId) return
    const handleNewMessage = (payload: { message: any }) => {
      const msg = payload.message
      if (msg?.conversationId !== selectedTicket.conversationId) return
      setConversationMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })

      // Mark incoming messages as delivered immediately when panel is open
      if (user?.id && msg?.senderId && msg.senderId !== user.id) {
        globalWsService.emit(WsClientEvent.MessageDelivered, {
          messageId: msg.id,
          conversationId: selectedTicket.conversationId,
        })
      }
    }
    const unsub = globalWsService.on(WsServerEvent.MessageNew, handleNewMessage)
    return () => unsub()
  }, [selectedTicketId, selectedTicket?.conversationId, user?.id])

  // Listen for delivery/read receipts when viewing a ticket inline (to update UI in realtime)
  useEffect(() => {
    if (!selectedTicketId || !selectedTicket?.conversationId) return

    const handleDeliveredReceipt = (data: {
      messageId: string
      conversationId?: string
      deliveredAt?: string
    }) => {
      if (data.conversationId && data.conversationId !== selectedTicket.conversationId) return
      setConversationMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? {
                ...m,
                status: (m.status === 'READ' ? m.status : 'DELIVERED') as any,
                deliveredAt: m.deliveredAt ?? data.deliveredAt ?? new Date().toISOString(),
              }
            : m
        )
      )
    }

    const handleReadReceipt = (data: {
      messageId: string
      conversationId?: string
      readAt?: string
    }) => {
      if (data.conversationId && data.conversationId !== selectedTicket.conversationId) return
      setConversationMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? {
                ...m,
                status: 'READ' as any,
                readAt: m.readAt ?? data.readAt ?? new Date().toISOString(),
              }
            : m
        )
      )
    }

    const unsubDelivered = globalWsService.on(
      WsServerEvent.ReceiptDelivered,
      handleDeliveredReceipt
    )
    const unsubRead = globalWsService.on(WsServerEvent.ReceiptRead, handleReadReceipt)

    return () => {
      unsubDelivered()
      unsubRead()
    }
  }, [selectedTicketId, selectedTicket?.conversationId])

  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedTicket(null)
      setConversationMessages([])
      setConversationMeta({ hasMore: false })
      return
    }
    setIsLoadingDetail(true)
    setIsLoadingConversation(true)
    supportTicketsService
      .getTicketById(selectedTicketId)
      .then(result => {
        if (result.success) {
          setSelectedTicket(result.data)
          setReplyStatus(result.data.status)
        } else setSelectedTicket(null)
      })
      .catch(() => setSelectedTicket(null))
      .finally(() => setIsLoadingDetail(false))
    supportTicketsService
      .getConversation(selectedTicketId, { limit: 50 })
      .then(result => {
        if (result.success) {
          setConversationMessages(result.data.data)
          setConversationMeta({
            nextCursor: result.data.meta.nextCursor,
            hasMore: result.data.meta.hasMore ?? false,
          })

          // Mark recent incoming messages as delivered once the panel loads
          if (selectedTicket?.conversationId && user?.id) {
            const undeliveredIncoming = result.data.data
              .filter(m => m.senderId !== user.id && !m.deliveredAt)
              .slice(-20)
            for (const m of undeliveredIncoming) {
              globalWsService.emit(WsClientEvent.MessageDelivered, {
                messageId: m.id,
                conversationId: selectedTicket.conversationId,
              })
            }
          }
        } else setConversationMessages([])
      })
      .catch(() => setConversationMessages([]))
      .finally(() => setIsLoadingConversation(false))
  }, [selectedTicketId, selectedTicket?.conversationId, user?.id])

  const handleSendReply = useCallback(
    async (payload: { content: string; attachments: File[] }) => {
      const { content } = payload
      if (!selectedTicketId || !user?.id || sendingReply) return
      setSendingReply(true)
      try {
        const addRes = await supportTicketsService.addReply(
          selectedTicketId,
          { content, senderId: user.id },
          'SUPERADMIN'
        )
        if (!addRes.success) return
        const convRes = await supportTicketsService.getConversation(selectedTicketId, {
          limit: 50,
        })
        if (convRes.success) setConversationMessages(convRes.data.data)
        if (replyStatus) {
          const statusRes = await supportTicketsService.updateStatus(selectedTicketId, {
            status: replyStatus,
          })
          if (statusRes.success) setSelectedTicket(statusRes.data)
        }
      } finally {
        setSendingReply(false)
      }
    },
    [selectedTicketId, user?.id, replyStatus, sendingReply]
  )

  const enhancedMessages: Message[] = conversationMessages.map(m =>
    messageToUiMessage(m, selectedTicket)
  )

  const hasActiveFilters =
    searchInput ||
    priorityFilter !== 'all' ||
    categoryFilter !== 'all' ||
    requesterTypeFilter !== 'all'

  const handleClearFilters = () => {
    setSearchInput('')
    setPriorityFilter('all')
    setCategoryFilter('all')
    setRequesterTypeFilter('all')
  }

  const tabCount = (key: string) => {
    if (!stats) return undefined
    switch (key) {
      case 'open':
        return stats.open
      case 'in_progress':
        return stats.inProgress
      case 'pending':
        return stats.pending
      case 'resolved':
        return stats.resolved
      case 'all':
        return stats.total
      default:
        return undefined
    }
  }

  if (!canRead) {
    return (
      <PageSlot>
        <p className="text-gray-500 dark:text-gray-400">
          You don&apos;t have permission to view support tickets.
        </p>
        <Link href="/analytics-dashboard">
          <Button variant="flat" className="mt-2">
            Back to Dashboard
          </Button>
        </Link>
      </PageSlot>
    )
  }

  const openStat = stats?.open ?? 0

  return (
    <PageSlot className="max-w-400 space-y-6">
      {/* Page Header - matches KB articles */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Support Tickets</h1>
          <p className="text-default-500 mt-1">Manage customer support requests</p>
        </div>
      </div>

      {/* Stats Grid - matches KB articles + reference (urgent card has left border) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={openStat > 0 ? 'border-l-4 border-l-danger' : ''}>
          <CardBody className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
              Open Tickets
            </p>
            <p className="text-2xl font-bold text-foreground">{stats?.open ?? '—'}</p>
            <p className="text-xs text-default-500">
              {openStat > 0 ? `${openStat} need attention` : 'No open tickets'}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
              Avg. Response Time
            </p>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-default-500">Coming soon</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
              Resolved Today
            </p>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-default-500">Coming soon</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
              Satisfaction
            </p>
            <p className="text-2xl font-bold text-foreground">—</p>
            <p className="text-xs text-default-500">Coming soon</p>
          </CardBody>
        </Card>
      </div>

      {/* Ticket Layout - reference: ticket-list-section + ticket-detail-section */}
      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Left: Ticket List - single Card with tabs, filters, list (matches reference structure) */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardBody className="p-0">
              {/* Tabs - matches reference + KB articles pattern */}
              <div className="flex gap-2 border-b border-default-200 px-4 pt-3">
                {STATUS_TABS.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTabKey(t.key)}
                    className={`cursor-pointer flex items-center gap-2 rounded-t-md px-3 pb-2 text-sm font-medium ${
                      tabKey === t.key
                        ? 'border-b-2 border-primary text-primary-600'
                        : 'text-default-500 hover:text-foreground'
                    }`}
                  >
                    <span>{t.label}</span>
                    {tabCount(t.key) != null && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          tabKey === t.key ? 'bg-primary-100 text-secondary' : 'bg-default-100'
                        }`}
                      >
                        {tabCount(t.key)}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Filter Controls - same as kb/articles */}
              <div className="flex flex-wrap items-end gap-4 border-b border-default-200 px-4 py-3">
                <Input
                  aria-label="Search tickets"
                  placeholder="Search tickets..."
                  className="w-full max-w-sm shrink-0"
                  value={searchInput}
                  onValueChange={setSearchInput}
                  isClearable
                  onClear={() => setSearchInput('')}
                />

                <SelectField
                  className="w-full md:w-40 shrink-0"
                  aria-label="Priority"
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  options={PRIORITY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  placeholder="All Priorities"
                />

                <SelectField
                  className="w-full md:w-40 shrink-0"
                  aria-label="Category"
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={[{ value: 'all', label: 'All Categories' }]}
                  placeholder="All Categories"
                />

                <SelectField
                  className="w-full md:w-40 shrink-0"
                  aria-label="User type"
                  value={requesterTypeFilter}
                  onChange={setRequesterTypeFilter}
                  options={REQUESTER_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  placeholder="All Users"
                />

                {hasActiveFilters && (
                  <Button
                    variant="flat"
                    startContent={<FilterX className="h-4 w-4" />}
                    onPress={handleClearFilters}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              {/* Ticket List - matches reference HTML structure exactly */}
              <div className="divide-y divide-default-200">
                {isLoadingList ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-4">
                      <Skeleton className="h-4 w-24 rounded" />
                      <Skeleton className="h-5 w-3/4 rounded mt-2" />
                      <Skeleton className="h-10 w-full rounded mt-2" />
                    </div>
                  ))
                ) : tickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <MessageSquare className="text-default-300 mb-2" size={40} />
                    <p className="text-default-500">No tickets found</p>
                  </div>
                ) : (
                  tickets.map(t => (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedTicketId(t.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedTicketId(t.id)
                        }
                      }}
                      className={`px-4 py-4 cursor-pointer transition-colors hover:bg-default-100 ${
                        selectedTicketId === t.id
                          ? 'bg-slate-100 dark:bg-primary-500/10 border-l-4 border-l-primary'
                          : ''
                      }`}
                    >
                      {/* ticket-header */}
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-medium text-default-400">
                          #{t.ticketNumber}
                        </span>
                        <span className="text-xs text-default-400">
                          {t.createdAt ? formatRelativeTime(t.createdAt) : '—'}
                        </span>
                      </div>
                      {/* ticket-subject */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        <span className="text-sm font-semibold text-foreground line-clamp-1">
                          {t.subject}
                        </span>
                      </div>
                      {/* ticket-preview */}
                      <p className="text-sm text-default-500 line-clamp-2 mb-3">
                        {ticketPreviewText(t, user?.id ?? '')}
                      </p>
                      {/* ticket-meta - matches reference ticket-user + ticket-badges */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-secondary text-[10px] font-semibold dark:bg-secondary-500/20 dark:text-secondary">
                            {requesterDisplay(t)
                              .split(/\s+/)
                              .map(w => w[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase() || '—'}
                          </span>
                          <span className="text-xs text-default-500">{requesterDisplay(t)}</span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${getPriorityBadgeClass(
                              t.priority
                            )}`}
                          >
                            {t.priority}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${getRequesterBadgeClass(
                              t.requesterType
                            )}`}
                          >
                            {t.requesterType}
                          </span>
                          {t.category && (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${getCategoryBadgeClass(
                                t.category.key
                              )}`}
                            >
                              {t.category.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination - matches reference */}
              {meta.total > 0 && (
                <div className="flex items-center justify-between border-t border-default-200 px-4 py-4">
                  <span className="text-sm text-default-500">
                    Showing {Math.min((page - 1) * PAGE_SIZE + 1, meta.total)}–
                    {Math.min(page * PAGE_SIZE, meta.total)} of {meta.total} tickets
                  </span>
                  {meta.total > PAGE_SIZE && (
                    <Pagination
                      total={Math.ceil(meta.total / PAGE_SIZE)}
                      page={page}
                      onChange={setPage}
                      showControls
                    />
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: Ticket Detail - matches reference ticket-detail-card */}
        <div className="w-full lg:w-[480px] shrink-0">
          <div className="sticky top-24">
            {!selectedTicketId ? (
              <Card>
                <CardBody className="flex flex-col items-center justify-center py-16">
                  <Headphones className="text-default-300 mb-2" size={48} />
                  <p className="text-default-500 text-center">
                    Select a ticket to view conversation and reply
                  </p>
                </CardBody>
              </Card>
            ) : isLoadingDetail ? (
              <Card>
                <CardBody className="space-y-2">
                  <Skeleton className="h-6 w-3/4 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-20 w-full rounded" />
                </CardBody>
              </Card>
            ) : selectedTicket ? (
              <Card>
                <CardBody className="p-0 flex flex-col max-h-[calc(100vh-8rem)]">
                  {/* detail-header - matches reference */}
                  <div className="p-4 border-b border-default-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-default-400">
                        #{selectedTicket.ticketNumber} • Opened{' '}
                        {selectedTicket.createdAt
                          ? formatRelativeTime(selectedTicket.createdAt)
                          : '—'}
                      </span>
                      <div className="flex gap-2">
                        {canAssign && (
                          <Link href={`/support/${selectedTicket.id}`}>
                            <Button size="sm" variant="flat" isIconOnly>
                              <span className="text-sm">👤</span>
                            </Button>
                          </Link>
                        )}
                        <Dropdown>
                          <DropdownTrigger>
                            <Button size="sm" variant="flat" isIconOnly>
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Ticket actions">
                            <DropdownItem key="merge" isDisabled>
                              Merge
                            </DropdownItem>
                            <DropdownItem
                              key="open"
                              as={Link}
                              href={`/support/${selectedTicket.id}`}
                            >
                              Open full
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                        <Link href={`/support/${selectedTicket.id}`}>
                          <Button size="sm" color="primary">
                            Open
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <h2 className="text-lg font-semibold text-foreground mb-3">
                      {selectedTicket.subject}
                    </h2>
                    <div className="flex gap-2 flex-wrap">
                      <Chip size="sm" color={getStatusColor(selectedTicket.status)} variant="flat">
                        {selectedTicket.status}
                      </Chip>
                      <Chip
                        size="sm"
                        color={getPriorityColor(selectedTicket.priority)}
                        variant="flat"
                      >
                        {selectedTicket.priority}
                      </Chip>
                      <Chip size="sm" variant="flat">
                        {selectedTicket.requesterType}
                      </Chip>
                      {selectedTicket.category && (
                        <Chip size="sm" variant="flat">
                          {selectedTicket.category.name}
                        </Chip>
                      )}
                    </div>
                  </div>

                  {/* detail-user-section - matches reference */}
                  <div className="px-4 py-4 bg-default-100 dark:bg-default-50/50 border-b border-default-200">
                    <div className="flex items-center gap-3">
                      <Avatar name={requesterDisplay(selectedTicket)} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground">
                          {requesterDisplay(selectedTicket)}
                        </p>
                        <p className="text-xs text-default-500">
                          {selectedTicket.requesterUser?.email ??
                            selectedTicket.requesterProvider?.email ??
                            '—'}
                        </p>
                      </div>
                      <Button size="sm" variant="flat" as={Link} href="#">
                        View Profile
                      </Button>
                    </div>
                  </div>

                  {/* conversation + reply */}
                  <div className="flex-1 min-h-0 flex flex-col p-2">
                    {/* {canUpdate && (
                      <div className="flex gap-2 items-center mb-2">
                        <Select
                          label="Status when sending"
                          size="sm"
                          selectedKeys={replyStatus ? [replyStatus] : []}
                          onSelectionChange={keys =>
                            setReplyStatus((Array.from(keys)[0] as SupportTicketStatus) || null)
                          }
                          className="max-w-[180px]"
                        >
                          <SelectItem key="OPEN">Keep Open</SelectItem>
                          <SelectItem key="IN_PROGRESS">Mark In Progress</SelectItem>
                          <SelectItem key="PENDING_REQUESTER">Mark Pending (Requester)</SelectItem>
                          <SelectItem key="PENDING_SUPPORT">Mark Pending (Support)</SelectItem>
                          <SelectItem key="RESOLVED">Mark Resolved</SelectItem>
                        </Select>
                      </div>
                    )} */}
                    <MessageThread
                      messages={enhancedMessages}
                      renderMessage={msg => (
                        <MessageBubble
                          message={msg}
                          senderName={requesterDisplay(selectedTicket)}
                          isAdminView={true}
                        />
                      )}
                      onSend={handleSendReply}
                      isLoading={isLoadingConversation}
                      placeholder="Type your reply..."
                      disabled={sendingReply || !user || !canUpdate}
                      helpText={false}
                      scrollAreaClassName="flex-1 max-h-[25rem]"
                    />
                  </div>
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardBody>Failed to load ticket.</CardBody>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageSlot>
  )
}
