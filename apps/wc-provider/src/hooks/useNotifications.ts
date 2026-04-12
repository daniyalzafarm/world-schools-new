// Thin wrapper — binds the shared hook to this app's localStorage key.
import { useNotifications as useSharedNotifications } from '@world-schools/wc-frontend-utils'

export function useNotifications() {
  return useSharedNotifications({ storageKey: 'wc_provider_notification_preferences' })
}

export type { BrowserNotificationOptions as NotificationOptions } from '@world-schools/wc-frontend-utils'
