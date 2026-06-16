'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Conversation } from '@world-schools/ui-web'
import MessagesPage from '../../page'

// Mock conversation data - matches the data in MessagesSidebar
const mockConversations: Conversation[] = [
  // Superadmin conversation - always pinned at the top
  {
    id: 'superadmin',
    name: 'World Camps Support',
    lastMessage: 'How can we help you today?',
    time: Date.now() - 1000 * 60 * 5, // 5 minutes ago
    lastSeen: Date.now() - 1000 * 60 * 2, // 2 minutes ago
    avatar: 'school-1',
    verified: true,
    pinned: true,
    unread: false,
  },
  // Regular provider conversations with various states
  {
    id: 'provider-1',
    name: 'Adventure Summer Camp',
    lastMessage: 'Thank you for your booking! We look forward to seeing your child.',
    time: Date.now() - 1000 * 60 * 15, // 15 minutes ago
    lastSeen: Date.now() - 1000 * 60 * 10, // 10 minutes ago
    avatar: 'school-2',
    starred: true,
    verified: true,
    unread: true,
    unreadCount: 3,
    muted: true,
  },
  {
    id: 'provider-2',
    name: 'Creative Arts Workshop',
    lastMessage: 'The art supplies list has been updated on our website.',
    time: Date.now() - 1000 * 60 * 30, // 30 minutes ago
    lastSeen: Date.now() - 1000 * 60 * 25, // 25 minutes ago
    avatar: 'school-3',
    unread: true,
    unreadCount: 0, // Marked as unread but no new messages
  },
  {
    id: 'provider-3',
    name: 'Mountain Explorer Camp',
    lastMessage: 'Looking forward to the hiking trip next week!',
    time: Date.now() - 1000 * 60 * 60, // 1 hour ago
    lastSeen: Date.now() - 1000 * 60 * 45, // 45 minutes ago
    avatar: 'school-1',
    starred: true,
  },
  {
    id: 'provider-4',
    name: 'Tech Innovation Camp',
    lastMessage: 'Your child did great in the robotics session today!',
    time: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60, // 1 hour ago
    avatar: 'school-2',
    verified: true,
    muted: true,
    unread: true,
    unreadCount: 12, // High unread count
  },
  {
    id: 'provider-5',
    name: 'Nature Discovery Camp',
    lastMessage: "Don't forget to bring sunscreen and a water bottle tomorrow.",
    time: Date.now() - 1000 * 60 * 60 * 3, // 3 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    avatar: 'school-3',
    starred: true,
    verified: true,
  },
  {
    id: 'provider-6',
    name: 'Sports Excellence Academy',
    lastMessage: 'Practice schedule for next week is now available.',
    time: Date.now() - 1000 * 60 * 60 * 6, // 6 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 4, // 4 hours ago
    avatar: 'school-1',
    verified: true,
  },
  {
    id: 'provider-7',
    name: 'Music & Performing Arts Camp',
    lastMessage: 'The recital date has been confirmed for July 15th.',
    time: Date.now() - 1000 * 60 * 60 * 12, // 12 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 8, // 8 hours ago
    avatar: 'school-2',
    pinned: true,
    verified: true,
  },
  {
    id: 'provider-8',
    name: 'Science Explorers Camp',
    lastMessage: 'We have a special guest speaker coming next Tuesday!',
    time: Date.now() - 1000 * 60 * 60 * 18, // 18 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 15, // 15 hours ago
    avatar: 'school-3',
    muted: true,
  },
  {
    id: 'provider-9',
    name: 'Aquatic Adventures Camp',
    lastMessage: 'Swimming lessons start at 9 AM sharp. Please arrive 15 minutes early.',
    time: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 20, // 20 hours ago
    avatar: 'school-1',
    starred: true,
    unread: true,
    unreadCount: 5,
  },
  {
    id: 'provider-10',
    name: 'Wilderness Survival Camp',
    lastMessage: 'Reminder: Camping gear checklist sent via email.',
    time: Date.now() - 1000 * 60 * 60 * 36, // 36 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 30, // 30 hours ago
    avatar: 'school-2',
    verified: true,
  },
  // Archived conversations
  {
    id: 'provider-archived-1',
    name: 'Winter Sports Camp 2023',
    lastMessage: 'Thanks for a wonderful winter season! See you next year.',
    time: Date.now() - 1000 * 60 * 60 * 24 * 14, // 2 weeks ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 24 * 13, // 13 days ago
    avatar: 'school-3',
    archived: true,
    verified: true,
  },
  {
    id: 'provider-archived-2',
    name: 'Spring Break Adventure',
    lastMessage: 'Hope you enjoyed the spring break program!',
    time: Date.now() - 1000 * 60 * 60 * 24 * 30, // 1 month ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 24 * 28, // 28 days ago
    avatar: 'school-1',
    archived: true,
    starred: true,
  },
  {
    id: 'provider-archived-3',
    name: 'Holiday Coding Bootcamp',
    lastMessage: 'Great progress in the coding sessions! Keep practicing.',
    time: Date.now() - 1000 * 60 * 60 * 24 * 45, // 45 days ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 24 * 42, // 42 days ago
    avatar: 'school-2',
    archived: true,
  },
]

export default function ArchivedConversationPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string
  const [conversations] = useState<Conversation[]>(mockConversations)

  // Find the conversation by ID
  const conversation = conversations.find(conv => conv.id === conversationId)

  // If conversation not found, redirect to archived messages page
  useEffect(() => {
    if (!conversation) {
      router.push('/messages/archived')
    }
  }, [conversation, router])

  // If conversation is found, trigger the selection event
  useEffect(() => {
    if (conversation) {
      // Dispatch the conversation selection event
      const event = new CustomEvent('selectConversation', { detail: conversation })
      window.dispatchEvent(event)
    }
  }, [conversation])

  // Show loading while finding conversation
  if (!conversation) {
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
