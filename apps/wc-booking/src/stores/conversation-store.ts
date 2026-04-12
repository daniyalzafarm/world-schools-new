'use client'

import { create } from 'zustand'
import type { Conversation } from '@world-schools/ui-web'
import { conversationsService } from '@/stores/messaging-store'

interface ConversationStore {
  // User conversations
  userConversations: Conversation[]
  setUserConversations: (conversations: Conversation[]) => void
  updateUserConversation: (conversationId: string, updates: Partial<Conversation>) => void

  /** Per-conversation error from the last failed optimistic action */
  actionError: Record<string, string | null>

  // Actions
  togglePin: (conversationIds: string[]) => Promise<void>
  toggleArchive: (conversationIds: string[]) => Promise<void>
  toggleFavorite: (conversationIds: string[]) => Promise<void>
  toggleMute: (conversationIds: string[]) => Promise<void>
  markAsUnread: (conversationIds: string[]) => void
  markAsRead: (conversationId: string) => void
  deleteConversations: (conversationIds: string[]) => void
  blockConversations: (conversationIds: string[]) => void
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  // User conversations
  userConversations: [],
  actionError: {},
  setUserConversations: conversations => set({ userConversations: conversations }),
  updateUserConversation: (conversationId, updates) => {
    set(state => ({
      userConversations: state.userConversations.map(conv =>
        conv.id === conversationId ? { ...conv, ...updates } : conv
      ),
    }))
  },

  // Actions
  togglePin: async conversationIds => {
    // Snapshot pre-change state for rollback
    const prev = get().userConversations

    // 1. Optimistic update
    set(state => ({
      userConversations: state.userConversations.map(conv =>
        conversationIds.includes(conv.id)
          ? { ...conv, pinned: !conv.pinned, pinnedAt: !conv.pinned ? Date.now() : undefined }
          : conv
      ),
    }))

    // 2. Persist each change; rollback + surface error on failure
    for (const id of conversationIds) {
      const conv = get().userConversations.find(c => c.id === id)
      try {
        const result = await conversationsService.updateConversationSettings(id, {
          conversationId: id,
          userId: '',
          pinned: conv?.pinned,
        })
        if (!result.success) throw new Error(result.error ?? 'Failed to pin conversation')
        set(state => ({ actionError: { ...state.actionError, [id]: null } }))
      } catch (err) {
        set({ userConversations: prev, actionError: { ...get().actionError, [id]: String(err) } })
        return
      }
    }
  },

  toggleArchive: async conversationIds => {
    const prev = get().userConversations

    set(state => ({
      userConversations: state.userConversations.map(conv =>
        conversationIds.includes(conv.id) ? { ...conv, archived: !conv.archived } : conv
      ),
    }))

    for (const id of conversationIds) {
      const conv = get().userConversations.find(c => c.id === id)
      try {
        const result = await conversationsService.updateConversationSettings(id, {
          conversationId: id,
          userId: '',
          archived: conv?.archived,
        })
        if (!result.success) throw new Error(result.error ?? 'Failed to archive conversation')
        set(state => ({ actionError: { ...state.actionError, [id]: null } }))
      } catch (err) {
        set({ userConversations: prev, actionError: { ...get().actionError, [id]: String(err) } })
        return
      }
    }
  },

  toggleFavorite: async conversationIds => {
    const prev = get().userConversations

    set(state => ({
      userConversations: state.userConversations.map(conv =>
        conversationIds.includes(conv.id) ? { ...conv, starred: !conv.starred } : conv
      ),
    }))

    for (const id of conversationIds) {
      const conv = get().userConversations.find(c => c.id === id)
      try {
        const result = await conversationsService.updateConversationSettings(id, {
          conversationId: id,
          userId: '',
          starred: conv?.starred,
        })
        if (!result.success) throw new Error(result.error ?? 'Failed to update favorite')
        set(state => ({ actionError: { ...state.actionError, [id]: null } }))
      } catch (err) {
        set({ userConversations: prev, actionError: { ...get().actionError, [id]: String(err) } })
        return
      }
    }
  },

  toggleMute: async conversationIds => {
    const prev = get().userConversations

    set(state => ({
      userConversations: state.userConversations.map(conv =>
        conversationIds.includes(conv.id) ? { ...conv, muted: !conv.muted } : conv
      ),
    }))

    for (const id of conversationIds) {
      const conv = get().userConversations.find(c => c.id === id)
      try {
        const result = await conversationsService.updateConversationSettings(id, {
          conversationId: id,
          userId: '',
          muted: conv?.muted,
        })
        if (!result.success) throw new Error(result.error ?? 'Failed to mute conversation')
        set(state => ({ actionError: { ...state.actionError, [id]: null } }))
      } catch (err) {
        set({ userConversations: prev, actionError: { ...get().actionError, [id]: String(err) } })
        return
      }
    }
  },

  markAsUnread: conversationIds => {
    set(state => ({
      userConversations: state.userConversations.map(conv =>
        conversationIds.includes(conv.id) ? { ...conv, unread: true } : conv
      ),
    }))
  },

  markAsRead: conversationId => {
    set(state => ({
      userConversations: state.userConversations.map(conv =>
        conv.id === conversationId ? { ...conv, unread: false, unreadCount: 0 } : conv
      ),
    }))
  },

  deleteConversations: conversationIds => {
    set(state => ({
      userConversations: state.userConversations.filter(conv => !conversationIds.includes(conv.id)),
    }))
  },

  blockConversations: conversationIds => {
    set(state => ({
      userConversations: state.userConversations.map(conv =>
        conversationIds.includes(conv.id) ? { ...conv, blocked: !conv.blocked } : conv
      ),
    }))
  },
}))
