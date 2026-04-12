import { useEffect } from 'react'
import {
  type WsBookingRequestReceivedPayload,
  type WsBookingStatusPayload,
  WsServerEvent,
} from '@world-schools/wc-types'
import { globalWsService } from '@/lib/websocket-instance'

interface UseBookingWebSocketOptions {
  /** Called when a parent submits a new booking request to this provider */
  onBookingRequestReceived?: (payload: WsBookingRequestReceivedPayload) => void
  /** Called when a booking status changes (e.g., after provider accepts/declines) */
  onBookingStatusChanged?: (payload: WsBookingStatusPayload) => void
}

/**
 * Listens for real-time booking lifecycle events pushed by the server.
 *
 * Provider staff receive:
 *  - `booking:request_received` when a parent submits a new booking request
 *  - `booking:status_changed` after a booking is accepted or declined
 *    (confirms the action taken by any staff member)
 *
 * Wire this at the provider dashboard root (e.g. inside the layout or
 * a providers.tsx wrapper) so staff see incoming requests immediately
 * without polling.
 *
 * @example
 * ```tsx
 * useBookingWebSocket({
 *   onBookingRequestReceived: (payload) => {
 *     toast.info(`New booking request for ${payload.campName} — ${payload.bookingGroupNumber}`)
 *     queryClient.invalidateQueries({ queryKey: ['provider-bookings'] })
 *   },
 *   onBookingStatusChanged: (payload) => {
 *     queryClient.invalidateQueries({ queryKey: ['provider-bookings'] })
 *   },
 * })
 * ```
 */
export function useBookingWebSocket({
  onBookingRequestReceived,
  onBookingStatusChanged,
}: UseBookingWebSocketOptions = {}) {
  useEffect(() => {
    const unsubs: (() => void)[] = []

    if (onBookingRequestReceived) {
      unsubs.push(
        globalWsService.on(WsServerEvent.BookingRequestReceived, onBookingRequestReceived)
      )
    }

    if (onBookingStatusChanged) {
      unsubs.push(globalWsService.on(WsServerEvent.BookingStatusChanged, onBookingStatusChanged))
    }

    return () => {
      unsubs.forEach(unsub => unsub())
    }
  }, [onBookingRequestReceived, onBookingStatusChanged])
}
