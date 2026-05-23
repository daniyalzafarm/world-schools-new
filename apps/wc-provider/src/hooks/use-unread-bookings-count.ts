import { useCallback, useEffect, useRef, useState } from 'react'
import { type WsBookingRequestReceivedPayload, WsServerEvent } from '@world-schools/wc-types'
import { useNotifications } from '@world-schools/wc-frontend-utils'
import { eventBus } from '@world-schools/wc-utils'

import { useAuthStore } from '@/stores/auth-store'
import { globalWsService } from '@/lib/websocket-instance'
import apiClient from '@/utils/api-client'

const EVENT_BUS_SUBSCRIPTION_ID = 'sidebar-bookings-count'

export function useUnreadBookingsCount(): number {
  const [count, setCount] = useState(0)
  const user = useAuthStore(s => s.user)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { playSound, showNotification } = useNotifications({
    storageKey: 'wc_provider_notification_preferences',
  })

  const fetchCount = useCallback(async () => {
    if (!user?.id) return
    const result = await apiClient.get<{ count: number }>('/provider/booking-groups/requests-count')
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

    const unsubBooking = globalWsService.on(
      WsServerEvent.BookingRequestReceived,
      (payload: WsBookingRequestReceivedPayload) => {
        setCount(prev => prev + 1)
        playSound()
        showNotification({
          title: 'New booking request',
          body: `${payload.campName} — ${payload.bookingGroupNumber}`,
          url: '/bookings',
          tag: `booking-${payload.bookingGroupId}`,
        })
      }
    )

    const unsubReconnect = globalWsService.on('connection:established', () => {
      debouncedFetch()
    })

    eventBus.$on('bookings:read', EVENT_BUS_SUBSCRIPTION_ID, () => debouncedFetch())

    return () => {
      unsubBooking()
      unsubReconnect()
      eventBus.$off('bookings:read', EVENT_BUS_SUBSCRIPTION_ID)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [user?.id, fetchCount, debouncedFetch, playSound, showNotification])

  return count
}
