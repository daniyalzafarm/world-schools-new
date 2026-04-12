import { useCallback, useEffect, useState } from 'react'
import { WsServerEvent, type WsNotificationPayload } from '@world-schools/wc-types'
import type { GlobalWebSocketService } from './create-websocket-service'

interface UseWsNotificationsOptions {
  /** The app's global WebSocket service instance */
  wsService: GlobalWebSocketService
  /**
   * Called once on mount to fetch the initial unread count from the REST API.
   * Should resolve to a number; errors are swallowed (badge populates from WS events instead).
   */
  getUnreadCount: () => Promise<number>
}

/**
 * Subscribes to `notification:new` WebSocket events and keeps an unread count
 * in sync with the REST API.
 *
 * - Calls `getUnreadCount()` on mount so the badge is correct even when events
 *   fired while the user was offline.
 * - Increments `unreadCount` on each incoming `notification:new` event.
 * - Exposes `resetUnreadCount()` to call after the user reads their notifications
 *   (e.g. on drawer open or after `PATCH /notifications/read-all`).
 *
 * @example
 * ```tsx
 * // In each app, pass the app-specific wsService and API client:
 * const { unreadCount, latestNotification, resetUnreadCount } = useWsNotifications({
 *   wsService: globalWsService,
 *   getUnreadCount: () =>
 *     apiClient.get<{ count: number }>('/notifications/unread-count')
 *       .then(r => (r.success ? r.data.count : 0)),
 * })
 * ```
 */
export function useWsNotifications({ wsService, getUnreadCount }: UseWsNotificationsOptions) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [latestNotification, setLatestNotification] = useState<WsNotificationPayload | null>(null)

  // Fetch initial unread count on mount
  useEffect(() => {
    getUnreadCount()
      .then(count => setUnreadCount(count))
      .catch(() => {
        // Non-critical — badge populates from WS events
      })
  }, []) // intentionally empty — fetch unread count once on mount only

  // Subscribe to real-time notification events
  useEffect(() => {
    const unsubNotification = wsService.on(
      WsServerEvent.NotificationNew,
      (payload: WsNotificationPayload) => {
        setUnreadCount(prev => prev + 1)
        setLatestNotification(payload)
      }
    )

    // Re-sync unread count on every (re)connect — catches notifications that
    // arrived while the socket was disconnected.
    const unsubReconnect = wsService.on('connection:established', () => {
      getUnreadCount()
        .then(count => setUnreadCount(count))
        .catch(() => {
          // Non-critical
        })
    })

    return () => {
      unsubNotification()
      unsubReconnect()
    }
  }, [wsService, getUnreadCount])

  const resetUnreadCount = useCallback(() => setUnreadCount(0), [])

  return { unreadCount, latestNotification, resetUnreadCount }
}
