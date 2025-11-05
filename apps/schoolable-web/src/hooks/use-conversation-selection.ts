'use client'

import { useCallback, useState } from 'react'
import type {
  Conversation,
  ConversationActions,
  ConversationState,
  FilterType,
} from '@/types/conversation'

interface UseConversationSelectionProps {
  conversations: Conversation[]
  onConversationsUpdate?: (conversations: Conversation[]) => void
  onArchivedConversationsUpdate?: (archivedConversations: Conversation[]) => void
  isArchiveMode?: boolean // Whether we're managing archived conversations
}

export function useConversationSelection({
  conversations: initialConversations,
  onConversationsUpdate,
  onArchivedConversationsUpdate,
  isArchiveMode: _isArchiveMode = false,
}: UseConversationSelectionProps): ConversationState & ConversationActions {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  // Update conversations and notify parent
  const updateConversationsState = useCallback(
    (newConversations: Conversation[]) => {
      setConversations(newConversations)
      onConversationsUpdate?.(newConversations)
    },
    [onConversationsUpdate]
  )

  // Conversation actions
  const updateConversation = useCallback(
    (conversationId: string, updates: Partial<Conversation>) => {
      const newConversations = conversations.map(conv =>
        conv.id === conversationId ? { ...conv, ...updates } : conv
      )
      updateConversationsState(newConversations)
    },
    [conversations, updateConversationsState]
  )

  const togglePin = useCallback(
    (conversationIds: string[]) => {
      const newConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return {
            ...conv,
            pinned: !conv.pinned,
            pinnedAt: !conv.pinned ? Date.now() : undefined,
          }
        }
        return conv
      })
      updateConversationsState(newConversations)
    },
    [conversations, updateConversationsState]
  )

  const toggleArchive = useCallback(
    (conversationIds: string[]) => {
      const newConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, archived: !conv.archived }
        }
        return conv
      })
      updateConversationsState(newConversations)

      // If we have archived conversations update callback, call it
      if (onArchivedConversationsUpdate) {
        const archivedConversations = newConversations.filter(conv => conv.archived)
        onArchivedConversationsUpdate(archivedConversations)
      }
    },
    [conversations, updateConversationsState, onArchivedConversationsUpdate]
  )

  const toggleFavorite = useCallback(
    (conversationIds: string[]) => {
      const newConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, starred: !conv.starred }
        }
        return conv
      })
      updateConversationsState(newConversations)
    },
    [conversations, updateConversationsState]
  )

  const toggleMute = useCallback(
    (conversationIds: string[]) => {
      const newConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, muted: !conv.muted }
        }
        return conv
      })
      updateConversationsState(newConversations)
    },
    [conversations, updateConversationsState]
  )

  const markAsUnread = useCallback(
    (conversationIds: string[]) => {
      const newConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, unread: true }
        }
        return conv
      })
      updateConversationsState(newConversations)
    },
    [conversations, updateConversationsState]
  )

  const markAsRead = useCallback(
    (conversationId: string) => {
      const newConversations = conversations.map(conv => {
        if (conv.id === conversationId) {
          return { ...conv, unread: false }
        }
        return conv
      })
      updateConversationsState(newConversations)
    },
    [conversations, updateConversationsState]
  )

  const deleteConversations = useCallback(
    (conversationIds: string[]) => {
      const newConversations = conversations.filter(conv => !conversationIds.includes(conv.id))
      updateConversationsState(newConversations)
    },
    [conversations, updateConversationsState]
  )

  const blockConversations = useCallback(
    (conversationIds: string[]) => {
      const newConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, blocked: !conv.blocked }
        }
        return conv
      })
      updateConversationsState(newConversations)
    },
    [conversations, updateConversationsState]
  )

  const setFilter = useCallback((filter: FilterType) => {
    setActiveFilter(filter)
  }, [])

  return {
    conversations,
    activeFilter,
    togglePin,
    toggleArchive,
    toggleFavorite,
    toggleMute,
    markAsUnread,
    markAsRead,
    deleteConversations,
    blockConversations,
    setFilter,
    updateConversation,
  }
}
