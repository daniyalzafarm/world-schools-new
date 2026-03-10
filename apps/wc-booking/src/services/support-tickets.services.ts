import apiClient, { type ApiResult } from '@/utils/api-client'
import type {
  ConversationResponseMeta,
  CreateSupportTicketPayload,
  ListSupportTicketsParams,
  PaginatedSupportTickets,
  SupportTicket,
  SupportTicketMessageResponse,
  SupportTicketStatus,
} from '@/types/support-tickets'

/** Backend list response: data is the array, meta is pagination (spread on success). */
interface ListResponseMeta {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

function buildQueryString(params: ListSupportTicketsParams): string {
  const search = new URLSearchParams()
  if (params.status != null) search.set('status', params.status)
  if (params.priority != null) search.set('priority', params.priority)
  if (params.requesterType != null) search.set('requesterType', params.requesterType)
  if (params.requesterUserId != null) search.set('requesterUserId', params.requesterUserId)
  if (params.requesterProviderId != null)
    search.set('requesterProviderId', params.requesterProviderId)
  if (params.categoryKey != null) search.set('categoryKey', params.categoryKey)
  if (params.sourceApp != null) search.set('sourceApp', params.sourceApp)
  if (params.searchTerm != null) search.set('searchTerm', params.searchTerm)
  if (params.limit != null) search.set('limit', String(params.limit))
  if (params.offset != null) search.set('offset', String(params.offset))
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Support tickets API service for parent-facing Help Center.
 */
export const supportTicketsService = {
  /**
   * List the current user's support tickets (self-service; no admin permission required).
   * Calls GET /user/support-tickets/my for the parent app.
   */
  async listMyTickets(
    params: ListSupportTicketsParams
  ): Promise<ApiResult<PaginatedSupportTickets>> {
    const query = buildQueryString(params)
    const result = await apiClient.get<SupportTicket[]>(`/user/support-tickets/my${query}`)

    if (!result.success) {
      return result as ApiResult<PaginatedSupportTickets>
    }

    const res = result as typeof result & { meta?: ListResponseMeta }
    const data = res.data ?? []
    const meta = res.meta ?? {
      total: data.length,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
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
   * List support tickets (admin; requires support_tickets.read).
   * Backend returns { success, data: SupportTicket[], meta }.
   * Uses superadmin endpoint when called from admin context.
   */
  async listTickets(params: ListSupportTicketsParams): Promise<ApiResult<PaginatedSupportTickets>> {
    const query = buildQueryString(params)
    const result = await apiClient.get<SupportTicket[]>(`/superadmin/support-tickets${query}`)

    if (!result.success) {
      return result as ApiResult<PaginatedSupportTickets>
    }

    const res = result as typeof result & { meta?: ListResponseMeta }
    const data = res.data ?? []
    const meta = res.meta ?? {
      total: data.length,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
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
   * Create a new support ticket (POST /user/support-tickets).
   */
  async createTicket(payload: CreateSupportTicketPayload): Promise<ApiResult<SupportTicket>> {
    return apiClient.post<SupportTicket>('/user/support-tickets', payload)
  },

  /**
   * Get a single ticket by ID (for detail view).
   */
  async getTicketById(id: string): Promise<ApiResult<SupportTicket>> {
    return apiClient.get<SupportTicket>(`/user/support-tickets/${id}`)
  },

  /**
   * Get conversation messages for a ticket (GET /user/support-tickets/:id/conversation).
   */
  async getConversation(
    ticketId: string,
    params?: { limit?: number; cursor?: string }
  ): Promise<ApiResult<{ data: SupportTicketMessageResponse[]; meta: ConversationResponseMeta }>> {
    const search = new URLSearchParams()
    if (params?.limit != null) search.set('limit', String(params.limit))
    if (params?.cursor) search.set('cursor', params.cursor)
    const qs = search.toString()
    const suffix = qs ? `?${qs}` : ''

    const result = await apiClient.get<SupportTicketMessageResponse[]>(
      `/user/support-tickets/${encodeURIComponent(ticketId)}/conversation${suffix}`
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
   * Add a reply to a ticket (POST /user/support-tickets/:id/replies).
   */
  async addReply(
    ticketId: string,
    body: { content: string }
  ): Promise<ApiResult<SupportTicketMessageResponse>> {
    return apiClient.post<SupportTicketMessageResponse>(
      `/user/support-tickets/${encodeURIComponent(ticketId)}/replies`,
      body
    )
  },

  /**
   * Update ticket status from the parent side (e.g. mark resolved).
   */
  async updateStatus(
    ticketId: string,
    body: { status: SupportTicketStatus }
  ): Promise<ApiResult<SupportTicket>> {
    return apiClient.patch<SupportTicket>(
      `/user/support-tickets/${encodeURIComponent(ticketId)}/status`,
      body
    )
  },
}
