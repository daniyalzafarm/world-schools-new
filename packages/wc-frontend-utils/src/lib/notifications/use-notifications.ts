/**
 * Browser Notification & Sound Alert Hook
 *
 * Manages browser notification permissions, Web Audio API sound playback,
 * and per-user preference persistence.
 *
 * Used by any wc-* app that needs desktop notification support.
 * Pass a unique `storageKey` per app so preferences are stored separately.
 *
 * @example
 * ```typescript
 * const { requestPermission, showNotification, playSound } = useNotifications({
 *   storageKey: 'wc_booking_notification_preferences',
 * })
 * ```
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface BrowserNotificationOptions {
  title: string
  body: string
  conversationId: string
  icon?: string
  tag?: string
}

interface NotificationPreferences {
  enabled: boolean
  soundEnabled: boolean
}

interface UseNotificationsOptions {
  /** localStorage key for persisting preferences — use a unique value per app */
  storageKey: string
}

const DEFAULT_ICON = '/assets/world-camps-icon-rounded.png'
const NOTIFICATION_SOUND = '/sounds/notification.mp3'

// Web Audio API singleton — module-level so it survives across hook re-renders.
// Unlocked once on a user gesture; stays active for the page's lifetime.
let audioContext: AudioContext | null = null
let notificationBuffer: AudioBuffer | null = null
let isAudioUnlocked = false

async function unlockAudioContext(): Promise<void> {
  if (isAudioUnlocked) return
  try {
    if (!audioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioContext = new AudioCtx()
    }
    if (audioContext.state === 'suspended') await audioContext.resume()
    isAudioUnlocked = true
    if (!notificationBuffer) {
      const response = await fetch(NOTIFICATION_SOUND)
      const arrayBuffer = await response.arrayBuffer()
      notificationBuffer = await audioContext.decodeAudioData(arrayBuffer)
    }
  } catch (error) {
    console.warn('[useNotifications] Failed to unlock audio context:', error)
  }
}

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

export function useNotifications({ storageKey }: UseNotificationsOptions) {
  const router = useRouter()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: true,
    soundEnabled: true,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        setPreferences(JSON.parse(stored))
      } catch {
        // ignore malformed storage
      }
    }
    if ('Notification' in window) setPermission(Notification.permission)
  }, [storageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(storageKey, JSON.stringify(preferences))
  }, [storageKey, preferences])

  // Unlock Web Audio API on first user interaction
  useEffect(() => {
    if (typeof window === 'undefined' || isAudioUnlocked) return
    const unlock = () => {
      void unlockAudioContext()
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

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
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
    } catch {
      return 'denied'
    }
  }, [])

  const playSound = useCallback(() => {
    if (typeof window === 'undefined' || !preferences.soundEnabled) return
    playNotificationSound(0.5)
  }, [preferences.soundEnabled])

  const showNotification = useCallback(
    (options: BrowserNotificationOptions) => {
      if (typeof window === 'undefined' || !preferences.enabled) return
      const { title, body, conversationId, icon = DEFAULT_ICON, tag } = options
      if (preferences.soundEnabled) playSound()
      if (!('Notification' in window) || permission !== 'granted') return
      try {
        const notification = new Notification(title, {
          body,
          icon,
          tag: tag || `conversation-${conversationId}`,
          badge: DEFAULT_ICON,
          requireInteraction: false,
          silent: true,
        })
        notification.onclick = () => {
          window.focus()
          router.push(`/messages?conversation=${conversationId}`)
          notification.close()
        }
        setTimeout(() => notification.close(), 5000)
      } catch (error) {
        console.error('[useNotifications] Failed to show notification:', error)
      }
    },
    [preferences.enabled, preferences.soundEnabled, permission, router, playSound]
  )

  const setEnabled = useCallback((enabled: boolean) => {
    setPreferences(prev => ({ ...prev, enabled }))
  }, [])

  const setSoundEnabled = useCallback((soundEnabled: boolean) => {
    setPreferences(prev => ({ ...prev, soundEnabled }))
  }, [])

  return {
    permission,
    isEnabled: preferences.enabled,
    isSoundEnabled: preferences.soundEnabled,
    isSupported: typeof window !== 'undefined' && 'Notification' in window,
    requestPermission,
    showNotification,
    playSound,
    setEnabled,
    setSoundEnabled,
  }
}
