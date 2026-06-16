'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button, Input, ScrollShadow } from '@heroui/react'
import {
  cn,
  type Conversation,
  ConversationItem,
  type FilterType,
  sortConversations,
} from '@world-schools/ui-web'
import { AlertCircle, ChevronLeft, Search, X } from 'lucide-react'
import { ArchivedChatsButton } from '@/components/messages/archived-chats-button'
import { useConversationStore } from '@/stores/conversation-store'
import { useMessagingStore } from '@/stores/messaging-store'
import { ConversationListSkeleton } from '@/components/messages/conversation-skeleton'
import type { ConversationResponseDto } from '@world-schools/wc-frontend-utils'
import { useAuthStore } from '@/stores/auth-store'

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

  // Get current user for filtering participants
  const { user } = useAuthStore()

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
    // Current user's own participant — has the real unreadCount, pinned, starred, etc.
    const currentUserParticipant = conv.participants?.find(p => p.userId === user?.id)
    // Other (provider) participant — used only for display name
    const otherParticipants = conv.participants?.filter(p => p.userId !== user?.id) ?? []
    const providerParticipant = otherParticipants.find(p => p.providerId)
    const providerName = providerParticipant?.provider?.legalCompanyName || 'Provider'
    const isSuperadmin = conv.type === 'USER_SUPERADMIN'
    // Prefer the camp identity (enriched server-side) over the operator org so
    // the card shows the camp — not "World Schools"/"Provider".
    const displayName = isSuperadmin ? 'World Camps Support' : conv.campName || providerName

    return {
      id: conv.id,
      name: displayName,
      lastMessage: conv.lastMessage?.content || '',
      time: getTimestamp(conv.lastActivityAt),
      lastSeen: getTimestamp(conv.lastActivityAt),
      // Camp photo as the conversation avatar; ConversationItem falls back to
      // initials from `name` when empty.
      avatar: isSuperadmin ? '' : conv.campPhotoUrl || '',
      verified: isSuperadmin,
      pinned: currentUserParticipant?.pinned ?? false,
      starred: currentUserParticipant?.starred ?? false,
      archived: currentUserParticipant?.archived ?? false,
      muted: currentUserParticipant?.muted ?? false,
      unread:
        (currentUserParticipant?.unreadCount ?? 0) > 0 || !!currentUserParticipant?.manuallyUnread,
      unreadCount: currentUserParticipant?.unreadCount ?? 0,
      // Per-user settings (pin/star/mute/archive) require a real participant
      // row. Parents always have one; kept here so both apps stay symmetric.
      canManageSettings:
        !!currentUserParticipant && !currentUserParticipant.id.startsWith('virtual-'),
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

    // Shared world-class ordering: pinned group first, then most recent
    // activity, stable on ties.
    return sortConversations(filtered)
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
      // Read-marking happens in setActiveConversation when the conversation opens
      // (optimistic clear + persist), so we don't duplicate it here.
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        // Mobile: navigate via URL so the layout switches to conversation view
        router.push(`/messages/${conversation.id}`)
      } else {
        // Desktop: event-based selection (WhatsApp Web pattern — no URL change)
        window.dispatchEvent(
          new CustomEvent('selectConversation', {
            detail: conversation,
          })
        )
      }
    },
    [router]
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
          'lg:h-full bg-white dark:bg-gray-900/95 backdrop-blur-md',
          'border-r border-gray-200 dark:border-gray-700',
          'fixed inset-x-0 top-0 bottom-16 lg:static z-40',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'transition-all duration-300 ease-in-out',
          'w-full lg:w-96'
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
                              onMute={id => toggleMute([id])}
                              onMarkAsUnread={id => markAsUnread([id])}
                              onMarkAsRead={id => markAsRead(id)}
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
