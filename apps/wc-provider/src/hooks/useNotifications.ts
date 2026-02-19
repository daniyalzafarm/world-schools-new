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

// ─── Web Audio API singleton (module-level) ────────────────────────────
// AudioContext is unlocked once during any user gesture and stays active
// for the page's lifetime, allowing programmatic playback from async
// contexts like WebSocket event handlers.
// ────────────────────────────────────────────────────────────────────────
let audioContext: AudioContext | null = null
let notificationBuffer: AudioBuffer | null = null
let isAudioUnlocked = false

/**
 * Unlock the Web Audio API context. Must be called from a user gesture
 * handler (click, keypress, touchstart). Idempotent — safe to call
 * multiple times.
 */
async function unlockAudioContext(): Promise<void> {
  if (isAudioUnlocked) return

  try {
    if (!audioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioContext = new AudioCtx()
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    isAudioUnlocked = true

    // Pre-load and decode the notification sound
    if (!notificationBuffer) {
      const response = await fetch(NOTIFICATION_SOUND)
      const arrayBuffer = await response.arrayBuffer()
      notificationBuffer = await audioContext.decodeAudioData(arrayBuffer)
    }
  } catch (error) {
    console.warn('[useNotifications] Failed to unlock audio context:', error)
  }
}

/**
 * Play the notification sound through the Web Audio API.
 * Silently no-ops if the context hasn't been unlocked yet.
 */
function playNotificationSound(volume = 0.5): void {
  if (!audioContext || !notificationBuffer || audioContext.state !== 'running') return

  try {
    const source = audioContext.createBufferSource()
    source.buffer = notificationBuffer
    const gainNode = audioContext.createGain()
    gainNode.gain.value = volume
    source.connect(gainNode)
    gainNode.connect(audioContext.destination)
    source.start(0)
  } catch (error) {
    console.warn('[useNotifications] Failed to play notification sound:', error)
  }
}

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

  // Unlock Web Audio API on first user interaction (click, keypress, or touch).
  // Once unlocked, the AudioContext stays in "running" state for the page's
  // lifetime, allowing playSound() to work from async WebSocket handlers.
  useEffect(() => {
    if (typeof window === 'undefined' || isAudioUnlocked) return

    const unlock = () => {
      void unlockAudioContext()
      // Clean up all listeners after any one fires
      document.removeEventListener('click', unlock)
      document.removeEventListener('keydown', unlock)
      document.removeEventListener('touchstart', unlock)
    }

    document.addEventListener('click', unlock)
    document.addEventListener('keydown', unlock)
    document.addEventListener('touchstart', unlock)

    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('keydown', unlock)
      document.removeEventListener('touchstart', unlock)
    }
  }, [])

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
   * Play notification sound via Web Audio API.
   * Requires the audio context to have been unlocked by a prior user gesture.
   */
  const playSound = useCallback(() => {
    if (typeof window === 'undefined' || !preferences.soundEnabled) return
    playNotificationSound(0.5)
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
