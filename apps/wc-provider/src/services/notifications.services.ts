import apiClient, { type ApiResult } from '@/utils/api-client'
import type { NotificationsPageResponse } from '@world-schools/wc-frontend-utils'
import { eventBus } from '@world-schools/wc-utils'

export const notificationsService = {
  async getAll(cursor?: string): Promise<ApiResult<NotificationsPageResponse>> {
    const url = cursor ? `/notifications?cursor=${encodeURIComponent(cursor)}` : '/notifications'
    return apiClient.get<NotificationsPageResponse>(url)
  },

  async markAsRead(id: string): Promise<ApiResult<{ success: true }>> {
    const result = await apiClient.patch<{ success: true }>(`/notifications/${id}/read`, {})
    if (result.success) eventBus.$emit('notifications:read', { id })
    return result
  },

  async markAllAsRead(): Promise<ApiResult<{ success: true }>> {
    const result = await apiClient.patch<{ success: true }>('/notifications/read-all', {})
    if (result.success) eventBus.$emit('notifications:read', { all: true })
    return result
  },
}
