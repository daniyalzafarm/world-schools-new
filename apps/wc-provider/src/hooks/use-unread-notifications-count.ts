import { useCallback, useEffect, useRef, useState } from 'react'
import { type WsNotificationPayload, WsServerEvent } from '@world-schools/wc-types'
import { useNotifications } from '@world-schools/wc-frontend-utils'
import { eventBus } from '@world-schools/wc-utils'

import { useAuthStore } from '@/stores/auth-store'
import { globalWsService } from '@/lib/websocket-instance'
import apiClient from '@/utils/api-client'

const EVENT_BUS_SUBSCRIPTION_ID = 'sidebar-notifications-count'

export function useUnreadNotificationsCount(): number {
  const [count, setCount] = useState(0)
  const user = useAuthStore(s => s.user)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { playSound, showNotification } = useNotifications({
    storageKey: 'wc_provider_notification_preferences',
  })

  const fetchCount = useCallback(async () => {
    if (!user?.id) return
    const result = await apiClient.get<{ count: number }>('/provider/notifications/unread-count')
    if (result.success) {
      setCount(result.data.count)
    }
  }, [user?.id])

  const debouncedFetch = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(fetchCount, 1500)
  }, [fetchCount])

  useEffect(() => {
    if (!user?.id) {
      setCount(0)
      return
    }

    void fetchCount()

    const unsubNotification = globalWsService.on(
      WsServerEvent.NotificationNew,
      (payload: WsNotificationPayload) => {
        setCount(prev => prev + 1)
        playSound()
        showNotification({
          title: payload.title,
          body: payload.body ?? '',
          url: '/notifications',
          tag: `notification-${payload.id}`,
        })
      }
    )

    const unsubReconnect = globalWsService.on('connection:established', () => {
      debouncedFetch()
    })

    eventBus.$on('notifications:read', EVENT_BUS_SUBSCRIPTION_ID, () => debouncedFetch())

    return () => {
      unsubNotification()
      unsubReconnect()
      eventBus.$off('notifications:read', EVENT_BUS_SUBSCRIPTION_ID)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [user?.id, fetchCount, debouncedFetch, playSound, showNotification])

  return count
}
