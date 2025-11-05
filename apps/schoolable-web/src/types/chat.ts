export interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp?: Date
  isStreaming?: boolean
}

export interface ChatState {
  messages: Message[]
  input: string
  suggestions: string[]
  isLoading: boolean
  chatTitle?: string
  hasMessages: boolean
}

export interface SuggestionSets {
  initial: string[]
  curriculum: string[]
  [key: string]: string[]
}

export interface StreamingOptions {
  onComplete?: () => void
  speed?: number
}

export interface ChatActions {
  sendMessage: (text: string) => void
  handleSuggestion: (suggestion: string) => void
  setInput: (input: string) => void
  clearChat: () => void
  streamMessage: (fullText: string, messageId: string, options?: StreamingOptions) => void
}

export interface ChatContextType extends ChatState, ChatActions {}

// History-related types
export interface ChatHistoryItem {
  id: string
  title: string
  preview: string
  timestamp: string
  category: string
  messageCount: number
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  isArchived?: boolean
  isFavorite?: boolean
  tags?: string[]
}

export interface HistoryState {
  items: ChatHistoryItem[]
  isLoading: boolean
  searchQuery: string
  filteredItems: ChatHistoryItem[]
}

export interface HistoryActions {
  loadHistory: () => Promise<void>
  searchHistory: (query: string) => void
  deleteHistoryItem: (id: string) => void
  archiveHistoryItem: (id: string) => void
  favoriteHistoryItem: (id: string) => void
  clearHistory: () => void
}
