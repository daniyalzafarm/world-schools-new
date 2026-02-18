/**
 * Typing Indicator Hook for WC Provider
 *
 * Provides typing indicator functionality with auto-stop timeout:
 * - Start typing indicator when user types
 * - Auto-stop after 5 seconds of inactivity
 * - Cleanup on unmount
 * - Debounced typing events
 *
 * @example
 * ```typescript
 * function ChatInput() {
 *   const { handleTyping, handleStopTyping } = useTypingIndicator('conversation-123')
 *
 *   const handleChange = (value: string) => {
 *     setValue(value)
 *     if (value) {
 *       handleTyping()
 *     } else {
 *       handleStopTyping()
 *     }
 *   }
 * }
 * ```
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMessagingStore } from '@/stores/messaging-store'

/**
 * Auto-stop timeout in milliseconds (5 seconds)
 */
const AUTO_STOP_TIMEOUT = 5000

/**
 * Hook for managing typing indicators with auto-stop
 *
 * @param conversationId - ID of the conversation
 * @returns Object with handleTyping and handleStopTyping functions
 */
export function useTypingIndicator(conversationId: string | null) {
  const { startTyping, stopTyping } = useMessagingStore()
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isTypingRef = useRef(false)

  /**
   * Start typing indicator with auto-stop timeout
   */
  const handleTyping = useCallback(() => {
    if (!conversationId) return

    // Only emit if not already typing
    if (!isTypingRef.current) {
      startTyping(conversationId)
      isTypingRef.current = true
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new auto-stop timeout (5 seconds)
    typingTimeoutRef.current = setTimeout(() => {
      if (conversationId) {
        stopTyping(conversationId)
        isTypingRef.current = false
      }
    }, AUTO_STOP_TIMEOUT)
  }, [conversationId, startTyping, stopTyping])

  /**
   * Stop typing indicator immediately
   */
  const handleStopTyping = useCallback(() => {
    if (!conversationId) return

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    // Stop typing if currently typing
    if (isTypingRef.current) {
      stopTyping(conversationId)
      isTypingRef.current = false
    }
  }, [conversationId, stopTyping])

  /**
   * Cleanup on unmount or when conversationId changes
   */
  useEffect(() => {
    return () => {
      // Clear timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Stop typing
      if (conversationId && isTypingRef.current) {
        stopTyping(conversationId)
      }
    }
  }, [conversationId, stopTyping])

  return {
    /**
     * Start typing indicator (with auto-stop after 5 seconds)
     */
    handleTyping,

    /**
     * Stop typing indicator immediately
     */
    handleStopTyping,

    /**
     * Whether currently typing
     */
    isTyping: isTypingRef.current,
  }
}
