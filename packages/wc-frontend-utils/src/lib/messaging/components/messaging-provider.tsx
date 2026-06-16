'use client'

import React, { useEffect, useRef } from 'react'
import { useNotifications } from '../../notifications/use-notifications'

interface MessagingStoreShape {
  initialize: () => Promise<void>
  cleanup: () => void
  isInitialized: boolean
  conversations: Array<{
    id: string
    participants?: Array<{
      userId?: string | null
      providerId?: string | null
      muted?: boolean
      user?: { firstName?: string | null } | null
    }>
  }>
  messages: Record<
    string,
    Array<{ id: string; senderId: string; content: string; sentAt: Date | string }>
  >
  activeConversationId: string | null
}

interface AuthStoreShape {
  isAuthenticated: boolean
  isInitialized: boolean
  user: { id: string } | null
}

interface CreateMessagingProviderOptions {
  useMessagingStore: () => MessagingStoreShape
  useAuthStore: () => AuthStoreShape
  /** localStorage key for notification preferences — unique per app */
  notificationStorageKey: string
}

/**
 * Factory that creates a `MessagingProvider` component bound to the app's
 * own Zustand stores. Keeps the shared implementation DRY while each app
 * injects its specific store hooks at configuration time.
 *
 * @example
 * ```tsx
 * // In each app (e.g. wc-booking/src/components/messaging/messaging-provider.tsx):
 * import { createMessagingProvider } from '@world-schools/wc-frontend-utils'
 * import { useMessagingStore } from '@/stores/messaging-store'
 * import { useAuthStore } from '@/stores/auth-store'
 *
 * export const MessagingProvider = createMessagingProvider({
 *   useMessagingStore,
 *   useAuthStore,
 *   notificationStorageKey: 'wc_booking_notification_preferences',
 * })
 * ```
 */
export function createMessagingProvider({
  useMessagingStore,
  useAuthStore,
  notificationStorageKey,
}: CreateMessagingProviderOptions) {
  return function MessagingProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isInitialized: isAuthInitialized, user } = useAuthStore()
    const {
      initialize,
      cleanup,
      isInitialized: isMessagingInitialized,
      conversations,
      messages: storeMessages,
      activeConversationId,
    } = useMessagingStore()
    const initializationAttempted = useRef(false)
    const notifiedMessageIds = useRef<Set<string>>(new Set())

    const { requestPermission, showNotification } = useNotifications({
      storageKey: notificationStorageKey,
    })

    // Initialize or clean up the messaging store based on auth state
    useEffect(() => {
      if (!isAuthInitialized) return

      if (isAuthenticated && !isMessagingInitialized && !initializationAttempted.current) {
        console.log('[MessagingProvider] User authenticated, initializing messaging store...')
        initializationAttempted.current = true
        initialize().catch(error => {
          console.error('[MessagingProvider] Failed to initialize messaging store:', error)
          initializationAttempted.current = false
        })
      }

      if (!isAuthenticated && isMessagingInitialized) {
        console.log('[MessagingProvider] User logged out, cleaning up messaging store...')
        cleanup()
        initializationAttempted.current = false
        notifiedMessageIds.current.clear()
      }
    }, [isAuthenticated, isAuthInitialized, isMessagingInitialized, initialize, cleanup])

    // Request browser notification permission when authenticated
    useEffect(() => {
      if (isAuthenticated) {
        requestPermission().catch(error => {
          console.error('[MessagingProvider] Failed to request notification permission:', error)
        })
      }
    }, [isAuthenticated, requestPermission])

    // Global new-message notification listener (fires for all conversations, not just the active one)
    useEffect(() => {
      if (!isMessagingInitialized || !user) return

      conversations.forEach(conversation => {
        if (conversation.id === activeConversationId) return

        const messages = storeMessages[conversation.id] || []
        const latestMessage = messages[messages.length - 1]
        if (!latestMessage) return
        if (notifiedMessageIds.current.has(latestMessage.id)) return
        if (latestMessage.senderId === user.id) return
        if (new Date().getTime() - new Date(latestMessage.sentAt).getTime() > 10000) return

        notifiedMessageIds.current.add(latestMessage.id)
        if (notifiedMessageIds.current.size > 100) {
          const entries = Array.from(notifiedMessageIds.current)
          notifiedMessageIds.current = new Set(entries.slice(-50))
        }

        // Respect mute: the message is recorded as "seen" above, but we skip the
        // sound + banner when the current user muted this conversation. Because
        // `conversations` is an effect dependency, the muted flag is read fresh,
        // so muting/unmuting takes effect on the very next message.
        const myParticipant = conversation.participants?.find(p => p.userId === user.id)
        if (myParticipant?.muted) return

        const senderName =
          conversation.participants?.find(
            p => p.userId === latestMessage.senderId || p.providerId === latestMessage.senderId
          )?.user?.firstName || 'User'

        showNotification({
          title: `New message from ${senderName}`,
          body: latestMessage.content.substring(0, 100),
          conversationId: conversation.id,
        })
      })
    }, [
      storeMessages,
      conversations,
      activeConversationId,
      isMessagingInitialized,
      user,
      showNotification,
    ])

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (isMessagingInitialized) {
          console.log('[MessagingProvider] Component unmounting, cleaning up messaging store...')
          cleanup()
        }
      }
    }, [])

    return <>{children}</>
  }
}
