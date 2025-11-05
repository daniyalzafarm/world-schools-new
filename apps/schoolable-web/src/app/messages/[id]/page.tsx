'use client'

import React, { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useConversationStore } from '@/stores/conversation-store'
import { conversationData } from '@/data/conversations'
import MessagesPage from '../page'

export default function UserConversationPage() {
  const params = useParams()
  const router = useRouter()
  const { userConversations, setUserConversations } = useConversationStore()
  const conversationId = params.id as string

  // Initialize conversation data if needed
  useEffect(() => {
    if (userConversations.length === 0) {
      setUserConversations(conversationData)
    }
  }, [userConversations.length, setUserConversations])

  // Find the conversation by ID
  const conversation = userConversations.find(conv => conv.id === conversationId)

  // If conversation not found, redirect to messages page
  useEffect(() => {
    if (userConversations.length > 0 && !conversation) {
      router.push('/messages')
    }
  }, [conversation, userConversations.length, router])

  // If conversation is found, trigger the selection event
  useEffect(() => {
    if (conversation) {
      // Dispatch the conversation selection event
      const event = new CustomEvent('selectConversation', { detail: conversation })
      window.dispatchEvent(event)
    }
  }, [conversation])

  // Show loading while finding conversation
  if (!conversation && userConversations.length > 0) {
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
