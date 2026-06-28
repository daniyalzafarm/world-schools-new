'use client'

import {
  getFiltersFor,
  NotificationsPageContent,
  useNotificationsPage,
} from '@world-schools/wc-frontend-utils'
import { useRouter } from 'next/navigation'
import { notificationsService } from '@/services/notifications.services'
import { useWsNotifications } from '@/hooks/useWsNotifications'

const PARENT_FILTERS = getFiltersFor('parent')

export default function NotificationsPage() {
  const router = useRouter()
  const { latestNotification } = useWsNotifications()

  const notificationsPage = useNotificationsPage({
    fetchNotifications: ({ cursor } = {}) =>
      notificationsService
        .getAll(cursor)
        .then(r => (r.success ? r.data : { data: [], hasMore: false, nextCursor: null })),

    markAsRead: id => notificationsService.markAsRead(id).then(() => undefined),

    markAllAsRead: () => notificationsService.markAllAsRead().then(() => undefined),

    latestNotification,
    filters: PARENT_FILTERS,
  })

  return <NotificationsPageContent {...notificationsPage} onNavigate={url => router.push(url)} />
}
