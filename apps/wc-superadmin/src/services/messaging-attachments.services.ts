import apiClient from '@/utils/api-client'
import { createAttachmentsService } from '@world-schools/wc-frontend-utils'

export const messagingAttachmentsService = createAttachmentsService({
  apiClient,
  endpointPrefix: 'superadmin/messaging/attachments',
})
