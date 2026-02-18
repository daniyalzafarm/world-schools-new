'use client'

import { create } from 'zustand'
import type { Conversation } from '@world-schools/ui-web'

interface ConversationStore {
  // User conversations
  userConversations: Conversation[]
  setUserConversations: (conversations: Conversation[]) => void
  updateUserConversation: (conversationId: string, updates: Partial<Conversation>) => void

  // Actions
  togglePin: (conversationIds: string[]) => void
  toggleArchive: (conversationIds: string[]) => void
  toggleFavorite: (conversationIds: string[]) => void
  toggleMute: (conversationIds: string[]) => void
  markAsUnread: (conversationIds: string[]) => void
  markAsRead: (conversationId: string) => void
  deleteConversations: (conversationIds: string[]) => void
  blockConversations: (conversationIds: string[]) => void
}

export const useConversationStore = create<ConversationStore>((set, _get) => ({
  // User conversations
  userConversations: [],
  setUserConversations: conversations => set({ userConversations: conversations }),
  updateUserConversation: (conversationId, updates) => {
    set(state => ({
      userConversations: state.userConversations.map(conv =>
        conv.id === conversationId ? { ...conv, ...updates } : conv
      ),
    }))
  },

  // Actions
  togglePin: conversationIds => {
    set(state => {
      const updatedConversations = state.userConversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return {
            ...conv,
            pinned: !conv.pinned,
            pinnedAt: !conv.pinned ? Date.now() : undefined,
          }
        }
        return conv
      })

      return { userConversations: updatedConversations }
    })
  },

  toggleArchive: conversationIds => {
    set(state => {
      const updatedConversations = state.userConversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, archived: !conv.archived }
        }
        return conv
      })

      return { userConversations: updatedConversations }
    })
  },

  toggleFavorite: conversationIds => {
    set(state => {
      const updatedConversations = state.userConversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, starred: !conv.starred }
        }
        return conv
      })

      return { userConversations: updatedConversations }
    })
  },

  toggleMute: conversationIds => {
    set(state => {
      const updatedConversations = state.userConversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, muted: !conv.muted }
        }
        return conv
      })

      return { userConversations: updatedConversations }
    })
  },

  markAsUnread: conversationIds => {
    set(state => {
      const updatedConversations = state.userConversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, unread: true }
        }
        return conv
      })

      return { userConversations: updatedConversations }
    })
  },

  markAsRead: conversationId => {
    set(state => {
      const updatedConversations = state.userConversations.map(conv => {
        if (conv.id === conversationId) {
          return { ...conv, unread: false, unreadCount: 0 }
        }
        return conv
      })

      return { userConversations: updatedConversations }
    })
  },

  deleteConversations: conversationIds => {
    set(state => {
      const updatedConversations = state.userConversations.filter(
        conv => !conversationIds.includes(conv.id)
      )

      return { userConversations: updatedConversations }
    })
  },

  blockConversations: conversationIds => {
    set(state => {
      const updatedConversations = state.userConversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, blocked: !conv.blocked }
        }
        return conv
      })

      return { userConversations: updatedConversations }
    })
  },
}))
