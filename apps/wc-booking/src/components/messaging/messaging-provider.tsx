/**
 * Messaging Provider for WC Booking
 *
 * This component initializes the messaging store and WebSocket connection
 * when the user is authenticated. It ensures the WebSocket is connected
 * before users navigate to messages or try to join conversations.
 *
 * Features:
 * - Auto-connects WebSocket when user is authenticated
 * - Auto-disconnects when user logs out
 * - Handles cleanup on unmount
 * - Global notification listener for new messages across all pages
 */

'use client'

import React, { useEffect, useRef } from 'react'
import { useMessagingStore } from '@/stores/messaging-store'
import { useAuthStore } from '@/stores/auth-store'
import { useNotifications } from '@/hooks/useNotifications'

interface MessagingProviderProps {
  children: React.ReactNode
}

export function MessagingProvider({ children }: MessagingProviderProps) {
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

  // Global notification hook — stays mounted across all pages
  const { requestPermission, showNotification } = useNotifications()

  // Track which messages we've already notified about to prevent duplicates
  const notifiedMessageIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Wait for auth to be initialized
    if (!isAuthInitialized) {
      return
    }

    // If user is authenticated and messaging is not initialized, initialize it
    if (isAuthenticated && !isMessagingInitialized && !initializationAttempted.current) {
      console.log('[MessagingProvider] User authenticated, initializing messaging store...')
      initializationAttempted.current = true

      initialize().catch(error => {
        console.error('[MessagingProvider] Failed to initialize messaging store:', error)
        // Reset flag to allow retry
        initializationAttempted.current = false
      })
    }

    // If user is not authenticated and messaging is initialized, clean it up
    if (!isAuthenticated && isMessagingInitialized) {
      console.log('[MessagingProvider] User logged out, cleaning up messaging store...')
      cleanup()
      initializationAttempted.current = false
      notifiedMessageIds.current.clear()
    }
  }, [isAuthenticated, isAuthInitialized, isMessagingInitialized, initialize, cleanup])

  // Request notification permission when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      requestPermission().catch(error => {
        console.error('[MessagingProvider] Failed to request notification permission:', error)
      })
    }
  }, [isAuthenticated, requestPermission])

  // Global notification listener for new messages across all pages
  useEffect(() => {
    if (!isMessagingInitialized || !user) return

    conversations.forEach(conversation => {
      // Skip the conversation the user is actively viewing
      if (conversation.id === activeConversationId) return

      const messages = storeMessages[conversation.id] || []
      const latestMessage = messages[messages.length - 1]
      if (!latestMessage) return

      // Skip if we already notified about this message
      if (notifiedMessageIds.current.has(latestMessage.id)) return

      // Skip messages from the current user
      if (latestMessage.senderId === user.id) return

      // Only notify for recent messages (within last 10 seconds)
      if (new Date().getTime() - new Date(latestMessage.sentAt).getTime() > 10000) return

      // Track this message as notified
      notifiedMessageIds.current.add(latestMessage.id)

      // Trim the set if it gets too large to prevent memory leaks
      if (notifiedMessageIds.current.size > 100) {
        const entries = Array.from(notifiedMessageIds.current)
        notifiedMessageIds.current = new Set(entries.slice(-50))
      }

      // Get sender name from conversation participants
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
