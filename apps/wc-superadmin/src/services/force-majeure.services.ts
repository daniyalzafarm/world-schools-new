import apiClient from '@/utils/api-client'
import type { ApiResult } from '@world-schools/wc-types'

export interface ForceMajeureScopePayload {
  dateFrom: string
  dateTo: string
  providerId?: string
  region?: string
}

export interface ForceMajeurePreviewResult {
  affectedBookingCount: number
}

export interface ForceMajeureExecuteResult {
  eventId: string
  cancelled: number
  failed: number
  totalRefunded: string
}

export const forceMajeureService = {
  async preview(payload: ForceMajeureScopePayload): Promise<ApiResult<ForceMajeurePreviewResult>> {
    return apiClient.post<ForceMajeurePreviewResult>('superadmin/force-majeure/preview', payload)
  },

  async execute(
    payload: ForceMajeureScopePayload & { description: string; refundPlatformFee?: boolean }
  ): Promise<ApiResult<ForceMajeureExecuteResult>> {
    return apiClient.post<ForceMajeureExecuteResult>('superadmin/force-majeure/execute', payload)
  },
}
