'use client'

import {
  type BulkPreferenceItem,
  NotificationPreferencesPage,
  type PreferenceRow,
  useNotificationPreferences,
} from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'

// Phase 12 — parent notification preferences page. The shared component +
// hook in wc-frontend-utils handles all rendering + optimistic state; this
// file just wires the API calls. The backend filters preferences to the
// parent audience automatically from the authenticated user.
export default function NotificationPreferencesParentPage() {
  const prefs = useNotificationPreferences({
    fetchPreferences: async () => {
      const res = await apiClient.get<{ items: PreferenceRow[] }>('/user/notification-preferences')
      return res.success ? res.data.items : []
    },
    bulkUpdate: async (items: BulkPreferenceItem[]) => {
      await apiClient.patch('/user/notification-preferences', { items })
    },
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <NotificationPreferencesPage {...prefs} />
    </div>
  )
}
