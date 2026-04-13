'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Chip, Spinner } from '@heroui/react'
import { AlertCircle, HelpCircle, MessageSquare, Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { supportTicketsService } from '@/services/support-tickets.services'
import { globalWsService } from '@/lib/websocket-instance'
import {
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicket,
  type SupportTicketStatus,
} from '@/types/support-tickets'

function ticketPreviewText(ticket: SupportTicket, currentUserId: string): string {
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

const OPEN_TAB_STATUSES: SupportTicketStatus[] = ['OPEN', 'IN_PROGRESS']
const CLOSED_TAB_STATUSES: SupportTicketStatus[] = ['RESOLVED', 'CLOSED']

type TabId = 'all' | 'open' | 'pending' | 'closed'

function getStatusChipColor(status: SupportTicketStatus): string {
  switch (status) {
    case 'OPEN':
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case 'PENDING_REQUESTER':
    case 'PENDING_SUPPORT':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    case 'RESOLVED':
    case 'CLOSED':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
  }
}

function formatRelativeTime(dateStr: string): string {
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

function filterByTab(tickets: SupportTicket[], tab: TabId): SupportTicket[] {
  if (tab === 'all') return tickets
  if (tab === 'open')
    return tickets.filter(t => OPEN_TAB_STATUSES.includes(t.status as SupportTicketStatus))
  if (tab === 'pending')
    return tickets.filter(t => t.status === 'PENDING_REQUESTER' || t.status === 'PENDING_SUPPORT')
  if (tab === 'closed')
    return tickets.filter(t => CLOSED_TAB_STATUSES.includes(t.status as SupportTicketStatus))
  return tickets
}

export default function SupportTicketsPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('all')

  const fetchTickets = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    const result = await supportTicketsService.listMyTickets({
      limit: 100,
      offset: 0,
    })
    setLoading(false)
    if (!result.success) {
      const msg =
        'data' in result &&
        result.data &&
        typeof result.data === 'object' &&
        'message' in result.data
          ? (result.data as { message: string }).message
          : 'Failed to load tickets'
      setError(msg)
      return
    }
    setTickets(result.data.data ?? [])
  }, [user?.id])

  useEffect(() => {
    void fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
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
    }

    const unsubscribe = globalWsService.on('ticket:statusUpdated', handleTicketStatusUpdated)

    return () => {
      unsubscribe()
    }
  }, [])

  const filteredTickets = filterByTab(tickets, activeTab)
  const tabCounts = {
    all: tickets.length,
    open: tickets.filter(t => OPEN_TAB_STATUSES.includes(t.status as SupportTicketStatus)).length,
    pending: tickets.filter(t => t.status === 'PENDING_REQUESTER' || t.status === 'PENDING_SUPPORT')
      .length,
    closed: tickets.filter(t => CLOSED_TAB_STATUSES.includes(t.status as SupportTicketStatus))
      .length,
  }

  return (
    <>
      <div className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">
              My support tickets
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400">
              Track and manage your support requests
            </p>
          </div>
          <Button
            as={Link}
            href="/support/tickets/new"
            color="primary"
            className="bg-slate-800 text-white shrink-0"
            startContent={<Plus size={18} />}
          >
            New support ticket
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" label="Loading tickets..." />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h3 className="font-medium text-red-800 dark:text-red-300 mb-1">
              Error loading tickets
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
          <Button size="sm" variant="flat" color="danger" onPress={() => fetchTickets()}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-6">
            {(
              [
                { id: 'all' as TabId, label: 'All', count: tabCounts.all },
                { id: 'open' as TabId, label: 'Open', count: tabCounts.open },
                { id: 'pending' as TabId, label: 'Pending your reply', count: tabCounts.pending },
                { id: 'closed' as TabId, label: 'Closed', count: tabCounts.closed },
              ] as const
            ).map(({ id, label, count }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`cursor-pointer px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === id
                    ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {label}
                <span
                  className={`ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-semibold ${
                    activeTab === id
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {filteredTickets.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {activeTab === 'all' ? 'No tickets yet' : `No ${activeTab} tickets`}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-5">
                {activeTab === 'all'
                  ? 'Create a support ticket and we will get back to you as soon as we can.'
                  : 'There are no tickets in this category.'}
              </p>
              {activeTab === 'all' && (
                <Button
                  as={Link}
                  href="/support/tickets/new"
                  className="bg-slate-800 text-white"
                  startContent={<Plus size={18} />}
                >
                  New support ticket
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredTickets.map(ticket => (
                <div
                  key={ticket.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    router.push(`/support/tickets/${ticket.id}`)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(`/support/tickets/${ticket.id}`)
                    }
                  }}
                  className="flex items-start gap-4 p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all cursor-pointer text-left"
                >
                  <div
                    className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
                      OPEN_TAB_STATUSES.includes(ticket.status as SupportTicketStatus)
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : ticket.status === 'PENDING_REQUESTER'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    }`}
                  >
                    <MessageSquare size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                        {ticket.subject}
                      </h3>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                        {ticket.ticketNumber}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                      {ticketPreviewText(ticket, user?.id ?? '')}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {ticket.category && <span>{ticket.category.name}</span>}
                      <span>Created {formatRelativeTime(ticket.createdAt)}</span>
                      {ticket.lastSupportReplyAt && (
                        <span>Last reply {formatRelativeTime(ticket.lastSupportReplyAt)}</span>
                      )}
                    </div>
                  </div>
                  <Chip
                    size="sm"
                    className={getStatusChipColor(ticket.status as SupportTicketStatus)}
                  >
                    {SUPPORT_TICKET_STATUS_LABELS[ticket.status as SupportTicketStatus] ??
                      ticket.status}
                  </Chip>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
