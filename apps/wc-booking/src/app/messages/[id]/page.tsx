'use client'

import React, { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMessagingStore } from '@/stores/messaging-store'
import MessagesPage from '../page'

/**
 * Dynamic route for direct conversation navigation
 *
 * This component handles navigation to specific conversations via URL (e.g., /messages/{conversationId})
 * It uses the real messaging store data instead of mock data and directly calls setActiveConversation
 * to ensure proper WebSocket connection and conversation display.
 */
export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string

  // Get messaging store state and actions
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    isLoadingConversations,
    isInitialized,
  } = useMessagingStore()

  // Set active conversation when component mounts or conversationId changes
  useEffect(() => {
    // Wait for messaging store to be initialized
    if (!isInitialized) {
      console.log('[ConversationPage] Waiting for messaging store to initialize...')
      return
    }

    // Wait for conversations to load
    if (isLoadingConversations) {
      console.log('[ConversationPage] Waiting for conversations to load...')
      return
    }

    // Skip if this conversation is already active (prevents unnecessary re-fetching)
    if (activeConversationId === conversationId) {
      return
    }

    // Check if conversation exists in store
    const conversation = conversations.find(c => c.id === conversationId)

    if (conversation) {
      console.log('[ConversationPage] Setting active conversation:', conversationId)
      // Set as active conversation (this will trigger WebSocket join)
      setActiveConversation(conversationId)
    } else if (!isLoadingConversations) {
      // Conversation not found and loading is complete, redirect
      console.warn('[ConversationPage] Conversation not found:', conversationId)
      router.push('/messages')
    }
  }, [
    conversationId,
    activeConversationId,
    isLoadingConversations,
    isInitialized,
    setActiveConversation,
    router,
  ])

  // Show loading while messaging store initializes or conversations are being fetched
  if (!isInitialized || isLoadingConversations) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading conversation...</p>
        </div>
      </div>
    )
  }

  // Render the main messages page
  return <MessagesPage />
}
