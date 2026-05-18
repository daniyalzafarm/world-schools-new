import apiClient from '@/utils/api-client'
import type { ApiResult } from '@world-schools/wc-types'

export interface SystemSettings {
  defaultAppFee: number
  updatedAt: string
}

export interface UpdateSystemSettingsRequest {
  defaultAppFee: number
}

/**
 * Fetch system-level settings (singleton — created with defaults if none exist).
 */
export async function getSystemSettings(): Promise<ApiResult<SystemSettings>> {
  return apiClient.get<SystemSettings>('superadmin/settings')
}

/**
 * Update system-level settings.
 */
export async function updateSystemSettings(
  data: UpdateSystemSettingsRequest
): Promise<ApiResult<SystemSettings>> {
  return apiClient.put<SystemSettings>('superadmin/settings', data)
}
