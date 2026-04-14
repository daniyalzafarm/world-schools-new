import { useEffect } from 'react'
import { type WsOnboardingStatusChangedPayload, WsServerEvent } from '@world-schools/wc-types'
import { globalWsService } from '@/lib/websocket-instance'

interface UseOnboardingStatusWebSocketOptions {
  /** Called when the super-admin changes the provider's approval status */
  onStatusChanged?: (payload: WsOnboardingStatusChangedPayload) => void
}

/**
 * Listens for real-time onboarding status change events pushed by the server.
 *
 * The server emits `onboarding:status_changed` when a super-admin approves,
 * rejects, requests info from, or suspends a provider application. Wire this
 * on the status page so providers see the decision instantly without polling.
 *
 * @example
 * ```tsx
 * useOnboardingStatusWebSocket({
 *   onStatusChanged: () => {
 *     fetchStatus()
 *   },
 * })
 * ```
 */
export function useOnboardingStatusWebSocket({
  onStatusChanged,
}: UseOnboardingStatusWebSocketOptions = {}) {
  useEffect(() => {
    if (!onStatusChanged) return

    const unsub = globalWsService.on(WsServerEvent.OnboardingStatusChanged, onStatusChanged)
    return unsub
  }, [onStatusChanged])
}
