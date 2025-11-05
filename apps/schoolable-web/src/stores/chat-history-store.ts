import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ChatHistoryItem } from '@/types/chat'
import { mockChatHistory } from '@/data/chat-history'

interface ChatHistoryState {
  // State
  chatHistory: ChatHistoryItem[]

  // Actions
  updateChatTitle: (id: string, newTitle: string) => void
  togglePin: (id: string) => void
  deleteChat: (id: string) => void
  getChatById: (id: string) => ChatHistoryItem | undefined
}

export const useChatHistoryStore = create<ChatHistoryState>()(
  devtools(
    (set, get) => ({
      // Initial state
      chatHistory: mockChatHistory,

      // Actions
      updateChatTitle: (id: string, newTitle: string) => {
        set(state => ({
          chatHistory: state.chatHistory.map(item =>
            item.id === id ? { ...item, title: newTitle } : item
          ),
        }))
      },

      togglePin: (id: string) => {
        set(state => ({
          chatHistory: state.chatHistory.map(item =>
            item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
          ),
        }))
      },

      deleteChat: (id: string) => {
        set(state => ({
          chatHistory: state.chatHistory.filter(item => item.id !== id),
        }))
      },

      getChatById: (id: string) => {
        return get().chatHistory.find(item => item.id === id)
      },
    }),
    {
      name: 'chat-history-store',
    }
  )
)
