/**
 * Notifications Hook for WC Provider
 *
 * Provides browser notification functionality for new messages:
 * - Request notification permission
 * - Show desktop notifications on new messages
 * - Play sound alerts
 * - Handle notification clicks to navigate to conversations
 * - User preferences for enabling/disabling notifications
 *
 * @example
 * ```typescript
 * function MessagesPage() {
 *   const { requestPermission, showNotification, playSound, isEnabled, setEnabled } = useNotifications()
 *
 *   useEffect(() => {
 *     requestPermission()
 *   }, [])
 *
 *   // Show notification on new message
 *   showNotification({
 *     title: 'New message from Parent',
 *     body: 'Hello, I have a question...',
 *     conversationId: 'conv-123',
 *   })
 * }
 * ```
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Notification options for showing a notification
 */
export interface NotificationOptions {
  /**
   * Notification title (e.g., sender name)
   */
  title: string

  /**
   * Notification body (e.g., message preview)
   */
  body: string

  /**
   * Conversation ID to navigate to when clicked
   */
  conversationId: string

  /**
   * Optional icon URL
   */
  icon?: string

  /**
   * Optional tag to replace existing notifications
   */
  tag?: string
}

/**
 * Notification preferences stored in localStorage
 */
interface NotificationPreferences {
  /**
   * Whether notifications are enabled
   */
  enabled: boolean

  /**
   * Whether sound alerts are enabled
   */
  soundEnabled: boolean
}

const STORAGE_KEY = 'wc_provider_notification_preferences'
const DEFAULT_ICON = '/assets/world-camps-icon-rounded.png'
const NOTIFICATION_SOUND = '/sounds/notification.mp3'

/**
 * Hook for managing browser notifications and sound alerts
 */
export function useNotifications() {
  const router = useRouter()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: true,
    soundEnabled: true,
  })

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setPreferences(JSON.parse(stored))
      } catch (error) {
        console.error('[useNotifications] Failed to parse preferences:', error)
      }
    }

    // Check current permission status
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  // Save preferences to localStorage when changed
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences])

  /**
   * Request notification permission from the user
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[useNotifications] Notifications not supported in this browser')
      return 'denied'
    }

    if (Notification.permission === 'granted') {
      setPermission('granted')
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      setPermission('denied')
      return 'denied'
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result
    } catch (error) {
      console.error('[useNotifications] Failed to request permission:', error)
      return 'denied'
    }
  }, [])

  /**
   * Play notification sound
   */
  const playSound = useCallback(() => {
    if (typeof window === 'undefined' || !preferences.soundEnabled) return

    try {
      const audio = new Audio(NOTIFICATION_SOUND)
      audio.volume = 0.5
      audio.play().catch(error => {
        console.error('[useNotifications] Failed to play sound:', error)
      })
    } catch (error) {
      console.error('[useNotifications] Failed to create audio:', error)
    }
  }, [preferences.soundEnabled])

  /**
   * Show a browser notification and/or play sound.
   * Sound playback is independent of browser Notification permission —
   * it only requires preferences.enabled + preferences.soundEnabled.
   */
  const showNotification = useCallback(
    (options: NotificationOptions) => {
      if (typeof window === 'undefined') return
      if (!preferences.enabled) return

      const { title, body, conversationId, icon = DEFAULT_ICON, tag } = options

      // Play sound if enabled (independent of browser Notification permission)
      if (preferences.soundEnabled) {
        playSound()
      }

      // Show browser notification only if permission is granted and API is available
      if (!('Notification' in window) || permission !== 'granted') return

      try {
        const notification = new Notification(title, {
          body,
          icon,
          tag: tag || `conversation-${conversationId}`,
          badge: DEFAULT_ICON,
          requireInteraction: false,
          silent: true, // We handle sound ourselves above
        })

        // Handle notification click - navigate to conversation
        notification.onclick = () => {
          window.focus()
          router.push(`/messages?conversation=${conversationId}`)
          notification.close()
        }

        // Auto-close after 5 seconds
        setTimeout(() => {
          notification.close()
        }, 5000)
      } catch (error) {
        console.error('[useNotifications] Failed to show notification:', error)
      }
    },
    [preferences.enabled, preferences.soundEnabled, permission, router, playSound]
  )

  /**
   * Enable or disable notifications
   */
  const setEnabled = useCallback((enabled: boolean) => {
    setPreferences(prev => ({ ...prev, enabled }))
  }, [])

  /**
   * Enable or disable sound alerts
   */
  const setSoundEnabled = useCallback((soundEnabled: boolean) => {
    setPreferences(prev => ({ ...prev, soundEnabled }))
  }, [])

  return {
    // State
    permission,
    isEnabled: preferences.enabled,
    isSoundEnabled: preferences.soundEnabled,
    isSupported: typeof window !== 'undefined' && 'Notification' in window,

    // Actions
    requestPermission,
    showNotification,
    playSound,
    setEnabled,
    setSoundEnabled,
  }
}
