/**
 * Messaging Services Barrel Export
 *
 * Central export point for all messaging service factories.
 *
 * @example
 * ```typescript
 * import {
 *   createConversationsService,
 *   createMessagesService,
 * } from '@world-schools/wc-frontend-utils'
 * import apiClient from '@/utils/api-client'
 *
 * // HTTP services
 * const conversationsService = createConversationsService({ apiClient })
 * const messagesService = createMessagesService({ apiClient })
 * ```
 */

export * from './create-conversations-service'
export * from './create-messages-service'
