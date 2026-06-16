/**
 * Conversations Service Factory for World Schools Applications
 *
 * This factory creates a configured conversations service layer that handles
 * all conversation-related API calls. It provides a clean separation between
 * the API layer and state management.
 *
 * @example
 * ```typescript
 * import { createConversationsService } from '@world-schools/wc-frontend-utils'
 * import apiClient from '@/utils/api-client'
 *
 * const conversationsService = createConversationsService({
 *   apiClient,
 *   endpointPrefix: 'messaging/conversations'
 * })
 *
 * // Use the service
 * const response = await conversationsService.getConversations({ userId: 'user-id' })
 * ```
 */

import type { ApiClient, ApiResult } from '@world-schools/wc-utils'
import type {
  CreateConversationDto,
  GetConversationsDto,
  UpdateConversationSettingsDto,
  AssignConversationDto,
  UpdateConversationStatusDto,
  AddLabelDto,
  CreateLabelDto,
  ConversationResponseDto,
  PaginatedConversationsResponseDto,
  ConversationMetricsResponseDto,
  LabelResponseDto,
  SuccessResponseDto,
} from '../types'

/**
 * Configuration options for creating a conversations service instance
 */
export interface ConversationsServiceConfig {
  /**
   * Configured API client instance
   */
  apiClient: ApiClient

  /**
   * Prefix for conversation endpoints (e.g., 'messaging/conversations')
   * @default 'messaging/conversations'
   */
  endpointPrefix?: string
}

/**
 * Conversations service instance returned by createConversationsService factory
 */
export interface ConversationsService {
  createConversation: (dto: CreateConversationDto) => Promise<ApiResult<ConversationResponseDto>>
  getConversations: (
    dto: GetConversationsDto
  ) => Promise<ApiResult<PaginatedConversationsResponseDto>>
  getConversationById: (id: string) => Promise<ApiResult<ConversationResponseDto>>
  updateConversationSettings: (
    id: string,
    dto: UpdateConversationSettingsDto
  ) => Promise<ApiResult<ConversationResponseDto>>
  assignConversation: (
    id: string,
    dto: AssignConversationDto
  ) => Promise<ApiResult<ConversationResponseDto>>
  updateConversationStatus: (
    id: string,
    dto: UpdateConversationStatusDto
  ) => Promise<ApiResult<ConversationResponseDto>>
  addLabel: (id: string, dto: AddLabelDto) => Promise<ApiResult<SuccessResponseDto>>
  removeLabel: (id: string, labelId: string) => Promise<ApiResult<SuccessResponseDto>>
  getConversationMetrics: (id: string) => Promise<ApiResult<ConversationMetricsResponseDto>>
  createLabel: (dto: CreateLabelDto) => Promise<ApiResult<LabelResponseDto>>
  getLabels: () => Promise<ApiResult<LabelResponseDto[]>>
  updateLabel: (id: string, dto: Partial<CreateLabelDto>) => Promise<ApiResult<LabelResponseDto>>
  deleteLabel: (id: string) => Promise<ApiResult<SuccessResponseDto>>
  archiveConversation: (id: string) => Promise<ApiResult<ConversationResponseDto>>
  unarchiveConversation: (id: string) => Promise<ApiResult<ConversationResponseDto>>
  markAllAsRead: (conversationId: string) => Promise<ApiResult<{ markedAsRead: number }>>
  markConversationUnread: (
    conversationId: string
  ) => Promise<ApiResult<{ manuallyUnread: boolean }>>
}

/**
 * Creates a configured conversations service instance
 *
 * @param config - Configuration options for the conversations service
 * @returns Configured conversations service with API methods
 */
export function createConversationsService(
  config: ConversationsServiceConfig
): ConversationsService {
  const { apiClient, endpointPrefix = 'messaging/conversations' } = config

  /**
   * Create a new conversation or return existing one
   * @param dto - Conversation creation data
   * @returns API response with conversation data
   */
  const createConversation = async (dto: CreateConversationDto) => {
    return await apiClient.post<ConversationResponseDto>(endpointPrefix, dto)
  }

  /**
   * Get all conversations for the current user with optional filters
   * @param dto - Query parameters for filtering and pagination
   * @returns API response with paginated conversations
   */
  const getConversations = async (dto: GetConversationsDto) => {
    return await apiClient.get<PaginatedConversationsResponseDto>(endpointPrefix, {
      params: dto,
    })
  }

  /**
   * Get a single conversation by ID
   * @param id - Conversation ID
   * @returns API response with conversation data
   */
  const getConversationById = async (id: string) => {
    return await apiClient.get<ConversationResponseDto>(`${endpointPrefix}/${id}`)
  }

  /**
   * Update conversation settings (pin, star, mute, archive)
   * @param id - Conversation ID
   * @param dto - Settings to update
   * @returns API response with updated conversation
   */
  const updateConversationSettings = async (id: string, dto: UpdateConversationSettingsDto) => {
    return await apiClient.patch<ConversationResponseDto>(`${endpointPrefix}/${id}/settings`, dto)
  }

  /**
   * Assign a conversation to a user (admin/support feature)
   * @param id - Conversation ID
   * @param dto - Assignment data
   * @returns API response with updated conversation
   */
  const assignConversation = async (id: string, dto: AssignConversationDto) => {
    return await apiClient.post<ConversationResponseDto>(`${endpointPrefix}/${id}/assign`, dto)
  }

  /**
   * Update conversation status (open, resolved, closed)
   * @param id - Conversation ID
   * @param dto - Status update data
   * @returns API response with updated conversation
   */
  const updateConversationStatus = async (id: string, dto: UpdateConversationStatusDto) => {
    return await apiClient.patch<ConversationResponseDto>(`${endpointPrefix}/${id}/status`, dto)
  }

  /**
   * Add a label to a conversation
   * @param id - Conversation ID
   * @param dto - Label assignment data
   * @returns API response with success message
   */
  const addLabel = async (id: string, dto: AddLabelDto) => {
    return await apiClient.post<SuccessResponseDto>(`${endpointPrefix}/${id}/labels`, dto)
  }

  /**
   * Remove a label from a conversation
   * @param id - Conversation ID
   * @param labelId - Label ID to remove
   * @returns API response with success message
   */
  const removeLabel = async (id: string, labelId: string) => {
    return await apiClient.del<SuccessResponseDto>(`${endpointPrefix}/${id}/labels/${labelId}`)
  }

  /**
   * Get conversation metrics (total messages, unread count, etc.)
   * @param id - Conversation ID
   * @returns API response with conversation metrics
   */
  const getConversationMetrics = async (id: string) => {
    return await apiClient.get<ConversationMetricsResponseDto>(`${endpointPrefix}/${id}/metrics`)
  }

  /**
   * Create a new conversation label
   * @param dto - Label creation data
   * @returns API response with created label
   */
  const createLabel = async (dto: CreateLabelDto) => {
    return await apiClient.post<LabelResponseDto>('messaging/labels', dto)
  }

  /**
   * Get all available conversation labels
   * @returns API response with array of labels
   */
  const getLabels = async () => {
    return await apiClient.get<LabelResponseDto[]>('messaging/labels')
  }

  /**
   * Update a conversation label
   * @param id - Label ID
   * @param dto - Label update data
   * @returns API response with updated label
   */
  const updateLabel = async (id: string, dto: Partial<CreateLabelDto>) => {
    return await apiClient.patch<LabelResponseDto>(`messaging/labels/${id}`, dto)
  }

  /**
   * Delete a conversation label
   * @param id - Label ID
   * @returns API response with success message
   */
  const deleteLabel = async (id: string) => {
    return await apiClient.del<SuccessResponseDto>(`messaging/labels/${id}`)
  }

  /**
   * Archive a conversation (helper method)
   * @param id - Conversation ID
   * @returns API response with updated conversation
   */
  const archiveConversation = async (id: string) => {
    return await updateConversationSettings(id, {
      conversationId: id,
      userId: '', // Will be set by the backend from auth context
      archived: true,
    })
  }

  /**
   * Unarchive a conversation (helper method)
   * @param id - Conversation ID
   * @returns API response with updated conversation
   */
  const unarchiveConversation = async (id: string) => {
    return await updateConversationSettings(id, {
      conversationId: id,
      userId: '', // Will be set by the backend from auth context
      archived: false,
    })
  }

  /**
   * Mark all messages in a conversation as read for the current user.
   * Resets the conversation's unreadCount to 0 in the database atomically.
   */
  const markAllAsRead = async (conversationId: string) => {
    return await apiClient.post<{ markedAsRead: number }>(
      `${endpointPrefix}/${conversationId}/mark-read`,
      {}
    )
  }

  /**
   * Mark a conversation as unread for the current user (manual, WhatsApp-style).
   */
  const markConversationUnread = async (conversationId: string) => {
    return await apiClient.post<{ manuallyUnread: boolean }>(
      `${endpointPrefix}/${conversationId}/mark-unread`,
      {}
    )
  }

  return {
    createConversation,
    getConversations,
    getConversationById,
    updateConversationSettings,
    assignConversation,
    updateConversationStatus,
    addLabel,
    removeLabel,
    getConversationMetrics,
    createLabel,
    getLabels,
    updateLabel,
    deleteLabel,
    archiveConversation,
    unarchiveConversation,
    markAllAsRead,
    markConversationUnread,
  }
}
