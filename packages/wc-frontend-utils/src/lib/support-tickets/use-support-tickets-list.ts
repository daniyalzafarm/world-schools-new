import { useCallback, useEffect, useState } from 'react'
import type { ApiResult } from '@world-schools/wc-utils'
import { WsServerEvent } from '@world-schools/wc-types'
import type {
  PaginatedSupportTickets,
  SupportTicket,
  SupportTicketStatus,
} from '@world-schools/wc-types'
import type { GlobalWebSocketService } from '../websocket/create-websocket-service'
import { filterByTab, CLOSED_TAB_STATUSES, OPEN_TAB_STATUSES } from './support-tickets-ui-utils'
import type { TabId } from './support-tickets-ui-utils'

interface UseSupportTicketsListOptions {
  /** Function that fetches the current user's tickets (from the factory service). */
  listMyTickets: (params: {
    limit: number
    offset: number
  }) => Promise<ApiResult<PaginatedSupportTickets>>
  /** App-level WebSocket service for real-time status updates. */
  wsService: GlobalWebSocketService
}

interface TabCounts {
  all: number
  open: number
  pending: number
  closed: number
}

interface UseSupportTicketsListResult {
  tickets: SupportTicket[]
  loading: boolean
  error: string | null
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  filteredTickets: SupportTicket[]
  tabCounts: TabCounts
  fetchTickets: () => Promise<void>
}

/**
 * Shared hook for the support ticket list page.
 *
 * Handles:
 * - Fetching the current user's tickets on mount
 * - Tab filtering (all / open / pending / closed)
 * - Real-time status updates via WebSocket `ticket:statusUpdated`
 *
 * Used by wc-booking and wc-provider list pages.
 */
export function useSupportTicketsList({
  listMyTickets,
  wsService,
}: UseSupportTicketsListOptions): UseSupportTicketsListResult {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('all')

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listMyTickets({ limit: 100, offset: 0 })
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
  }, [listMyTickets])

  // Initial fetch
  useEffect(() => {
    void fetchTickets()
  }, [fetchTickets])

  // Real-time ticket status updates
  useEffect(() => {
    const handleStatusUpdated = (data: {
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

    const unsubscribe = wsService.on(WsServerEvent.TicketStatusUpdated, handleStatusUpdated)
    return () => unsubscribe()
  }, [wsService])

  const filteredTickets = filterByTab(tickets, activeTab)

  const tabCounts: TabCounts = {
    all: tickets.length,
    open: tickets.filter(t => OPEN_TAB_STATUSES.includes(t.status)).length,
    pending: tickets.filter(t => t.status === 'PENDING_REQUESTER' || t.status === 'PENDING_SUPPORT')
      .length,
    closed: tickets.filter(t => CLOSED_TAB_STATUSES.includes(t.status)).length,
  }

  return {
    tickets,
    loading,
    error,
    activeTab,
    setActiveTab,
    filteredTickets,
    tabCounts,
    fetchTickets,
  }
}
