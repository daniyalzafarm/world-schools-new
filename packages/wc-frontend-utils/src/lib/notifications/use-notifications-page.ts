import { useCallback, useEffect, useRef, useState } from 'react'
import { NotificationType, type WsNotificationPayload } from '@world-schools/wc-types'

export type NotificationFilter = 'all' | 'unread' | 'bookings' | 'messages' | 'quotes'

const BOOKING_TYPES = new Set<string>([
  NotificationType.BookingAccepted,
  NotificationType.BookingDeclined,
  NotificationType.BookingExpired,
  NotificationType.BookingRequestReceived,
])

const MESSAGE_TYPES = new Set<string>([
  NotificationType.MessageNew,
  NotificationType.SupportTicketUpdated,
])

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
}

export interface UseNotificationsPageResult {
  filteredNotifications: WsNotificationPayload[]
  filter: NotificationFilter
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
}: UseNotificationsPageOptions): UseNotificationsPageResult {
  const [notifications, setNotifications] = useState<WsNotificationPayload[]>([])
  const [filter, setFilter] = useState<NotificationFilter>('all')
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

  // Prepend real-time notifications from WebSocket
  useEffect(() => {
    if (!latestNotification) return
    setNotifications(prev => {
      if (prev.some(n => n.id === latestNotification.id)) return prev
      return [latestNotification, ...prev]
    })
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
    if (isLoadingMore || !hasMore || !nextCursor) return
    setIsLoadingMore(true)
    fetchRef
      .current({ cursor: nextCursor })
      .then(res => {
        setNotifications(prev => [...prev, ...res.data])
        setHasMore(res.hasMore)
        setNextCursor(res.nextCursor)
      })
      .catch(error => {
        console.error('Error loading more notifications:', error)
      })
      .finally(() => setIsLoadingMore(false))
  }, [isLoadingMore, hasMore, nextCursor])

  const filteredNotifications = notifications.filter(n => {
    switch (filter) {
      case 'unread':
        return !n.isRead
      case 'bookings':
        return BOOKING_TYPES.has(n.type)
      case 'messages':
        return MESSAGE_TYPES.has(n.type)
      case 'quotes':
        return false // no quote notification type yet
      default:
        return true
    }
  })

  return {
    filteredNotifications,
    filter,
    isLoading,
    isLoadingMore,
    isMarkingAllRead,
    // Only paginate in the 'all' view — filtered views operate on the loaded set
    hasMore: hasMore && filter === 'all',
    unreadCount: notifications.filter(n => !n.isRead).length,
    onFilterChange: setFilter,
    onMarkAsRead,
    onMarkAllAsRead,
    onLoadMore,
  }
}
