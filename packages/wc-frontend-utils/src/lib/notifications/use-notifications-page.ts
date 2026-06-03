import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  NotificationCategory,
  categoryFor,
  type WsNotificationPayload,
} from '@world-schools/wc-types'

/**
 * Phase 11 — filters are configurable per audience. Each app passes its
 * own `filters` array (parent / provider / superadmin have different
 * meaningful tabs). A filter either references one or more
 * `NotificationCategory` values OR has a `special` predicate
 * (`'all'` / `'unread'`).
 *
 * `value` strings are app-defined and free-form — they're only used as
 * stable React keys + the current-selection identifier.
 */
export interface NotificationFilterConfig {
  value: string
  label: string
  /** Categories whose notifications fall into this bucket. */
  categories?: NotificationCategory[]
  /** Special predicate: 'all' (no filter) or 'unread' (isRead === false). */
  special?: 'all' | 'unread'
  /** When true, render the unread count badge next to the label. */
  showUnreadCount?: boolean
}

/**
 * Backward-compat alias — older call sites still pass plain string filter
 * values. Strict typing for app config happens via `NotificationFilterConfig`.
 */
export type NotificationFilter = string

/** Default filter set used when no `filters` option is passed. */
export const DEFAULT_NOTIFICATION_FILTERS: NotificationFilterConfig[] = [
  { value: 'all', label: 'All', special: 'all' },
  { value: 'unread', label: 'Unread', special: 'unread', showUnreadCount: true },
  { value: 'bookings', label: 'Bookings', categories: [NotificationCategory.Booking] },
  {
    value: 'messages',
    label: 'Messages',
    categories: [NotificationCategory.Message, NotificationCategory.Support],
  },
]

export interface NotificationsPageResponse {
  data: WsNotificationPayload[]
  hasMore: boolean
  nextCursor: string | null
}

export interface UseNotificationsPageOptions {
  fetchNotifications: (params: { cursor?: string }) => Promise<NotificationsPageResponse>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  /** Real-time notification from useWsNotifications — prepended when it arrives */
  latestNotification?: WsNotificationPayload | null
  /** Audience-specific filter set; defaults to `DEFAULT_NOTIFICATION_FILTERS`.
   *  Accepts ReadonlyArray so per-app pages can pass module-level constants
   *  (e.g. the frozen returns from `getFiltersFor(audience)`). */
  filters?: ReadonlyArray<NotificationFilterConfig>
}

export interface UseNotificationsPageResult {
  filteredNotifications: WsNotificationPayload[]
  filter: NotificationFilter
  filters: ReadonlyArray<NotificationFilterConfig>
  isLoading: boolean
  isLoadingMore: boolean
  isMarkingAllRead: boolean
  hasMore: boolean
  unreadCount: number
  onFilterChange: (filter: NotificationFilter) => void
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onLoadMore: () => void
}

export function useNotificationsPage({
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  latestNotification,
  filters = DEFAULT_NOTIFICATION_FILTERS,
}: UseNotificationsPageOptions): UseNotificationsPageResult {
  const [notifications, setNotifications] = useState<WsNotificationPayload[]>([])
  const [filter, setFilter] = useState<NotificationFilter>(filters[0]?.value ?? 'all')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const fetchRef = useRef(fetchNotifications)
  fetchRef.current = fetchNotifications

  // Fetch initial page on mount
  useEffect(() => {
    setIsLoading(true)
    fetchRef
      .current({})
      .then(res => {
        setNotifications(res.data)
        setHasMore(res.hasMore)
        setNextCursor(res.nextCursor)
      })
      .catch(error => {
        console.error('Error fetching notifications:', error)
      })
      .finally(() => setIsLoading(false))
  }, []) // intentionally empty — fetch once on mount

  // Prepend real-time notifications from WebSocket.
  //
  // Phase 14d — also reset the pagination cursor. The keyset-style cursor
  // (last loaded row's id) is technically still correct after a prepend
  // because the next page fetches strictly older rows, but a notification
  // arriving via WS between a Load-more click and the server response can
  // cause the row to land in BOTH the WS-prepended slot AND the next
  // server page. The dedup at the top of this effect prevents user-visible
  // duplication, but the cursor reset is belt-and-braces and costs at most
  // one duplicated round-trip on the next Load-more click.
  useEffect(() => {
    if (!latestNotification) return
    setNotifications(prev => {
      if (prev.some(n => n.id === latestNotification.id)) return prev
      return [latestNotification, ...prev]
    })
    setNextCursor(null)
    setHasMore(true)
  }, [latestNotification])

  const onMarkAsRead = useCallback(
    (id: string) => {
      // Optimistic update
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
      markAsRead(id).catch(() => {
        // Revert on failure
        setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: false } : n)))
      })
    },
    [markAsRead]
  )

  const onMarkAllAsRead = useCallback(() => {
    setIsMarkingAllRead(true)
    markAllAsRead()
      .then(() => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      })
      .catch(error => {
        console.error('Error marking all as read:', error)
      })
      .finally(() => setIsMarkingAllRead(false))
  }, [markAllAsRead])

  const onLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    // Phase 14d — `nextCursor` is null after a WS arrival reset; in that
    // case load from the top and dedup against the in-memory set so we
    // don't render the same row twice.
    fetchRef
      .current(nextCursor ? { cursor: nextCursor } : {})
      .then(res => {
        setNotifications(prev => {
          if (!nextCursor) {
            const seen = new Set(prev.map(n => n.id))
            const merged = [...prev]
            for (const n of res.data) if (!seen.has(n.id)) merged.push(n)
            return merged
          }
          return [...prev, ...res.data]
        })
        setHasMore(res.hasMore)
        setNextCursor(res.nextCursor)
      })
      .catch(error => {
        console.error('Error loading more notifications:', error)
      })
      .finally(() => setIsLoadingMore(false))
  }, [isLoadingMore, hasMore, nextCursor])

  const activeConfig = useMemo(
    () => filters.find(f => f.value === filter) ?? filters[0],
    [filter, filters]
  )

  const filteredNotifications = useMemo(() => {
    if (!activeConfig || activeConfig.special === 'all') return notifications
    if (activeConfig.special === 'unread') return notifications.filter(n => !n.isRead)
    if (activeConfig.categories && activeConfig.categories.length > 0) {
      const set = new Set(activeConfig.categories)
      return notifications.filter(n => set.has(categoryFor(n.type)))
    }
    return notifications
  }, [notifications, activeConfig])

  return {
    filteredNotifications,
    filter,
    filters,
    isLoading,
    isLoadingMore,
    isMarkingAllRead,
    // Only paginate in the default ('all'-style) view — filtered views
    // operate on the loaded set so the cursor doesn't skip filtered rows.
    hasMore: hasMore && activeConfig?.special === 'all',
    unreadCount: notifications.filter(n => !n.isRead).length,
    onFilterChange: setFilter,
    onMarkAsRead,
    onMarkAllAsRead,
    onLoadMore,
  }
}
