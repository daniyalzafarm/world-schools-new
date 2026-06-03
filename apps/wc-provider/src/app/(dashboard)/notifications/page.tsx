'use client'

import {
  getFiltersFor,
  NotificationsPageContent,
  useNotificationsPage,
} from '@world-schools/wc-frontend-utils'
import { useRouter } from 'next/navigation'
import { notificationsService } from '@/services/notifications.services'
import { useWsNotifications } from '@/hooks/useWsNotifications'

// Phase 14d — filter set extracted to wc-frontend-utils (`getFiltersFor`).
const PROVIDER_FILTERS = getFiltersFor('provider')

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
    filters: PROVIDER_FILTERS,
  })

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <NotificationsPageContent {...notificationsPage} onNavigate={url => router.push(url)} />
    </div>
  )
}
