import { useCallback, useEffect, useRef, useState } from 'react'
import { type WsApplicationSubmittedPayload, WsServerEvent } from '@world-schools/wc-types'
import { useNotifications } from '@world-schools/wc-frontend-utils'
import { eventBus } from '@world-schools/wc-utils'

import { useAuthStore } from '@/stores/auth-store'
import { globalWsService } from '@/lib/websocket-instance'
import apiClient from '@/utils/api-client'

const EVENT_BUS_SUBSCRIPTION_ID = 'sidebar-applications-count'

export function useUnreadApplicationsCount(): number {
  const [count, setCount] = useState(0)
  const user = useAuthStore(s => s.user)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { playSound, showNotification } = useNotifications({
    storageKey: 'wc_superadmin_notification_preferences',
  })

  const fetchCount = useCallback(async () => {
    if (!user?.id) return
    const result = await apiClient.get<{ count: number }>(
      '/superadmin/applications/under-review-count'
    )
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

    const unsubApplication = globalWsService.on(
      WsServerEvent.ApplicationSubmitted,
      (payload: WsApplicationSubmittedPayload) => {
        setCount(prev => prev + 1)
        playSound()
        showNotification({
          title: 'New provider application',
          body: `${payload.businessName} submitted for review`,
          url: '/providers/pending-review',
          tag: `application-${payload.providerId}`,
        })
      }
    )

    const unsubReconnect = globalWsService.on('connection:established', () => {
      debouncedFetch()
    })

    eventBus.$on('applications:read', EVENT_BUS_SUBSCRIPTION_ID, () => debouncedFetch())

    return () => {
      unsubApplication()
      unsubReconnect()
      eventBus.$off('applications:read', EVENT_BUS_SUBSCRIPTION_ID)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [user?.id, fetchCount, debouncedFetch, playSound, showNotification])

  return count
}
