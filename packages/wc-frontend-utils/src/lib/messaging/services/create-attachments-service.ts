/**
 * Attachments Service Factory for World Schools Applications
 *
 * This factory creates a small service for working with message
 * attachments over HTTP (file uploads only – metadata comes back
 * on the MessageResponseDto after sending the message).
 */

import type { ApiClient, ApiResult } from '@world-schools/wc-utils'

/**
 * Shape of the attachment object returned directly from the
 * `/messaging/attachments/upload` endpoint.
 */
export interface UploadAttachmentResponse {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  url: string
  thumbnailUrl?: string
}

export interface AttachmentsServiceConfig {
  /**
   * Configured API client instance
   */
  apiClient: ApiClient

  /**
   * Prefix for attachment endpoints (e.g., 'messaging/attachments')
   * @default 'messaging/attachments'
   */
  endpointPrefix?: string
}

export interface AttachmentsService {
  /**
   * Upload a single attachment file.
   *
   * Note: attachments are initially stored with a temporary
   * messageId on the backend. They become "real" message
   * attachments when `sendMessage` is called with `attachmentIds`.
   */
  uploadAttachment: (
    file: File | Blob,
    options?: { messageId?: string }
  ) => Promise<ApiResult<UploadAttachmentResponse>>
}

export function createAttachmentsService(config: AttachmentsServiceConfig): AttachmentsService {
  const { apiClient, endpointPrefix = 'messaging/attachments' } = config

  const uploadAttachment: AttachmentsService['uploadAttachment'] = async (file, options) => {
    const additionalData: Record<string, any> = {}

    if (options?.messageId) {
      additionalData['messageId'] = options['messageId']
    }

    return await apiClient.postFile<UploadAttachmentResponse>(
      `${endpointPrefix}/upload`,
      file,
      additionalData
    )
  }

  return {
    uploadAttachment,
  }
}
