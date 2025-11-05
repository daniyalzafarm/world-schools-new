import type { ChatHistoryItem } from '@/types/chat'

/**
 * Utility functions for chat navigation
 */

export const navigateToChat = (chatId: string): string => {
  return `/chat/${chatId}`
}

export const navigateToNewChat = (): string => {
  return '/chat/new'
}

export const navigateToHistory = (): string => {
  return '/history'
}

export const getChatUrl = (item: ChatHistoryItem): string => {
  return navigateToChat(item.id)
}

export const isNewChatRoute = (pathname: string): boolean => {
  return pathname === '/chat/new'
}

export const isChatRoute = (pathname: string): boolean => {
  return pathname.startsWith('/chat/')
}

export const isHistoryRoute = (pathname: string): boolean => {
  return pathname === '/history'
}

export const extractChatIdFromPath = (pathname: string): string | null => {
  const match = pathname.match(/^\/chat\/([^/]+)$/)
  return match ? match[1] : null
}
