import { useEffect } from 'react'
import { type WsBookingStatusPayload, WsServerEvent } from '@world-schools/wc-types'
import { globalWsService } from '@/lib/websocket-instance'

interface UseBookingWebSocketOptions {
  /** Called when the provider accepts or declines a booking */
  onBookingStatusChanged?: (payload: WsBookingStatusPayload) => void
}

/**
 * Listens for real-time booking lifecycle events pushed by the server.
 *
 * Parents receive `booking:status_changed` when a provider accepts or
 * declines their booking request. Wire this at the layout or page level
 * (e.g. inside a booking detail page or the dashboard root) so status
 * changes are surfaced immediately without a manual refresh.
 *
 * @example
 * ```tsx
 * useBookingWebSocket({
 *   onBookingStatusChanged: (payload) => {
 *     if (payload.newStatus === 'accepted') {
 *       toast.success(`Your booking for ${payload.campName} was accepted!`)
 *       router.push(`/bookings/${payload.bookingGroupId}`)
 *     } else {
 *       toast.error(`Your booking for ${payload.campName} was declined.`)
 *     }
 *   },
 * })
 * ```
 */
export function useBookingWebSocket({ onBookingStatusChanged }: UseBookingWebSocketOptions = {}) {
  useEffect(() => {
    const unsubs: (() => void)[] = []

    if (onBookingStatusChanged) {
      unsubs.push(globalWsService.on(WsServerEvent.BookingStatusChanged, onBookingStatusChanged))
    }

    return () => {
      unsubs.forEach(unsub => unsub())
    }
  }, [onBookingStatusChanged])
}
