'use client'

import { createMessagingProvider } from '@world-schools/wc-frontend-utils'
import { useMessagingStore } from '@/stores/messaging-store'
import { useAuthStore } from '@/stores/auth-store'

export const MessagingProvider = createMessagingProvider({
  useMessagingStore,
  useAuthStore,
  notificationStorageKey: 'wc_booking_notification_preferences',
})
