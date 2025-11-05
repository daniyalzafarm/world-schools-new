'use client'

import { create } from 'zustand'
import type { Conversation } from '@/types/conversation'

interface ConversationStore {
  // User conversations
  userConversations: Conversation[]
  setUserConversations: (conversations: Conversation[]) => void
  updateUserConversation: (conversationId: string, updates: Partial<Conversation>) => void

  // Admin conversations
  adminConversations: Conversation[]
  setAdminConversations: (conversations: Conversation[]) => void
  updateAdminConversation: (conversationId: string, updates: Partial<Conversation>) => void

  // Actions for both
  togglePin: (conversationIds: string[], isAdmin?: boolean) => void
  toggleArchive: (conversationIds: string[], isAdmin?: boolean) => void
  toggleFavorite: (conversationIds: string[], isAdmin?: boolean) => void
  toggleMute: (conversationIds: string[], isAdmin?: boolean) => void
  markAsUnread: (conversationIds: string[], isAdmin?: boolean) => void
  markAsRead: (conversationId: string, isAdmin?: boolean) => void
  deleteConversations: (conversationIds: string[], isAdmin?: boolean) => void
  blockConversations: (conversationIds: string[], isAdmin?: boolean) => void
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

  // Admin conversations
  adminConversations: [],
  setAdminConversations: conversations => set({ adminConversations: conversations }),
  updateAdminConversation: (conversationId, updates) => {
    set(state => ({
      adminConversations: state.adminConversations.map(conv =>
        conv.id === conversationId ? { ...conv, ...updates } : conv
      ),
    }))
  },

  // Actions for both
  togglePin: (conversationIds, isAdmin = false) => {
    set(state => {
      const conversations = isAdmin ? state.adminConversations : state.userConversations
      const updatedConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return {
            ...conv,
            pinned: !conv.pinned,
            pinnedAt: !conv.pinned ? Date.now() : undefined,
          }
        }
        return conv
      })

      return isAdmin
        ? { adminConversations: updatedConversations }
        : { userConversations: updatedConversations }
    })
  },

  toggleArchive: (conversationIds, isAdmin = false) => {
    set(state => {
      const conversations = isAdmin ? state.adminConversations : state.userConversations
      const updatedConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, archived: !conv.archived }
        }
        return conv
      })

      return isAdmin
        ? { adminConversations: updatedConversations }
        : { userConversations: updatedConversations }
    })
  },

  toggleFavorite: (conversationIds, isAdmin = false) => {
    set(state => {
      const conversations = isAdmin ? state.adminConversations : state.userConversations
      const updatedConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, starred: !conv.starred }
        }
        return conv
      })

      return isAdmin
        ? { adminConversations: updatedConversations }
        : { userConversations: updatedConversations }
    })
  },

  toggleMute: (conversationIds, isAdmin = false) => {
    set(state => {
      const conversations = isAdmin ? state.adminConversations : state.userConversations
      const updatedConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, muted: !conv.muted }
        }
        return conv
      })

      return isAdmin
        ? { adminConversations: updatedConversations }
        : { userConversations: updatedConversations }
    })
  },

  markAsUnread: (conversationIds, isAdmin = false) => {
    set(state => {
      const conversations = isAdmin ? state.adminConversations : state.userConversations
      const updatedConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, unread: true }
        }
        return conv
      })

      return isAdmin
        ? { adminConversations: updatedConversations }
        : { userConversations: updatedConversations }
    })
  },

  markAsRead: (conversationId, isAdmin = false) => {
    set(state => {
      const conversations = isAdmin ? state.adminConversations : state.userConversations
      const updatedConversations = conversations.map(conv => {
        if (conv.id === conversationId) {
          return { ...conv, unread: false, unreadCount: 0 }
        }
        return conv
      })

      return isAdmin
        ? { adminConversations: updatedConversations }
        : { userConversations: updatedConversations }
    })
  },

  deleteConversations: (conversationIds, isAdmin = false) => {
    set(state => {
      const conversations = isAdmin ? state.adminConversations : state.userConversations
      const updatedConversations = conversations.filter(conv => !conversationIds.includes(conv.id))

      return isAdmin
        ? { adminConversations: updatedConversations }
        : { userConversations: updatedConversations }
    })
  },

  blockConversations: (conversationIds, isAdmin = false) => {
    set(state => {
      const conversations = isAdmin ? state.adminConversations : state.userConversations
      const updatedConversations = conversations.map(conv => {
        if (conversationIds.includes(conv.id)) {
          return { ...conv, blocked: !conv.blocked }
        }
        return conv
      })

      return isAdmin
        ? { adminConversations: updatedConversations }
        : { userConversations: updatedConversations }
    })
  },
}))
