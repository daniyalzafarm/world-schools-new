// Thin wrapper — injects the app's wsService and API client into the shared hook.
import { useWsNotifications as useSharedWsNotifications } from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'
import { globalWsService } from '@/lib/websocket-instance'

export function useWsNotifications() {
  return useSharedWsNotifications({
    wsService: globalWsService,
    getUnreadCount: () =>
      apiClient
        .get<{ count: number }>('/notifications/unread-count')
        .then(r => (r.success ? r.data.count : 0)),
  })
}
