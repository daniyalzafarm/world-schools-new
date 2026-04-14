/**
 * Messages Service Factory for World Schools Applications
 *
 * This factory creates a configured messages service layer that handles
 * all message-related API calls. It provides a clean separation between
 * the API layer and state management.
 *
 * @example
 * ```typescript
 * import { createMessagesService } from '@world-schools/wc-frontend-utils'
 * import apiClient from '@/utils/api-client'
 *
 * const messagesService = createMessagesService({
 *   apiClient,
 *   endpointPrefix: 'messaging/messages'
 * })
 *
 * // Use the service
 * const response = await messagesService.sendMessage({ conversationId, content, ... })
 * ```
 */

import type { ApiClient, ApiResult } from '@world-schools/wc-utils'
import type {
  SendMessageDto,
  GetMessagesDto,
  EditMessageDto,
  DeleteMessageDto,
  MarkAsReadDto,
  MarkAsDeliveredDto,
  AddReactionDto,
  RemoveReactionDto,
  BookmarkMessageDto,
  UnbookmarkMessageDto,
  PinMessageDto,
  UnpinMessageDto,
  ForwardMessageDto,
  ScheduleMessageDto,
  ReportMessageDto,
  MessageResponseDto,
  PaginatedMessagesResponseDto,
  EditHistoryResponseDto,
  ReactionResponseDto,
  BookmarkResponseDto,
  SuccessResponseDto,
} from '../types'

/**
 * Configuration options for creating a messages service instance
 */
export interface MessagesServiceConfig {
  /**
   * Configured API client instance
   */
  apiClient: ApiClient

  /**
   * Prefix for message endpoints (e.g., 'messaging/messages')
   * @default 'messaging/messages'
   */
  endpointPrefix?: string
}

/**
 * Messages service instance returned by createMessagesService factory
 */
export interface MessagesService {
  sendMessage: (dto: SendMessageDto) => Promise<ApiResult<MessageResponseDto>>
  getMessages: (dto: GetMessagesDto) => Promise<ApiResult<PaginatedMessagesResponseDto>>
  getMentionedMessages: (
    limit?: number,
    cursor?: string
  ) => Promise<ApiResult<PaginatedMessagesResponseDto>>
  getMessageById: (id: string) => Promise<ApiResult<MessageResponseDto>>
  getMessageThread: (id: string) => Promise<ApiResult<MessageResponseDto[]>>
  getMessageEditHistory: (
    id: string,
    limit?: number,
    cursor?: string
  ) => Promise<ApiResult<EditHistoryResponseDto[]>>
  editMessage: (id: string, dto: EditMessageDto) => Promise<ApiResult<MessageResponseDto>>
  deleteMessage: (id: string, dto: DeleteMessageDto) => Promise<ApiResult<SuccessResponseDto>>
  markAsRead: (id: string, dto: MarkAsReadDto) => Promise<ApiResult<SuccessResponseDto>>
  markAsDelivered: (id: string, dto: MarkAsDeliveredDto) => Promise<ApiResult<SuccessResponseDto>>
  markAllDelivered: () => Promise<ApiResult<SuccessResponseDto>>
  addReaction: (id: string, dto: AddReactionDto) => Promise<ApiResult<ReactionResponseDto>>
  removeReaction: (id: string, dto: RemoveReactionDto) => Promise<ApiResult<SuccessResponseDto>>
  bookmarkMessage: (id: string, dto: BookmarkMessageDto) => Promise<ApiResult<BookmarkResponseDto>>
  unbookmarkMessage: (
    id: string,
    dto: UnbookmarkMessageDto
  ) => Promise<ApiResult<SuccessResponseDto>>
  pinMessage: (id: string, dto: PinMessageDto) => Promise<ApiResult<SuccessResponseDto>>
  unpinMessage: (id: string, dto: UnpinMessageDto) => Promise<ApiResult<SuccessResponseDto>>
  forwardMessage: (id: string, dto: ForwardMessageDto) => Promise<ApiResult<MessageResponseDto>>
  scheduleMessage: (dto: ScheduleMessageDto) => Promise<ApiResult<MessageResponseDto>>
  reportMessage: (id: string, dto: ReportMessageDto) => Promise<ApiResult<SuccessResponseDto>>
  getBookmarkedMessages: (
    limit?: number,
    cursor?: string
  ) => Promise<ApiResult<PaginatedMessagesResponseDto>>
}

/**
 * Creates a configured messages service instance
 *
 * @param config - Configuration options for the messages service
 * @returns Configured messages service with API methods
 */
export function createMessagesService(config: MessagesServiceConfig): MessagesService {
  const { apiClient, endpointPrefix = 'messaging/messages' } = config

  /**
   * Send a new message
   * @param dto - Message data
   * @returns API response with created message
   */
  const sendMessage = async (dto: SendMessageDto) => {
    return await apiClient.post<MessageResponseDto>(endpointPrefix, dto)
  }

  /**
   * Get messages in a conversation with cursor-based pagination
   * @param dto - Query parameters for filtering and pagination
   * @returns API response with paginated messages
   */
  const getMessages = async (dto: GetMessagesDto) => {
    const { signal, ...params } = dto
    return await apiClient.get<PaginatedMessagesResponseDto>(endpointPrefix, {
      params,
      signal,
    })
  }

  /**
   * Get messages where current user was mentioned
   * @param limit - Maximum number of messages to return
   * @param cursor - Pagination cursor
   * @returns API response with paginated mentioned messages
   */
  const getMentionedMessages = async (limit?: number, cursor?: string) => {
    return await apiClient.get<PaginatedMessagesResponseDto>(`${endpointPrefix}/mentions`, {
      params: { limit, cursor },
    })
  }

  /**
   * Get a single message by ID
   * @param id - Message ID
   * @returns API response with message data
   */
  const getMessageById = async (id: string) => {
    return await apiClient.get<MessageResponseDto>(`${endpointPrefix}/${id}`)
  }

  /**
   * Get message thread/reply chain
   * @param id - Message ID
   * @returns API response with array of messages in thread
   */
  const getMessageThread = async (id: string) => {
    return await apiClient.get<MessageResponseDto[]>(`${endpointPrefix}/${id}/thread`)
  }

  /**
   * Get edit history for a message
   * @param id - Message ID
   * @param limit - Maximum number of history records to return
   * @param cursor - Pagination cursor
   * @returns API response with edit history records
   */
  const getMessageEditHistory = async (id: string, limit?: number, cursor?: string) => {
    return await apiClient.get<EditHistoryResponseDto[]>(`${endpointPrefix}/${id}/edit-history`, {
      params: { limit, cursor },
    })
  }

  /**
   * Edit an existing message
   * @param id - Message ID
   * @param dto - Edit data (new content)
   * @returns API response with updated message
   */
  const editMessage = async (id: string, dto: EditMessageDto) => {
    return await apiClient.patch<MessageResponseDto>(`${endpointPrefix}/${id}`, dto)
  }

  /**
   * Delete a message (soft or hard delete)
   * @param id - Message ID
   * @param dto - Delete options
   * @returns API response with success message
   */
  const deleteMessage = async (id: string, dto: DeleteMessageDto) => {
    return await apiClient.del<SuccessResponseDto>(`${endpointPrefix}/${id}`, {
      data: dto,
    })
  }

  /**
   * Mark a message as read
   * @param id - Message ID
   * @param dto - Read receipt data
   * @returns API response with success message
   */
  const markAsRead = async (id: string, dto: MarkAsReadDto) => {
    return await apiClient.post<SuccessResponseDto>(`${endpointPrefix}/${id}/read`, dto)
  }

  /**
   * Mark a message as delivered
   * @param id - Message ID
   * @param dto - Delivery receipt data
   * @returns API response with success message
   */
  const markAsDelivered = async (id: string, dto: MarkAsDeliveredDto) => {
    return await apiClient.post<SuccessResponseDto>(`${endpointPrefix}/${id}/delivered`, dto)
  }

  const markAllDelivered = async () => {
    return await apiClient.post<SuccessResponseDto>(`${endpointPrefix}/mark-all-delivered`, {})
  }

  /**
   * Add a reaction to a message
   * @param id - Message ID
   * @param dto - Reaction data (emoji)
   * @returns API response with created reaction
   */
  const addReaction = async (id: string, dto: AddReactionDto) => {
    return await apiClient.post<ReactionResponseDto>(`${endpointPrefix}/${id}/reactions`, dto)
  }

  /**
   * Remove a reaction from a message
   * @param id - Message ID
   * @param dto - Reaction removal data
   * @returns API response with success message
   */
  const removeReaction = async (id: string, dto: RemoveReactionDto) => {
    return await apiClient.del<SuccessResponseDto>(`${endpointPrefix}/${id}/reactions`, {
      data: dto,
    })
  }

  /**
   * Bookmark a message for later reference
   * @param id - Message ID
   * @param dto - Bookmark data
   * @returns API response with created bookmark
   */
  const bookmarkMessage = async (id: string, dto: BookmarkMessageDto) => {
    return await apiClient.post<BookmarkResponseDto>(`${endpointPrefix}/${id}/bookmark`, dto)
  }

  /**
   * Remove bookmark from a message
   * @param id - Message ID
   * @param dto - Unbookmark data
   * @returns API response with success message
   */
  const unbookmarkMessage = async (id: string, dto: UnbookmarkMessageDto) => {
    return await apiClient.del<SuccessResponseDto>(`${endpointPrefix}/${id}/bookmark`, {
      data: dto,
    })
  }

  /**
   * Pin a message in a conversation
   * @param id - Message ID
   * @param dto - Pin data
   * @returns API response with success message
   */
  const pinMessage = async (id: string, dto: PinMessageDto) => {
    return await apiClient.post<SuccessResponseDto>(`${endpointPrefix}/${id}/pin`, dto)
  }

  /**
   * Unpin a message from a conversation
   * @param id - Message ID
   * @param dto - Unpin data
   * @returns API response with success message
   */
  const unpinMessage = async (id: string, dto: UnpinMessageDto) => {
    return await apiClient.del<SuccessResponseDto>(`${endpointPrefix}/${id}/pin`, {
      data: dto,
    })
  }

  /**
   * Forward a message to another conversation
   * @param id - Message ID
   * @param dto - Forward data (target conversation IDs)
   * @returns API response with forwarded message
   */
  const forwardMessage = async (id: string, dto: ForwardMessageDto) => {
    return await apiClient.post<MessageResponseDto>(`${endpointPrefix}/${id}/forward`, dto)
  }

  /**
   * Schedule a message to be sent at a later time
   * @param dto - Schedule data (message content and scheduled time)
   * @returns API response with scheduled message
   */
  const scheduleMessage = async (dto: ScheduleMessageDto) => {
    return await apiClient.post<MessageResponseDto>(`${endpointPrefix}/schedule`, dto)
  }

  /**
   * Report a message for inappropriate content
   * @param id - Message ID
   * @param dto - Report data (reason, description)
   * @returns API response with success message
   */
  const reportMessage = async (id: string, dto: ReportMessageDto) => {
    return await apiClient.post<SuccessResponseDto>(`${endpointPrefix}/${id}/report`, dto)
  }

  /**
   * Get all bookmarked messages for the current user
   * @param limit - Maximum number of messages to return
   * @param cursor - Pagination cursor
   * @returns API response with paginated bookmarked messages
   */
  const getBookmarkedMessages = async (limit?: number, cursor?: string) => {
    return await apiClient.get<PaginatedMessagesResponseDto>(`${endpointPrefix}/bookmarks`, {
      params: { limit, cursor },
    })
  }

  return {
    sendMessage,
    getMessages,
    getMentionedMessages,
    getMessageById,
    getMessageThread,
    getMessageEditHistory,
    editMessage,
    deleteMessage,
    markAsRead,
    markAsDelivered,
    markAllDelivered,
    addReaction,
    removeReaction,
    bookmarkMessage,
    unbookmarkMessage,
    pinMessage,
    unpinMessage,
    forwardMessage,
    scheduleMessage,
    reportMessage,
    getBookmarkedMessages,
  }
}
