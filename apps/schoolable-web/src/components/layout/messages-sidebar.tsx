'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button, Input, ScrollShadow } from '@heroui/react'
import { cn, Icon } from '@world-schools/ui-web'
import { ChevronLeft, Search, X } from 'lucide-react'
import { conversationData } from '@/data/conversations'
import { ConversationItem } from '@/components/messages/conversation-item'
import { ArchivedChatsButton } from '@/components/messages/archived-chats-button'
import { useConversationStore } from '@/stores/conversation-store'
import type { Conversation, FilterType } from '@/types/conversation'

interface MessagesSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const MessagesSidebar: React.FC<MessagesSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const router = useRouter()
  const pathname = usePathname()

  // Use global conversation store
  const {
    userConversations,
    setUserConversations,
    togglePin,
    toggleArchive,
    toggleFavorite,
    toggleMute,
    markAsUnread,
    markAsRead,
    deleteConversations,
    blockConversations,
  } = useConversationStore()

  // Initialize conversations on mount
  useEffect(() => {
    if (userConversations.length === 0) {
      setUserConversations(conversationData)
    }
  }, [userConversations.length, setUserConversations])

  // Check if we're on archived page
  const isArchivedPage = pathname === '/messages/archived'

  // Filter and sort conversations based on search, filter type, and pinned status
  const filteredConversations = useMemo(() => {
    let filtered = userConversations.filter(conv =>
      isArchivedPage ? conv.archived : !conv.archived
    )

    // Apply filter type (only for non-archived pages)
    if (!isArchivedPage) {
      switch (activeFilter) {
        case 'favorites':
          filtered = filtered.filter(conv => conv.starred)
          break
        case 'unread':
          filtered = filtered.filter(
            conv => conv.unread || (conv.unreadCount && conv.unreadCount > 0)
          )
          break
        case 'all':
        default:
          // No additional filtering needed
          break
      }
    }

    // Apply search filter
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(conv =>
        conv.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort: pinned conversations first (by pinnedAt timestamp, most recent first), then unpinned
    return filtered.sort((a, b) => {
      // If both are pinned, sort by pinnedAt timestamp (most recent first)
      if (a.pinned && b.pinned) {
        return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)
      }
      // If only a is pinned, a comes first
      if (a.pinned && !b.pinned) {
        return -1
      }
      // If only b is pinned, b comes first
      if (!a.pinned && b.pinned) {
        return 1
      }
      // If neither is pinned, maintain original order
      return 0
    })
  }, [userConversations, activeFilter, searchQuery, isArchivedPage])

  // Count for different filter types and archived conversations
  const allCount = userConversations.filter(conv => !conv.archived).length
  const favoritesCount = userConversations.filter(conv => conv.starred && !conv.archived).length
  const unreadCount = userConversations.filter(
    conv => !conv.archived && (conv.unread || (conv.unreadCount && conv.unreadCount > 0))
  ).length
  const archivedCount = userConversations.filter(conv => conv.archived).length

  // Handle conversation press
  const handleConversationPress = useCallback(
    (conversation: Conversation) => {
      // Mark conversation as read
      markAsRead(conversation.id, false) // false for user

      // Navigate to appropriate page and dispatch selection event
      if (conversation.archived) {
        router.push('/messages/archived')
      } else {
        router.push('/messages')
      }

      // Dispatch conversation selection event
      window.dispatchEvent(
        new CustomEvent('selectConversation', {
          detail: conversation,
        })
      )
    },
    [markAsRead, router]
  )

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-100"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Messages Sidebar */}
      <aside
        className={cn(
          'h-full bg-white dark:bg-gray-900/95 backdrop-blur-md',
          'border-r border-gray-200 dark:border-gray-700',
          'fixed lg:static z-40',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'transition-all duration-300 ease-in-out',
          // Full width on mobile, fixed width on desktop
          'w-full lg:w-[400px]',
          // Add top padding on mobile to account for MobileHeader height
          'pt-8 lg:pt-0'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Messages Header */}
          <div className="h-20 px-6 mb-2 flex items-center border-b border-gray-200 dark:border-gray-700/50">
            {isSearchMode ? (
              /* Search Mode Header */
              <div className="flex w-full items-center gap-2">
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  radius="full"
                  onPress={() => {
                    setIsSearchMode(false)
                    setSearchQuery('')
                  }}
                  className="text-gray-600 dark:text-gray-400"
                >
                  <ChevronLeft size={16} />
                </Button>
                <Input
                  placeholder={isArchivedPage ? 'Search archived...' : 'Search conversations...'}
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  autoFocus
                  variant="bordered"
                  size="sm"
                  className="flex-1"
                  classNames={{
                    input: 'text-sm',
                    inputWrapper: 'border-none shadow-none bg-transparent',
                  }}
                />
                {searchQuery && (
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    radius="full"
                    onPress={() => setSearchQuery('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
            ) : (
              /* Normal Header */
              <div className="flex w-full items-center justify-between">
                {isArchivedPage ? (
                  <div className="flex items-center gap-2">
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      radius="full"
                      onPress={() => router.push('/messages')}
                      className="text-gray-600 dark:text-gray-400"
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      Archived Chats
                    </h1>
                  </div>
                ) : (
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Messages</h1>
                )}

                {/* Search Button */}
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  radius="full"
                  onPress={() => setIsSearchMode(true)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <Search size={20} />
                </Button>
              </div>
            )}
          </div>

          {/* Messages Content */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter Tabs - Hide when searching and no results */}
            {!isArchivedPage &&
              !(searchQuery.trim() !== '' && filteredConversations.length === 0) && (
                <div className="px-3 pb-2 pt-1 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={activeFilter === 'all' ? 'solid' : 'light'}
                      onPress={() => setActiveFilter('all')}
                      radius="full"
                      className={cn(
                        'flex-1 h-8 text-sm font-medium px-0 border-2 border-primary-100',
                        activeFilter === 'all'
                          ? 'bg-primary-100'
                          : 'dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      )}
                    >
                      All
                      {allCount > 0 && <span>{allCount}</span>}
                    </Button>

                    <Button
                      size="sm"
                      variant={activeFilter === 'unread' ? 'solid' : 'light'}
                      onPress={() => setActiveFilter('unread')}
                      radius="full"
                      className={cn(
                        'flex-1 h-8 text-sm font-medium border-2 border-primary-100',
                        activeFilter === 'unread'
                          ? 'bg-primary-100'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      )}
                    >
                      Unread
                      {unreadCount > 0 && <span>{unreadCount}</span>}
                    </Button>

                    <Button
                      size="sm"
                      variant={activeFilter === 'favorites' ? 'solid' : 'light'}
                      onPress={() => setActiveFilter('favorites')}
                      radius="full"
                      className={cn(
                        'flex-1 h-8 text-sm font-medium border-2 border-primary-100',
                        activeFilter === 'favorites'
                          ? 'bg-primary-100'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      )}
                    >
                      Favorites
                      {favoritesCount > 0 && <span>{favoritesCount}</span>}
                    </Button>
                  </div>
                </div>
              )}

            {/* Conversations List */}
            <ScrollShadow className="flex-1" hideScrollBar>
              {/* Archived Chats Button - Hide when searching and no results */}
              {!isArchivedPage &&
                !!archivedCount &&
                !(searchQuery.trim() !== '' && filteredConversations.length === 0) && (
                  <>
                    <div className="">
                      <ArchivedChatsButton archivedCount={archivedCount} />
                    </div>
                    <div className="h-px bg-gray-200 dark:bg-gray-700" />
                  </>
                )}

              {filteredConversations.length === 0 ? (
                <>
                  {searchQuery.trim() !== '' ? (
                    <div className="flex items-center gap-2 px-6 py-4">
                      <Search size={18} className="text-gray-500 dark:text-gray-400" />
                      <p className="font-medium text-gray-500 dark:text-gray-400">No results</p>
                    </div>
                  ) : isArchivedPage ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6">
                      <Icon name="archive" size={48} className="text-gray-400 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        No archived conversations
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-center">
                        Conversations you archive will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-6">
                      <Icon name="message" size={48} className="text-gray-400 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        No conversations
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-center">
                        Start a new conversation to get started
                      </p>
                    </div>
                  )}
                </>
              ) : (
                filteredConversations.map(conversation => (
                  <React.Fragment key={conversation.id}>
                    <ConversationItem
                      conversation={conversation}
                      onPress={handleConversationPress}
                      onPin={id => togglePin([id], false)}
                      onArchive={id => toggleArchive([id], false)}
                      onDelete={id => deleteConversations([id], false)}
                      onMute={id => toggleMute([id], false)}
                      onMarkAsUnread={id => markAsUnread([id], false)}
                      onBlock={id => blockConversations([id], false)}
                      onToggleFavorite={id => toggleFavorite([id], false)}
                    />
                  </React.Fragment>
                ))
              )}
            </ScrollShadow>
          </div>
        </div>
      </aside>
    </>
  )
}
