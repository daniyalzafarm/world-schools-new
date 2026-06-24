'use client'

import { create } from 'zustand'
import type { Conversation } from '@world-schools/ui-web'
import { useMessagingStore } from '@/stores/messaging-store'

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
  markAsUnread: (conversationIds: string[]) => Promise<void>
  markAsRead: (conversationId: string) => Promise<void>
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
  // Flag toggles delegate to the messaging store, the single source of truth
  // the sidebar derives from. It updates the current user's participant
  // optimistically, persists, and rolls back on failure — so the change is not
  // clobbered when the conversation list re-maps on the next store update.
  togglePin: async conversationIds => {
    for (const id of conversationIds) {
      const conv = get().userConversations.find(c => c.id === id)
      try {
        await useMessagingStore.getState().setConversationFlags(id, { pinned: !conv?.pinned })
        set(state => ({ actionError: { ...state.actionError, [id]: null } }))
      } catch (err) {
        set(state => ({ actionError: { ...get().actionError, [id]: String(err) } }))
      }
    }
  },

  toggleArchive: async conversationIds => {
    for (const id of conversationIds) {
      const conv = get().userConversations.find(c => c.id === id)
      try {
        await useMessagingStore.getState().setConversationFlags(id, { archived: !conv?.archived })
        set(state => ({ actionError: { ...state.actionError, [id]: null } }))
      } catch (err) {
        set(state => ({ actionError: { ...get().actionError, [id]: String(err) } }))
      }
    }
  },

  toggleFavorite: async conversationIds => {
    for (const id of conversationIds) {
      const conv = get().userConversations.find(c => c.id === id)
      try {
        await useMessagingStore.getState().setConversationFlags(id, { starred: !conv?.starred })
        set(state => ({ actionError: { ...state.actionError, [id]: null } }))
      } catch (err) {
        set(state => ({ actionError: { ...get().actionError, [id]: String(err) } }))
      }
    }
  },

  toggleMute: async conversationIds => {
    for (const id of conversationIds) {
      const conv = get().userConversations.find(c => c.id === id)
      try {
        await useMessagingStore.getState().setConversationFlags(id, { muted: !conv?.muted })
        set(state => ({ actionError: { ...state.actionError, [id]: null } }))
      } catch (err) {
        set(state => ({ actionError: { ...get().actionError, [id]: String(err) } }))
      }
    }
  },

  // Mark-as-unread/read persist through the messaging store (single source of
  // truth), so they survive the sidebar re-map and a reload.
  markAsUnread: async conversationIds => {
    for (const id of conversationIds) {
      try {
        await useMessagingStore.getState().markConversationUnread(id)
        set(state => ({ actionError: { ...state.actionError, [id]: null } }))
      } catch (err) {
        set(state => ({ actionError: { ...get().actionError, [id]: String(err) } }))
      }
    }
  },

  markAsRead: async conversationId => {
    try {
      await useMessagingStore.getState().markConversationRead(conversationId)
      set(state => ({ actionError: { ...state.actionError, [conversationId]: null } }))
    } catch (err) {
      set(state => ({ actionError: { ...get().actionError, [conversationId]: String(err) } }))
    }
  },
}))
