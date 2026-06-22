'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, ScrollShadow } from '@heroui/react'
import { cn, type Conversation, ConversationItem, sortConversations } from '@world-schools/ui-web'
import { AlertCircle, ChevronLeft, Search, X } from 'lucide-react'
import { useConversationStore } from '@/stores/conversation-store'
import { useMessagingStore } from '@/stores/messaging-store'
import { ConversationListSkeleton } from '@/components/messages/conversation-skeleton'
import type { ConversationResponseDto } from '@world-schools/wc-frontend-utils'
import { useAuthStore } from '@/stores/auth-store'

interface MessagesSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

// Provider inbox tabs. Bookings are threads tied to a confirmed booking
// (contextType BOOKING); Inquiries are all other non-archived threads.
type MessageFilter = 'all' | 'inquiries' | 'bookings' | 'archived'

// Empty-state copy per tab, shown when a tab has no conversations.
const EMPTY_STATE_COPY: Record<MessageFilter, { title: string; subtitle: string }> = {
  all: { title: 'No conversations', subtitle: 'Start a new conversation to get started' },
  inquiries: { title: 'No inquiries', subtitle: 'New inquiries will appear here' },
  bookings: {
    title: 'No booking conversations',
    subtitle: 'Conversations about bookings will appear here',
  },
  archived: {
    title: 'No archived conversations',
    subtitle: 'Conversations you archive will appear here',
  },
}

export const MessagesSidebar: React.FC<MessagesSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [activeFilter, setActiveFilter] = useState<MessageFilter>('all')

  // Get current user for identifying own participant in conversations
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
    typingUsers,
  } = useMessagingStore()

  // Helper: Safely convert date to timestamp (handles both Date objects and ISO strings)
  const getTimestamp = (date: Date | string | undefined): number => {
    if (!date) return Date.now()
    if (date instanceof Date) return date.getTime()
    return new Date(date).getTime()
  }

  // Convert ConversationResponseDto to UI Conversation type
  const convertToUIConversation = (conv: ConversationResponseDto): Conversation => {
    const isSuperadmin = conv.type === 'USER_SUPERADMIN'

    // Current provider user's own participant — has the real unreadCount, pinned, starred, etc.
    const currentUserParticipant = conv.participants?.find(p => p.userId === user?.id)
    // Booking user participant — for display name (excludes virtual provider org and current user)
    const userParticipant = conv.participants?.find(p => !p.providerId && p.userId !== user?.id)
    const firstName = userParticipant?.user?.firstName || ''
    const lastName = userParticipant?.user?.lastName || ''
    const userName =
      firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'User'

    return {
      id: conv.id,
      name: isSuperadmin ? 'World Camps Support' : userName,
      lastMessage: conv.lastMessage?.content || '',
      // Threads are camp-specific — show the camp as "Asks about: <camp>" so the
      // provider sees which camp each parent is asking about. Falls back to the
      // last-message/active line when there's no camp context (e.g. support).
      contextLabel: isSuperadmin ? undefined : (conv.campName ?? undefined),
      time: getTimestamp(conv.lastActivityAt),
      lastSeen: getTimestamp(conv.lastActivityAt),
      // Parent's profile photo (SAS-resolved); ConversationItem falls back to
      // initials from the name when empty.
      avatar: isSuperadmin ? '' : (userParticipant?.user?.profilePhotoUrl ?? ''),
      verified: isSuperadmin,
      pinned: currentUserParticipant?.pinned ?? false,
      starred: currentUserParticipant?.starred ?? false,
      archived: currentUserParticipant?.archived ?? false,
      muted: currentUserParticipant?.muted ?? false,
      unread:
        (currentUserParticipant?.unreadCount ?? 0) > 0 || !!currentUserParticipant?.manuallyUnread,
      unreadCount: currentUserParticipant?.unreadCount ?? 0,
      // Per-user settings (pin/star/mute/archive) require a real participant
      // row. A provider-org viewer who hasn't replied only has the synthetic
      // "virtual-" participant, so the backend would reject those toggles.
      canManageSettings:
        !!currentUserParticipant && !currentUserParticipant.id.startsWith('virtual-'),
      // Conversation context ('BOOKING' vs everything else) drives the
      // Inquiries / Bookings tab split in the sidebar.
      contextType: conv.contextType ?? undefined,
    }
  }

  // Sync store conversations to local conversation store
  useEffect(() => {
    if (storeConversations.length > 0) {
      const uiConversations = storeConversations.map(convertToUIConversation)
      setUserConversations(uiConversations)
    }
  }, [storeConversations, setUserConversations])

  // Filter and sort conversations based on the active tab and search query.
  // The Archived tab shows archived threads; every other tab shows non-archived
  // threads split by context (Bookings = BOOKING, Inquiries = everything else).
  const filteredConversations = useMemo(() => {
    let filtered: Conversation[]
    switch (activeFilter) {
      case 'archived':
        filtered = userConversations.filter(conv => conv.archived)
        break
      case 'bookings':
        filtered = userConversations.filter(
          conv => !conv.archived && conv.contextType === 'BOOKING'
        )
        break
      case 'inquiries':
        filtered = userConversations.filter(
          conv => !conv.archived && conv.contextType !== 'BOOKING'
        )
        break
      case 'all':
      default:
        filtered = userConversations.filter(conv => !conv.archived)
        break
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
  }, [userConversations, activeFilter, searchQuery])

  // Per-tab UNREAD-conversation counts (badge shown when > 0).
  // allUnread === inquiriesUnread + bookingsUnread.
  const allUnread = userConversations.filter(conv => !conv.archived && conv.unread).length
  const inquiriesUnread = userConversations.filter(
    conv => !conv.archived && conv.contextType !== 'BOOKING' && conv.unread
  ).length
  const bookingsUnread = userConversations.filter(
    conv => !conv.archived && conv.contextType === 'BOOKING' && conv.unread
  ).length
  const archivedUnread = userConversations.filter(conv => conv.archived && conv.unread).length

  // Handle conversation press
  const handleConversationPress = useCallback((conversation: Conversation) => {
    // Read-marking happens in setActiveConversation when the conversation opens
    // (optimistic clear + persist), so we don't duplicate it here.
    window.dispatchEvent(
      new CustomEvent('selectConversation', {
        detail: conversation,
      })
    )
  }, [])

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
                  placeholder="Search conversations..."
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Messages</h1>

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
            {!(searchQuery.trim() !== '' && filteredConversations.length === 0) && (
              <div className="px-3 pb-2 pt-1 border-b border-gray-200 dark:border-gray-700">
                <div className="flex max-w-md gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {(
                    [
                      { key: 'all', label: 'All', count: allUnread },
                      { key: 'inquiries', label: 'Inquiries', count: inquiriesUnread },
                      { key: 'bookings', label: 'Bookings', count: bookingsUnread },
                      { key: 'archived', label: 'Archived', count: archivedUnread },
                    ] as { key: MessageFilter; label: string; count: number }[]
                  ).map(tab => (
                    <Button
                      key={tab.key}
                      size="sm"
                      variant={activeFilter === tab.key ? 'solid' : 'light'}
                      onPress={() => setActiveFilter(tab.key)}
                      radius="full"
                      className={cn(
                        'h-8 flex-1 min-w-fit px-2 text-sm font-medium border-2 border-primary-100',
                        activeFilter === tab.key
                          ? 'bg-primary-100'
                          : 'dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      )}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span
                          className={cn(
                            'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                            activeFilter === tab.key
                              ? 'bg-white text-primary-700'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          )}
                        >
                          {tab.count}
                        </span>
                      )}
                    </Button>
                  ))}
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
                  {filteredConversations.length === 0 ? (
                    <>
                      {searchQuery.trim() !== '' ? (
                        <div className="flex items-center gap-2 px-6 py-4">
                          <Search size={18} className="text-gray-500 dark:text-gray-400" />
                          <p className="font-medium text-gray-500 dark:text-gray-400">No results</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 px-6">
                          <Search size={48} className="text-gray-400 mb-4" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            {EMPTY_STATE_COPY[activeFilter].title}
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 text-center">
                            {EMPTY_STATE_COPY[activeFilter].subtitle}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {filteredConversations.map(conversation => {
                        const isActive = activeConversationId === conversation.id
                        const isSuperadmin = conversation.id === 'superadmin'
                        const isTyping = (typingUsers[conversation.id] ?? []).some(
                          id => id !== user?.id
                        )

                        return (
                          <React.Fragment key={conversation.id}>
                            <ConversationItem
                              conversation={conversation}
                              isActive={isActive}
                              isTyping={isTyping}
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
