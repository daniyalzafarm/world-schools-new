import type { ChatHistoryItem } from '@/types/chat'

/**
 * Groups chat history items by time periods
 * @param chatHistory - Array of chat history items
 * @returns Object with time-based groups
 */
export function getGroupedHistory(chatHistory: ChatHistoryItem[]): {
  [key: string]: ChatHistoryItem[]
} {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const recentHistory = chatHistory
    .filter(item => !item.isArchived && !item.isFavorite) // Exclude pinned items (isFavorite = pinned)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10)

  const grouped: { [key: string]: ChatHistoryItem[] } = {
    Today: [],
    Yesterday: [],
    'This week': [],
    'This month': [],
    'Last month': [],
    Older: [],
  }

  recentHistory.forEach(item => {
    const itemDate = item.updatedAt

    if (itemDate >= today) {
      grouped['Today'].push(item)
    } else if (itemDate >= yesterday) {
      grouped['Yesterday'].push(item)
    } else if (itemDate >= thisWeek) {
      grouped['This week'].push(item)
    } else if (itemDate >= thisMonth) {
      grouped['This month'].push(item)
    } else if (itemDate >= lastMonth) {
      grouped['Last month'].push(item)
    } else {
      grouped['Older'].push(item)
    }
  })

  // Remove empty groups
  Object.keys(grouped).forEach(key => {
    if (grouped[key].length === 0) {
      delete grouped[key]
    }
  })

  return grouped
}

/**
 * Gets pinned chat history items
 * @param chatHistory - Array of chat history items
 * @returns Array of pinned items sorted by update time
 */
export function getPinnedHistory(chatHistory: ChatHistoryItem[]): ChatHistoryItem[] {
  return chatHistory
    .filter(item => !item.isArchived && item.isFavorite)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
}
