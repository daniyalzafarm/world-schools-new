import type { UserProfileData } from '@/types/user-profile'

export interface Conversation {
  id: string
  name: string
  lastMessage: string
  time: number // Timestamp of last message
  lastSeen: number // Timestamp when user was last active
  avatar: string // Image path for web
  verified?: boolean
  starred?: boolean
  pinned?: boolean
  pinnedAt?: number // Timestamp when pinned
  archived?: boolean
  muted?: boolean
  unread?: boolean
  blocked?: boolean
  unreadCount?: number // Number of unread messages
  // Detailed user profile for the participant (admin-user conversations)
  userProfileData?: UserProfileData
}

export type FilterType = 'all' | 'favorites' | 'unread'

export interface ConversationState {
  conversations: Conversation[]
  activeFilter: FilterType
}

export interface ConversationActions {
  togglePin: (conversationIds: string[]) => void
  toggleArchive: (conversationIds: string[]) => void
  toggleFavorite: (conversationIds: string[]) => void
  toggleMute: (conversationIds: string[]) => void
  markAsUnread: (conversationIds: string[]) => void
  markAsRead: (conversationId: string) => void
  deleteConversations: (conversationIds: string[]) => void
  blockConversations: (conversationIds: string[]) => void
  setFilter: (filter: FilterType) => void
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void
}

export type ConversationContextType = ConversationState & ConversationActions
