import type { ApiResult } from '@world-schools/wc-utils'
import type {
  ConversationResponseMeta,
  CreateSupportTicketPayload,
  ListSupportTicketsParams,
  PaginatedSupportTickets,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketMessageResponse,
  SupportTicketStatus,
} from '@world-schools/wc-types'

// ---------------------------------------------------------------------------
// Minimal API client interface required by this factory.
// Compatible with the ApiClient from @world-schools/wc-utils.
// ---------------------------------------------------------------------------

export interface SupportTicketsApiClient {
  get<T>(url: string): Promise<ApiResult<T>>
  post<T>(url: string, data: unknown): Promise<ApiResult<T>>
  patch<T>(url: string, data: unknown): Promise<ApiResult<T>>
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Service instance type
// ---------------------------------------------------------------------------

export interface SupportTicketsServiceInstance {
  /** List the current user's own support tickets (self-service). */
  listMyTickets(params: ListSupportTicketsParams): Promise<ApiResult<PaginatedSupportTickets>>
  /** Create a new support ticket. */
  createTicket(payload: CreateSupportTicketPayload): Promise<ApiResult<SupportTicket>>
  /** Get a single ticket by ID or ticket number. */
  getTicketById(id: string): Promise<ApiResult<SupportTicket>>
  /** Get paginated conversation messages for a ticket. */
  getConversation(
    ticketId: string,
    params?: { limit?: number; cursor?: string }
  ): Promise<ApiResult<{ data: SupportTicketMessageResponse[]; meta: ConversationResponseMeta }>>
  /** Add a reply to a ticket. */
  addReply(
    ticketId: string,
    body: { content: string; attachmentIds?: string[] }
  ): Promise<ApiResult<SupportTicketMessageResponse>>
  /** Update the ticket status (e.g. mark resolved by requester). */
  updateStatus(
    ticketId: string,
    body: { status: SupportTicketStatus }
  ): Promise<ApiResult<SupportTicket>>
  /** List categories available for this audience (PARENT or PROVIDER). */
  listCategories(): Promise<ApiResult<SupportTicketCategory[]>>
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a support tickets service bound to a specific URL prefix.
 *
 * @param apiClient - App-specific API client instance.
 * @param urlPrefix - `/user` for wc-booking, `/provider` for wc-provider.
 *
 * @example
 * // wc-booking
 * export const supportTicketsService = createSupportTicketsService(apiClient, '/user')
 *
 * // wc-provider
 * export const supportTicketsService = createSupportTicketsService(apiClient, '/provider')
 */
export function createSupportTicketsService(
  apiClient: SupportTicketsApiClient,
  urlPrefix: '/user' | '/provider'
): SupportTicketsServiceInstance {
  const base = `${urlPrefix}/support-tickets`

  return {
    async listMyTickets(params) {
      const query = buildQueryString(params)
      const result = await apiClient.get<SupportTicket[]>(`${base}/my${query}`)
      if (!result.success) return result as ApiResult<PaginatedSupportTickets>

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

    async createTicket(payload) {
      return apiClient.post<SupportTicket>(base, payload)
    },

    async getTicketById(id) {
      return apiClient.get<SupportTicket>(`${base}/${encodeURIComponent(id)}`)
    },

    async getConversation(ticketId, params) {
      const search = new URLSearchParams()
      if (params?.limit != null) search.set('limit', String(params.limit))
      if (params?.cursor) search.set('cursor', params.cursor)
      const qs = search.toString()
      const suffix = qs ? `?${qs}` : ''

      const result = await apiClient.get<SupportTicketMessageResponse[]>(
        `${base}/${encodeURIComponent(ticketId)}/conversation${suffix}`
      )
      if (!result.success) {
        return result as ApiResult<{
          data: SupportTicketMessageResponse[]
          meta: ConversationResponseMeta
        }>
      }

      const res = result as typeof result & { meta?: ConversationResponseMeta }
      const data = Array.isArray(res.data) ? res.data : []
      const meta = res.meta ?? { limit: params?.limit ?? 50, hasMore: false }
      return { success: true, data: { data, meta } }
    },

    async addReply(ticketId, body) {
      return apiClient.post<SupportTicketMessageResponse>(
        `${base}/${encodeURIComponent(ticketId)}/replies`,
        body
      )
    },

    async updateStatus(ticketId, body) {
      return apiClient.patch<SupportTicket>(`${base}/${encodeURIComponent(ticketId)}/status`, body)
    },

    async listCategories() {
      return apiClient.get<SupportTicketCategory[]>(`${urlPrefix}/support-ticket-categories`)
    },
  }
}
