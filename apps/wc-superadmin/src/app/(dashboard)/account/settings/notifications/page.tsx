'use client'

import {
  type BulkPreferenceItem,
  NotificationPreferencesPage,
  type PreferenceRow,
  useNotificationPreferences,
} from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'

// Superadmin notification preferences page. Backend filters
// preferences to the superadmin audience based on the authenticated user.
export default function NotificationPreferencesSuperadminPage() {
  const prefs = useNotificationPreferences({
    fetchPreferences: async () => {
      const res = await apiClient.get<{ items: PreferenceRow[] }>(
        '/superadmin/notification-preferences'
      )
      return res.success ? res.data.items : []
    },
    bulkUpdate: async (items: BulkPreferenceItem[]) => {
      await apiClient.patch('/superadmin/notification-preferences', { items })
    },
  })

  return (
    <div>
      <NotificationPreferencesPage {...prefs} />
    </div>
  )
}
