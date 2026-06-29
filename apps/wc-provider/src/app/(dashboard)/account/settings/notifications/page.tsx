'use client'

import {
  type BulkPreferenceItem,
  NotificationPreferencesPage,
  type PreferenceRow,
  useNotificationPreferences,
} from '@world-schools/wc-frontend-utils'
import apiClient from '@/utils/api-client'

// provider notification preferences page. Backend filters
// preferences to the provider audience based on the authenticated user.
export default function NotificationPreferencesProviderPage() {
  const prefs = useNotificationPreferences({
    fetchPreferences: async () => {
      const res = await apiClient.get<{ items: PreferenceRow[] }>(
        '/provider/notification-preferences'
      )
      return res.success ? res.data.items : []
    },
    bulkUpdate: async (items: BulkPreferenceItem[]) => {
      await apiClient.patch('/provider/notification-preferences', { items })
    },
  })

  return (
    <div>
      <NotificationPreferencesPage {...prefs} />
    </div>
  )
}
