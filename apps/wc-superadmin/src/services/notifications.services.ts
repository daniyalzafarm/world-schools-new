import apiClient, { type ApiResult } from '@/utils/api-client'
import type { NotificationsPageResponse } from '@world-schools/wc-frontend-utils'

export const notificationsService = {
  async getAll(cursor?: string): Promise<ApiResult<NotificationsPageResponse>> {
    const url = cursor ? `/notifications?cursor=${encodeURIComponent(cursor)}` : '/notifications'
    return apiClient.get<NotificationsPageResponse>(url)
  },

  async markAsRead(id: string): Promise<ApiResult<{ success: true }>> {
    return apiClient.patch<{ success: true }>(`/notifications/${id}/read`, {})
  },

  async markAllAsRead(): Promise<ApiResult<{ success: true }>> {
    return apiClient.patch<{ success: true }>('/notifications/read-all', {})
  },
}
