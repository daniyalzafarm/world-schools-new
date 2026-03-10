/**
 * Support Tickets API Service for WC Superadmin
 */

import apiClient, { type ApiResult } from '@/utils/api-client'
import type {
  ConversationResponseMeta,
  ListTicketsParams,
  PaginatedSupportTickets,
  SupportTicket,
  SupportTicketMessageResponse,
  SupportTicketStats,
} from '@/types/support-tickets'

const BASE = '/superadmin/support-tickets'

/** Backend list response: data is the array, meta is pagination (spread on success). */
interface ListResponseMeta {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

function buildQueryString(params?: ListTicketsParams): string {
  const search = new URLSearchParams()
  if (params?.status != null) search.set('status', params.status)
  if (params?.priority != null) search.set('priority', params.priority)
  if (params?.categoryKey != null) search.set('categoryKey', params.categoryKey)
  if (params?.requesterType != null) search.set('requesterType', params.requesterType)
  if (params?.searchTerm != null) search.set('searchTerm', params.searchTerm)
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.offset != null) search.set('offset', String(params.offset))
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

interface GetConversationParams {
  limit?: number
  cursor?: string
}

function buildConversationQueryString(params?: GetConversationParams): string {
  const search = new URLSearchParams()
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.cursor) search.set('cursor', params.cursor)
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export const supportTicketsService = {
  /**
   * List support tickets (admin; requires support_tickets.read).
   * Backend returns { success, data: SupportTicket[], meta }.
   */
  async listTickets(params?: ListTicketsParams): Promise<ApiResult<PaginatedSupportTickets>> {
    const query = buildQueryString(params)
    const result = await apiClient.get<SupportTicket[]>(`${BASE}${query}`)

    if (!result.success) {
      return result as ApiResult<PaginatedSupportTickets>
    }

    const res = result as typeof result & { meta?: ListResponseMeta }
    const data = res.data ?? []
    const meta = res.meta ?? {
      total: data.length,
      limit: params?.limit ?? 20,
      offset: params?.offset ?? 0,
      hasMore: false,
    }

    return {
      success: true,
      data: {
        data,
        total: meta.total,
        limit: meta.limit,
        offset: meta.offset,
        hasMore: meta.hasMore,
      },
    }
  },

  /**
   * Get a single ticket by ID (for detail view).
   */
  async getTicketById(id: string): Promise<ApiResult<SupportTicket>> {
    return apiClient.get<SupportTicket>(`${BASE}/${encodeURIComponent(id)}`)
  },

  /**
   * Update ticket fields (priority, category, tags, etc.).
   */
  async updateTicket(
    id: string,
    body: {
      priority?: string
      categoryKey?: string
      tags?: string[]
      bookingId?: string
      campId?: string
      sessionId?: string
    }
  ): Promise<ApiResult<SupportTicket>> {
    return apiClient.patch<SupportTicket>(`${BASE}/${encodeURIComponent(id)}`, body)
  },

  /**
   * Update ticket status.
   */
  async updateStatus(id: string, body: { status: string }): Promise<ApiResult<SupportTicket>> {
    return apiClient.patch<SupportTicket>(`${BASE}/${encodeURIComponent(id)}/status`, body)
  },

  /**
   * Assign ticket to a user.
   */
  async assignTicket(
    id: string,
    body: { assignedToUserId?: string | null }
  ): Promise<ApiResult<SupportTicket>> {
    return apiClient.patch<SupportTicket>(`${BASE}/${encodeURIComponent(id)}/assign`, body)
  },

  /**
   * Reopen a closed/resolved ticket.
   */
  async reopenTicket(id: string, body?: { reason?: string }): Promise<ApiResult<SupportTicket>> {
    return apiClient.post<SupportTicket>(`${BASE}/${encodeURIComponent(id)}/reopen`, body ?? {})
  },

  /**
   * Soft-delete a ticket.
   */
  async softDeleteTicket(id: string): Promise<ApiResult<{ message?: string }>> {
    return apiClient.del<{ message?: string }>(`${BASE}/${encodeURIComponent(id)}`)
  },

  /**
   * Get a ticket's conversation (messages).
   */
  async getConversation(
    ticketId: string,
    params?: GetConversationParams
  ): Promise<ApiResult<{ data: SupportTicketMessageResponse[]; meta: ConversationResponseMeta }>> {
    const query = buildConversationQueryString(params)
    const result = await apiClient.get<SupportTicketMessageResponse[]>(
      `${BASE}/${encodeURIComponent(ticketId)}/conversation${query}`
    )

    if (!result.success) {
      return result as ApiResult<{
        data: SupportTicketMessageResponse[]
        meta: ConversationResponseMeta
      }>
    }

    const res = result as typeof result & { meta?: ConversationResponseMeta }
    const data = Array.isArray(res.data) ? res.data : []
    const meta = res.meta ?? {
      limit: params?.limit ?? 50,
      hasMore: false,
    }

    return {
      success: true,
      data: { data, meta },
    }
  },

  /**
   * Add a reply to a ticket.
   */
  async addReply(
    ticketId: string,
    body: { content: string; senderId: string },
    senderType: 'SUPERADMIN' = 'SUPERADMIN'
  ): Promise<ApiResult<SupportTicketMessageResponse>> {
    return apiClient.post<SupportTicketMessageResponse>(
      `${BASE}/${encodeURIComponent(ticketId)}/replies`,
      { ticketId, ...body, senderType }
    )
  },

  /**
   * Get ticket counts by status (for badges, dashboard).
   */
  async getTicketStats(): Promise<ApiResult<SupportTicketStats>> {
    return apiClient.get<SupportTicketStats>(`${BASE}/stats`)
  },
}
