'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button, Input, ScrollShadow } from '@heroui/react'
import { cn, type Conversation, ConversationItem, type FilterType } from '@world-schools/ui-web'
import { AlertCircle, ChevronLeft, Pin, Search, X } from 'lucide-react'
import { ArchivedChatsButton } from '@/components/messages/archived-chats-button'
import { useConversationStore } from '@/stores/conversation-store'
import { useMessagingStore } from '@/stores/messaging-store'
import { ConversationListSkeleton } from '@/components/messages/conversation-skeleton'
import type { ConversationResponseDto } from '@world-schools/wc-frontend-utils'

interface MessagesSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

// Mock data for conversations - will be replaced with real data
const mockConversations: Conversation[] = [
  // Superadmin conversation - always pinned at the top
  {
    id: 'superadmin',
    name: 'World Camps Support',
    lastMessage: 'How can we help you today?',
    time: Date.now() - 1000 * 60 * 5, // 5 minutes ago
    lastSeen: Date.now() - 1000 * 60 * 2, // 2 minutes ago
    avatar: 'school-1',
    verified: true,
    pinned: true,
    pinnedAt: Date.now() - 1000 * 60 * 30, // Pinned 30 minutes ago
    unread: false,
  },
  // Regular provider conversations with various states
  {
    id: 'provider-1',
    name: 'Adventure Summer Camp',
    lastMessage: 'Thank you for your booking! We look forward to seeing your child.',
    time: Date.now() - 1000 * 60 * 15, // 15 minutes ago
    lastSeen: Date.now() - 1000 * 60 * 10, // 10 minutes ago
    avatar: 'school-2',
    starred: true,
    verified: true,
    unread: true,
    unreadCount: 3,
    muted: true,
  },
  {
    id: 'provider-2',
    name: 'Creative Arts Workshop',
    lastMessage: 'The art supplies list has been updated on our website.',
    time: Date.now() - 1000 * 60 * 30, // 30 minutes ago
    lastSeen: Date.now() - 1000 * 60 * 25, // 25 minutes ago
    avatar: 'school-3',
    unread: true,
    unreadCount: 0, // Marked as unread but no new messages
  },
  {
    id: 'provider-3',
    name: 'Mountain Explorer Camp',
    lastMessage: 'Looking forward to the hiking trip next week!',
    time: Date.now() - 1000 * 60 * 60, // 1 hour ago
    lastSeen: Date.now() - 1000 * 60 * 45, // 45 minutes ago
    avatar: 'school-1',
    starred: true,
  },
  {
    id: 'provider-4',
    name: 'Tech Innovation Camp',
    lastMessage: 'Your child did great in the robotics session today!',
    time: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60, // 1 hour ago
    avatar: 'school-2',
    verified: true,
    muted: true,
    unread: true,
    unreadCount: 12, // High unread count
  },
  {
    id: 'provider-5',
    name: 'Nature Discovery Camp',
    lastMessage: "Don't forget to bring sunscreen and a water bottle tomorrow.",
    time: Date.now() - 1000 * 60 * 60 * 3, // 3 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    avatar: 'school-3',
    starred: true,
    verified: true,
  },
  {
    id: 'provider-6',
    name: 'Sports Excellence Academy',
    lastMessage: 'Practice schedule for next week is now available.',
    time: Date.now() - 1000 * 60 * 60 * 6, // 6 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 4, // 4 hours ago
    avatar: 'school-1',
    verified: true,
  },
  {
    id: 'provider-7',
    name: 'Music & Performing Arts Camp',
    lastMessage: 'The recital date has been confirmed for July 15th.',
    time: Date.now() - 1000 * 60 * 60 * 12, // 12 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 8, // 8 hours ago
    avatar: 'school-2',
    pinned: true,
    pinnedAt: Date.now() - 1000 * 60 * 60, // Pinned 1 hour ago
    verified: true,
  },
  {
    id: 'provider-8',
    name: 'Science Explorers Camp',
    lastMessage: 'We have a special guest speaker coming next Tuesday!',
    time: Date.now() - 1000 * 60 * 60 * 18, // 18 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 15, // 15 hours ago
    avatar: 'school-3',
    muted: true,
  },
  {
    id: 'provider-9',
    name: 'Aquatic Adventures Camp',
    lastMessage: 'Swimming lessons start at 9 AM sharp. Please arrive 15 minutes early.',
    time: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 20, // 20 hours ago
    avatar: 'school-1',
    starred: true,
    unread: true,
    unreadCount: 5,
  },
  {
    id: 'provider-10',
    name: 'Wilderness Survival Camp',
    lastMessage: 'Reminder: Camping gear checklist sent via email.',
    time: Date.now() - 1000 * 60 * 60 * 36, // 36 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 30, // 30 hours ago
    avatar: 'school-2',
    verified: true,
  },
  // Archived conversations
  {
    id: 'provider-archived-1',
    name: 'Winter Sports Camp 2023',
    lastMessage: 'Thanks for a wonderful winter season! See you next year.',
    time: Date.now() - 1000 * 60 * 60 * 24 * 14, // 2 weeks ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 24 * 13, // 13 days ago
    avatar: 'school-3',
    archived: true,
    verified: true,
  },
  {
    id: 'provider-archived-2',
    name: 'Spring Break Adventure',
    lastMessage: 'Hope you enjoyed the spring break program!',
    time: Date.now() - 1000 * 60 * 60 * 24 * 30, // 1 month ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 24 * 28, // 28 days ago
    avatar: 'school-1',
    archived: true,
    starred: true,
  },
  {
    id: 'provider-archived-3',
    name: 'Holiday Coding Bootcamp',
    lastMessage: 'Great progress in the coding sessions! Keep practicing.',
    time: Date.now() - 1000 * 60 * 60 * 24 * 45, // 45 days ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 24 * 42, // 42 days ago
    avatar: 'school-2',
    archived: true,
  },
]

export const MessagesSidebar: React.FC<MessagesSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const router = useRouter()
  const pathname = usePathname()

  // Use global conversation store (for local UI state like pinning, archiving)
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

  // Use messaging store for real data
  const {
    conversations: storeConversations,
    activeConversationId,
    isLoadingConversations,
    conversationsError,
    fetchConversations,
  } = useMessagingStore()

  // Helper: Safely convert date to timestamp (handles both Date objects and ISO strings)
  const getTimestamp = (date: Date | string | undefined): number => {
    if (!date) return Date.now()
    if (date instanceof Date) return date.getTime()
    return new Date(date).getTime()
  }

  // Convert ConversationResponseDto to UI Conversation type
  const convertToUIConversation = (conv: ConversationResponseDto): Conversation => {
    const participant = conv.participants?.find(p => p.providerId || p.userId)
    const isSuperadmin = conv.type === 'USER_SUPERADMIN'

    // For provider app, filter out provider participants (those with providerId) to find the user/parent
    const nonProviderParticipants = conv.participants?.filter(p => !p.providerId) ?? []
    const userParticipant = nonProviderParticipants.find(p => p.userId)
    const firstName = userParticipant?.user?.firstName || ''
    const lastName = userParticipant?.user?.lastName || ''
    const userName =
      firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'User'

    return {
      id: conv.id,
      name: isSuperadmin ? 'World Camps Support' : userName,
      lastMessage: conv.lastMessage?.content || '',
      time: getTimestamp(conv.lastActivityAt),
      lastSeen: getTimestamp(conv.lastActivityAt),
      avatar: '', // No real avatar - ConversationItem will show initials from name
      verified: isSuperadmin,
      pinned: participant?.pinned ?? false,
      starred: participant?.starred ?? false,
      archived: participant?.archived ?? false,
      muted: participant?.muted ?? false,
      unread: (participant?.unreadCount ?? 0) > 0,
      unreadCount: participant?.unreadCount ?? 0,
    }
  }

  // Sync store conversations to local conversation store
  useEffect(() => {
    if (storeConversations.length > 0) {
      const uiConversations = storeConversations.map(convertToUIConversation)
      setUserConversations(uiConversations)
    }
  }, [storeConversations, setUserConversations])

  // Check if we're on archived page (includes both /messages/archived and /messages/archived/[id])
  const isArchivedPage = pathname.startsWith('/messages/archived')

  // Filter and sort conversations based on search, filter type, and archived status
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
          break
      }
    }

    // Apply search filter
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(conv =>
        conv.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort: pinned conversations first (superadmin always at top), then by time
    return filtered.sort((a, b) => {
      // Superadmin conversation always first
      if (a.id === 'superadmin') return -1
      if (b.id === 'superadmin') return 1

      // Then other pinned conversations
      if (a.pinned && b.pinned) {
        return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)
      }
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1

      // Finally by time
      return b.time - a.time
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
      markAsRead(conversation.id)

      // Dispatch conversation selection event
      window.dispatchEvent(
        new CustomEvent('selectConversation', {
          detail: conversation,
        })
      )
    },
    [markAsRead]
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
          'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'w-full lg:w-[400px]'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Messages Header */}
          <div className="h-20 px-6 mb-2 flex items-center border-b border-gray-200 dark:border-gray-700/50">
            {isSearchMode ? (
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
                      All{allCount > 0 && <span className="ml-1">{allCount}</span>}
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
                      Unread{unreadCount > 0 && <span className="ml-1">{unreadCount}</span>}
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
                      {favoritesCount > 0 && <span className="ml-1">{favoritesCount}</span>}
                    </Button>
                  </div>
                </div>
              )}

            {/* Conversations List */}
            <ScrollShadow className="flex-1" hideScrollBar>
              {/* Loading State */}
              {isLoadingConversations ? (
                <ConversationListSkeleton count={8} />
              ) : conversationsError ? (
                /* Error State */
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <AlertCircle size={48} className="text-red-500 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Failed to load conversations
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-center mb-4">
                    {conversationsError}
                  </p>
                  <Button size="sm" color="primary" onPress={() => fetchConversations()}>
                    Retry
                  </Button>
                </div>
              ) : (
                <>
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
                          <Search size={48} className="text-gray-400 mb-4" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            No archived conversations
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 text-center">
                            Conversations you archive will appear here
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 px-6">
                          <Search size={48} className="text-gray-400 mb-4" />
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
                    <>
                      {filteredConversations.map(conversation => {
                        const isActive = activeConversationId === conversation.id
                        const isSuperadmin = conversation.id === 'superadmin'

                        return (
                          <React.Fragment key={conversation.id}>
                            <ConversationItem
                              conversation={conversation}
                              isActive={isActive}
                              onPress={handleConversationPress}
                              onPin={id => togglePin([id])}
                              onArchive={id => toggleArchive([id])}
                              onDelete={id => deleteConversations([id])}
                              onMute={id => toggleMute([id])}
                              onMarkAsUnread={id => markAsUnread([id])}
                              onBlock={id => blockConversations([id])}
                              onToggleFavorite={id => toggleFavorite([id])}
                              showActions={!isSuperadmin} // Disable actions for superadmin conversation
                            />
                            {isSuperadmin && (
                              <div className="h-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" />
                            )}
                          </React.Fragment>
                        )
                      })}
                    </>
                  )}
                </>
              )}
            </ScrollShadow>
          </div>
        </div>
      </aside>
    </>
  )
}
