import apiClient from '@/utils/api-client'
import { createSupportTicketsService } from '@world-schools/wc-frontend-utils'

/**
 * Support tickets service for the parent-facing Help Center.
 * All types and logic live in the shared @world-schools/wc-frontend-utils factory.
 */
export const supportTicketsService = createSupportTicketsService(apiClient, '/user')
