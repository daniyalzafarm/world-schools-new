'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'

import {
  Badge,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Tooltip,
} from '@heroui/react'

import { cn } from '@world-schools/ui-web'
import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'
import {
  ArrowLeftToLine,
  Check,
  ChevronDown,
  ChevronRight,
  Edit,
  ExternalLink,
  GraduationCap,
  History,
  Home,
  LogOut,
  MessageCircle,
  MoreVertical,
  Pin,
  School,
  Search,
  Settings,
  Tent,
  Trash2,
  X,
} from 'lucide-react'
import { HistoryModal } from '@/components/chat/history-modal'
import { useChatHistoryStore } from '@/stores/chat-history-store'
import { useConversationStore } from '@/stores/conversation-store'
import { isAdmin } from '@/utils/auth'
import { getGroupedHistory, getPinnedHistory } from '@/utils/chat-history-helpers'
import { adminConversationData, conversationData } from '@/data/conversations'

// Custom hooks for better state management
const useSidebarExpansion = (onToggleCollapse: () => void) => {
  const [isHovered, setIsHovered] = React.useState(false)
  const [isManuallyExpanded, setIsManuallyExpanded] = React.useState(false)
  const [isExpandedFully, setIsExpandedFully] = React.useState(false)
  const [isSearchReady, setIsSearchReady] = React.useState(false)
  const [hoverTimeout, setHoverTimeout] = React.useState<NodeJS.Timeout | null>(null)
  const searchIconTimerRef = React.useRef<NodeJS.Timeout | null>(null)

  const startSearchIconTimer = React.useCallback(() => {
    if (searchIconTimerRef.current) {
      clearTimeout(searchIconTimerRef.current)
      searchIconTimerRef.current = null
    }
    searchIconTimerRef.current = setTimeout(() => setIsSearchReady(true), 180)
  }, [])

  const clearSearchIconTimer = React.useCallback(() => {
    if (searchIconTimerRef.current) {
      clearTimeout(searchIconTimerRef.current)
      searchIconTimerRef.current = null
    }
  }, [])

  const resetSearchState = React.useCallback(() => {
    setIsExpandedFully(false)
    setIsSearchReady(false)
    clearSearchIconTimer()
  }, [clearSearchIconTimer])

  const expandSidebar = React.useCallback(() => {
    setIsHovered(true)
    resetSearchState()
    onToggleCollapse()
    if (!isManuallyExpanded) startSearchIconTimer()
  }, [isManuallyExpanded, onToggleCollapse, resetSearchState, startSearchIconTimer])

  const collapseSidebar = React.useCallback(() => {
    setIsHovered(false)
    resetSearchState()
    onToggleCollapse()
  }, [onToggleCollapse, resetSearchState])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeout) clearTimeout(hoverTimeout)
      clearSearchIconTimer()
    }
  }, [hoverTimeout, clearSearchIconTimer])

  return {
    isHovered,
    isManuallyExpanded,
    setIsManuallyExpanded,
    isExpandedFully,
    setIsExpandedFully,
    isSearchReady,
    hoverTimeout,
    setHoverTimeout,
    expandSidebar,
    collapseSidebar,
    resetSearchState,
    startSearchIconTimer,
    clearSearchIconTimer,
  }
}

const useSidebarSections = () => {
  const [expandedSections, setExpandedSections] = React.useState({
    services: false,
    pinned: true,
    history: false,
  })

  const toggleSection = React.useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }, [])

  return { expandedSections, setExpandedSections, toggleSection }
}

const useHistoryEditing = () => {
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null)
  const [editingTitle, setEditingTitle] = React.useState('')

  const startEditing = React.useCallback((itemId: string, currentTitle: string) => {
    setEditingItemId(itemId)
    setEditingTitle(currentTitle)
  }, [])

  const cancelEditing = React.useCallback(() => {
    setEditingItemId(null)
    setEditingTitle('')
  }, [])

  return {
    editingItemId,
    editingTitle,
    setEditingTitle,
    startEditing,
    cancelEditing,
  }
}

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

interface NavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  isExternal?: boolean
  type?: string
}

// Navigation item types for easier identification
const ITEM_TYPES = {
  HISTORY: 'history',
  SERVICES: 'services',
  PINNED: 'pinned',
} as const

const baseNavigationItems = [
  {
    name: 'New Chat',
    href: '/chat/new',
    icon: <Edit size={20} />,
    type: 'regular',
  },
  {
    name: 'Messages',
    href: '/messages',
    icon: <MessageCircle size={20} />,
    type: 'regular',
  },
  {
    name: 'Services',
    href: '',
    icon: <GraduationCap size={20} />,
    type: ITEM_TYPES.SERVICES,
  },
]

const pinnedNavigationItem = {
  name: 'Pinned',
  href: '/pinned',
  icon: <Pin size={20} />,
  type: ITEM_TYPES.PINNED,
}

const historyNavigationItem = {
  name: 'History',
  href: '/history',
  icon: <History size={20} />,
  type: ITEM_TYPES.HISTORY,
}

const adminNavigationItems = [
  {
    name: 'Dashboard',
    href: '/admin/dashboard',
    icon: <Home size={20} />,
    type: 'regular',
  },
  {
    name: 'Messages',
    href: '/admin/messages',
    icon: <MessageCircle size={20} />,
    type: 'regular',
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: <Settings size={20} />,
    type: 'regular',
  },
]

const servicesItems = [
  {
    name: 'WorldSchools',
    href: 'https://world-schools.com',
    icon: <School size={20} />,
    isExternal: true,
  },
  {
    name: 'WorldCamps',
    href: 'https://world-camps.org',
    icon: <Tent size={20} />,
    isExternal: true,
  },
]

// Common style classes to reduce duplication
const COMMON_STYLES = {
  historyItem:
    'flex items-center px-3 h-9 rounded-lg cursor-pointer transition-all duration-100 relative group text-sm font-medium select-none whitespace-nowrap overflow-hidden',
  activeItem: 'bg-primary-100 dark:bg-primary-900/30',
  hoverItem: 'hover:bg-gray-200 dark:hover:bg-gray-800',
  menuButton:
    'cursor-pointer bg-gray-300/70 hover:bg-gray-300 dark:bg-gray-800/50 hover:dark:bg-gray-800/70 rounded-lg p-1',
  actionButton: 'cursor-pointer hover:bg-gray-300 rounded-lg p-1',
} as const

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout, isAuthenticated } = useAuthStore()

  // Collapsed state is managed locally within the sidebar
  const [isCollapsed, setIsCollapsed] = React.useState(true)
  const toggleCollapsed = () => {
    setIsCollapsed(prev => !prev)
  }

  // Check if we're on the messages route (including admin messages and nested routes)
  const isOnMessagesRoute =
    pathname.startsWith('/messages') || pathname.startsWith('/admin/messages')

  // Custom hooks for state management
  const { expandedSections, setExpandedSections, toggleSection } = useSidebarSections()
  const {
    isHovered,
    isManuallyExpanded,
    setIsManuallyExpanded,
    isExpandedFully,
    setIsExpandedFully,
    isSearchReady,
    hoverTimeout,
    setHoverTimeout,
    expandSidebar,
    collapseSidebar,
    resetSearchState,
    startSearchIconTimer,
  } = useSidebarExpansion(toggleCollapsed)

  const { editingItemId, editingTitle, setEditingTitle, startEditing, cancelEditing } =
    useHistoryEditing()

  // Simple state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = React.useState(false)
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null)
  const [hoveredHistoryItem, setHoveredHistoryItem] = React.useState<string | null>(null)

  // Refs
  const asideRef = React.useRef<HTMLDivElement | null>(null)
  const userSectionRef = React.useRef<HTMLDivElement | null>(null)

  // Simplified mouse event handlers
  const handleMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Safely check if the target is within the user section
      const target = e.target as Node
      const isInUserSection = target instanceof Node && userSectionRef.current?.contains(target)

      if (isManuallyExpanded || isInUserSection) return
      if (!isOnMessagesRoute && isCollapsed) {
        if (hoverTimeout) clearTimeout(hoverTimeout)
        const timeout = setTimeout(() => expandSidebar(), 300)
        setHoverTimeout(timeout)
      }
    },
    [isManuallyExpanded, isOnMessagesRoute, isCollapsed, hoverTimeout, expandSidebar]
  )

  const handleMouseLeave = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isManuallyExpanded) return

      const nextTarget = (e.relatedTarget ?? (e as any).nativeEvent?.relatedTarget) as Node | null
      // Safely check if we're leaving the sidebar by ensuring nextTarget is a valid Node
      const leavingSidebar =
        !nextTarget || !(nextTarget instanceof Node) || !asideRef.current?.contains(nextTarget)

      if (!isOnMessagesRoute && isCollapsed) {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout)
          setHoverTimeout(null)
        }
      } else if (!isOnMessagesRoute && isHovered && !isCollapsed && leavingSidebar) {
        if (hoverTimeout) clearTimeout(hoverTimeout)
        const timeout = setTimeout(() => collapseSidebar(), 100)
        setHoverTimeout(timeout)
      }
    },
    [isManuallyExpanded, isOnMessagesRoute, isCollapsed, isHovered, hoverTimeout, collapseSidebar]
  )

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Safely check if the target is within the user section
      const target = e.target as Node
      const isInUserSection = target instanceof Node && userSectionRef.current?.contains(target)

      if (isInUserSection && hoverTimeout) {
        clearTimeout(hoverTimeout)
        setHoverTimeout(null)
      }
    },
    [hoverTimeout]
  )

  const handleClickableAreaClick = React.useCallback(() => {
    if (!isCollapsed) {
      setIsManuallyExpanded(false)
      collapseSidebar()
    } else {
      resetSearchState()
      toggleCollapsed()
      startSearchIconTimer()
    }
  }, [
    isCollapsed,
    setIsManuallyExpanded,
    collapseSidebar,
    resetSearchState,
    toggleCollapsed,
    startSearchIconTimer,
  ])

  // Listen for width transition end to mark expanded state completion
  React.useEffect(() => {
    const el = asideRef.current
    if (!el) return
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'width') setIsExpandedFully(!isCollapsed)
    }
    el.addEventListener('transitionend', onEnd as any)
    return () => el.removeEventListener('transitionend', onEnd as any)
  }, [isCollapsed, setIsExpandedFully])

  // Chat history store
  const { chatHistory, updateChatTitle, togglePin, deleteChat } = useChatHistoryStore()

  // Conversation store
  const { userConversations, adminConversations, setUserConversations, setAdminConversations } =
    useConversationStore()

  // Check if current user is admin
  const userIsAdmin = isAdmin(user)

  // Initialize conversation data on mount
  React.useEffect(() => {
    if (userIsAdmin) {
      if (adminConversations.length === 0) {
        setAdminConversations(adminConversationData)
      }
    } else {
      if (userConversations.length === 0) {
        setUserConversations(conversationData)
      }
    }
  }, [
    userIsAdmin,
    userConversations.length,
    adminConversations.length,
    setUserConversations,
    setAdminConversations,
  ])

  // Get grouped history items for sidebar display (only for non-admin users)
  const groupedHistory = React.useMemo(() => {
    if (userIsAdmin) return {}
    return getGroupedHistory(chatHistory)
  }, [userIsAdmin, chatHistory])

  // Get pinned history items
  const pinnedHistory = React.useMemo(() => {
    if (userIsAdmin) return []
    return getPinnedHistory(chatHistory)
  }, [userIsAdmin, chatHistory])

  // Calculate total unread conversations count
  const totalUnreadCount = React.useMemo(() => {
    const conversations = userIsAdmin ? adminConversations : userConversations
    return conversations.filter(
      conv => !conv.archived && (conv.unread || (conv.unreadCount && conv.unreadCount > 0))
    ).length
  }, [userIsAdmin, userConversations, adminConversations])

  // All handlers must be defined before early return
  const toggleCollapseFor = React.useCallback(
    (item: NavigationItem) => {
      const itemType = item.type || 'regular'

      if (itemType === ITEM_TYPES.HISTORY) {
        if (isCollapsed) {
          setIsHistoryModalOpen(true)
        } else {
          toggleSection('history')
        }
      } else if (itemType === ITEM_TYPES.PINNED) {
        toggleSection('pinned')
      } else if (itemType === ITEM_TYPES.SERVICES) {
        toggleSection('services')
      }
    },
    [isCollapsed, toggleSection]
  )

  const handleArrowToggle = React.useCallback(() => {
    if (isCollapsed) {
      setIsManuallyExpanded(true)
      resetSearchState()
      toggleCollapsed()
      startSearchIconTimer()
    } else if (!isManuallyExpanded) {
      setIsManuallyExpanded(true)
    } else {
      setIsManuallyExpanded(false)
      collapseSidebar()
    }
  }, [
    isCollapsed,
    isManuallyExpanded,
    setIsManuallyExpanded,
    resetSearchState,
    toggleCollapsed,
    startSearchIconTimer,
    collapseSidebar,
  ])

  const handleNavigation = React.useCallback(
    (item: NavigationItem) => {
      const itemType = item.type || 'regular'
      const isCollapsible = Object.values(ITEM_TYPES).includes(itemType as any)

      if (itemType === ITEM_TYPES.SERVICES && isCollapsed) {
        toggleCollapsed()
        setExpandedSections(prev => ({ ...prev, services: true }))
        return
      }

      if (isCollapsible) {
        if (isCollapsed) toggleCollapsed()
        toggleCollapseFor(item)
        return
      }

      if (item.isExternal) {
        window.open(item.href, '_blank', 'noopener,noreferrer')
      } else if (isCollapsed && itemType === ITEM_TYPES.HISTORY && !userIsAdmin) {
        setIsHistoryModalOpen(true)
      } else {
        router.push(item.href)
      }

      // For mobile view, close the sidebar after navigation
      if (sidebarOpen) setSidebarOpen(false)
    },
    [
      isCollapsed,
      sidebarOpen,
      toggleCollapsed,
      setExpandedSections,
      userIsAdmin,
      router,
      setSidebarOpen,
      toggleCollapseFor,
    ]
  )

  const handleHistoryItemClick = React.useCallback(
    (historyId: string) => {
      router.push(`/chat/${historyId}`)
      setSidebarOpen(false)
    },
    [router, setSidebarOpen]
  )

  const handleSeeMoreClick = React.useCallback(() => {
    setIsHistoryModalOpen(true)
  }, [])

  const handleSaveRename = React.useCallback(() => {
    if (editingItemId && editingTitle.trim()) {
      updateChatTitle(editingItemId, editingTitle.trim())
    }
    cancelEditing()
  }, [editingItemId, editingTitle, updateChatTitle, cancelEditing])

  const handlePin = React.useCallback(
    (itemId: string) => {
      togglePin(itemId)
    },
    [togglePin]
  )

  const handleDelete = React.useCallback(
    (itemId: string) => {
      if (confirm('Are you sure you want to delete this chat?')) {
        deleteChat(itemId)
      }
    },
    [deleteChat]
  )

  // Get appropriate navigation items based on user role and pinned items
  const currentNavigationItems = userIsAdmin
    ? adminNavigationItems
    : pinnedHistory.length > 0
      ? [...baseNavigationItems, pinnedNavigationItem, historyNavigationItem]
      : [...baseNavigationItems, historyNavigationItem]

  // Completely hide sidebar for logged-out users (must come after hooks)
  if (!isAuthenticated) {
    return null
  }

  // Reusable history item renderer to eliminate duplication
  const renderHistoryItem = (historyItem: any, pinAction: 'pin' | 'unpin') => {
    const isActive = pathname === `/chat/${historyItem.id}`
    const isEditing = editingItemId === historyItem.id

    return (
      <div
        key={historyItem.id}
        className={cn(
          COMMON_STYLES.historyItem,
          isActive ? COMMON_STYLES.activeItem : COMMON_STYLES.hoverItem
        )}
        onMouseEnter={() => setHoveredHistoryItem(historyItem.id)}
        onMouseLeave={() => setHoveredHistoryItem(null)}
      >
        {isEditing ? (
          <div className="flex items-center justify-between w-full">
            <input
              type="text"
              value={editingTitle}
              onChange={e => setEditingTitle(e.target.value)}
              className="flex bg-transparent border-none outline-none text-sm font-medium w-4/5"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveRename()
                if (e.key === 'Escape') cancelEditing()
              }}
            />
            <div
              className={cn(
                'flex group-hover:bg-gray-200',
                isActive ? COMMON_STYLES.activeItem : 'bg-[#F9F9F9]'
              )}
            >
              <button onClick={cancelEditing} className={COMMON_STYLES.actionButton}>
                <X size={14} />
              </button>
              <button onClick={handleSaveRename} className={COMMON_STYLES.actionButton}>
                <Check size={14} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 truncate" onClick={() => handleHistoryItemClick(historyItem.id)}>
              {historyItem.title}
            </div>

            {/* 3-dot menu button - only show on hover */}
            {hoveredHistoryItem === historyItem.id && (
              <div className="shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                <Dropdown placement="right-start">
                  <DropdownTrigger>
                    <button className={COMMON_STYLES.menuButton}>
                      <MoreVertical size={16} />
                    </button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Chat options"
                    onAction={key => {
                      if (key === 'rename') {
                        startEditing(historyItem.id, historyItem.title)
                      } else if (key === pinAction) {
                        handlePin(historyItem.id)
                      } else if (key === 'delete') {
                        handleDelete(historyItem.id)
                      }
                    }}
                  >
                    <DropdownItem
                      key="rename"
                      className="text-gray-700 dark:text-gray-300"
                      startContent={<Edit size={16} />}
                    >
                      Rename
                    </DropdownItem>
                    <DropdownItem
                      key={pinAction}
                      className="text-gray-700 dark:text-gray-300"
                      startContent={<Pin size={16} />}
                    >
                      {pinAction === 'pin' ? 'Pin' : 'Unpin'}
                    </DropdownItem>
                    <DropdownItem
                      key="delete"
                      className="text-red-600 dark:text-red-400"
                      startContent={<Trash2 size={16} />}
                    >
                      Delete
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // Helper function to safely get expansion state
  const getExpansionState = (itemType: string) => {
    if (itemType === ITEM_TYPES.HISTORY) return expandedSections.history
    if (itemType === ITEM_TYPES.SERVICES) return expandedSections.services
    if (itemType === ITEM_TYPES.PINNED) return expandedSections.pinned
    return false
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-10 lg:hidden transition-opacity duration-100"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={asideRef}
        className={cn(
          'h-full bg-[#F9F9F9] dark:bg-gray-900/95 backdrop-blur-md z-40',
          'border-r border-gray-200 dark:border-gray-700',
          'fixed lg:static z-20',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-16' : 'w-64'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <div className="flex h-full flex-col">
          {/* Logo section */}
          <div className={cn('pt-4 pb-2', !isCollapsed ? 'px-4' : 'px-4')} data-interactive>
            <div
              className="flex items-center justify-between gap-2 whitespace-nowrap"
              data-interactive
            >
              <div className={cn('flex w-full', 'justify-start')}>
                <div className="shrink-0">
                  <Logo showText={false} size={'md'} />
                </div>
              </div>

              {/* Search icon - show slightly before full expand, and after complete */}
              {!userIsAdmin && (isSearchReady || (isExpandedFully && !isCollapsed)) && (
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  radius="md"
                  onPress={handleSeeMoreClick}
                >
                  <Search size={20} />
                </Button>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-3 space-y-1 overflow-x-hidden" data-interactive>
            {/* Main Navigation Items */}
            {currentNavigationItems.map(item => {
              const isActive = pathname === item.href
              const itemType = item.type || 'regular'
              const isCollapsible = Object.values(ITEM_TYPES).includes(itemType as any)
              const isExpanded = isCollapsible ? getExpansionState(itemType) : false

              const NavigationItem = (
                <div key={item.href} className="w-full">
                  <div
                    onClick={() => handleNavigation(item)}
                    className={cn(
                      'flex h-10 items-center p-2 rounded-lg cursor-pointer whitespace-nowrap overflow-hidden',
                      isActive ? 'bg-primary-100' : 'hover:bg-gray-200 dark:hover:bg-gray-800',
                      isCollapsed && ''
                    )}
                    onMouseEnter={() => setHoveredItem(item.name)}
                    onMouseLeave={() => setHoveredItem(prev => (prev === item.name ? null : prev))}
                  >
                    <span className="flex justify-center">
                      {!isCollapsed && isCollapsible && hoveredItem === item.name ? (
                        <div
                          className="bg-gray-300/70 hover:bg-gray-300 dark:bg-gray-800/50 hover:dark:bg-gray-800/70 rounded-lg p-1"
                          role="button"
                          tabIndex={0}
                          onClick={e => {
                            e.stopPropagation()
                            toggleCollapseFor(item)
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              ;(e.target as HTMLElement).click()
                            }
                          }}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      ) : item.name === 'Messages' && totalUnreadCount > 0 ? (
                        <Badge
                          content={totalUnreadCount}
                          color="primary"
                          size="sm"
                          shape="circle"
                          placement="top-right"
                          showOutline={false}
                        >
                          {item.icon}
                        </Badge>
                      ) : (
                        item.icon
                      )}
                    </span>
                    {!isCollapsed && (
                      <div
                        className={cn(
                          'flex select-none items-center justify-between w-full whitespace-nowrap overflow-hidden',
                          isCollapsible && hoveredItem === item.name ? 'ml-2' : 'ml-3 '
                        )}
                      >
                        <span className={cn('font-medium')}>{item.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Pinned Sub-items */}
                  {itemType === ITEM_TYPES.PINNED && !isCollapsed && isExpanded && (
                    <div className="mt-1 ml-7 space-y-2">
                      {pinnedHistory.length > 0 ? (
                        pinnedHistory.map(historyItem => renderHistoryItem(historyItem, 'unpin'))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                          No pinned chats
                        </div>
                      )}
                    </div>
                  )}

                  {/* History Sub-items */}
                  {itemType === ITEM_TYPES.HISTORY && !isCollapsed && isExpanded && (
                    <div className="mt-1 ml-8 space-y-2">
                      {Object.entries(groupedHistory).map(([timeGroup, items]) => (
                        <div key={timeGroup} className="space-y-1">
                          {/* Time group header */}
                          <div className="px-3 py-3">
                            <span className="text-sm font-bold text-secondary">{timeGroup}</span>
                          </div>

                          {/* Items in this time group */}
                          {items.map(historyItem => renderHistoryItem(historyItem, 'pin'))}
                        </div>
                      ))}

                      {/* See all button */}
                      <div
                        onClick={handleSeeMoreClick}
                        className={cn(
                          'flex items-center px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap overflow-hidden',
                          'hover:bg-gray-200 dark:hover:bg-gray-800',
                          'text-sm font-medium underline select-none'
                        )}
                      >
                        See all
                      </div>
                    </div>
                  )}

                  {itemType === ITEM_TYPES.SERVICES && !isCollapsed && isExpanded && (
                    <div className="mt-1 ml-3 space-y-1">
                      {servicesItems.map(item => {
                        const NavigationItem = (
                          <div key={item.href} className="ml-5 overflow-hidden">
                            <div
                              key={item.href}
                              onClick={() => handleNavigation(item)}
                              className={cn(
                                'flex items-center px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap overflow-hidden',
                                'hover:bg-gray-200 dark:hover:bg-gray-800',
                                'text-sm font-medium gap-2 select-none'
                              )}
                            >
                              <span className="truncate">{item.name}</span>
                              <div
                                className={cn(
                                  !isCollapsed
                                    ? 'opacity-100 translate-x-0'
                                    : 'opacity-0 translate-x-4 pointer-events-none'
                                )}
                              >
                                <ExternalLink size={20} className="text-primary-dark" />
                              </div>
                            </div>
                          </div>
                        )

                        // Wrap with Tooltip only when collapsed
                        return isCollapsed ? (
                          <Tooltip
                            key={item.href}
                            content={item.name}
                            placement="right"
                            delay={500}
                            closeDelay={0}
                          >
                            {NavigationItem}
                          </Tooltip>
                        ) : (
                          NavigationItem
                        )
                      })}
                    </div>
                  )}
                </div>
              )

              return isCollapsed ? (
                <Tooltip
                  key={item.href}
                  content={item.name}
                  placement="right"
                  delay={500}
                  closeDelay={0}
                >
                  {NavigationItem}
                </Tooltip>
              ) : (
                NavigationItem
              )
            })}
          </nav>

          {/* Clickable area for sidebar toggle */}
          <div
            className={cn(
              'flex-1',
              (isOnMessagesRoute || isManuallyExpanded) &&
                (isCollapsed ? 'cursor-e-resize' : 'cursor-w-resize')
            )}
            onClick={isOnMessagesRoute || isManuallyExpanded ? handleClickableAreaClick : undefined}
          />

          {/* User Section */}
          <div
            ref={userSectionRef}
            className="p-4 border-t border-gray-200 dark:border-gray-700 shadow-[0_-24px_16px_-2px_rgba(249,249,249,0.8)] dark:shadow-[0_-24px_16px_-2px_rgba(17,24,39,0.8)]"
          >
            <div
              className={cn(
                'flex',
                isCollapsed ? 'flex-col items-center gap-2' : 'items-center gap-3'
              )}
            >
              <Dropdown placement="right-end">
                <DropdownTrigger>
                  <div
                    className={cn(
                      'cursor-pointer flex items-center gap-3 hover:bg-gray-200 dark:hover:bg-gray-800/50 rounded-lg p-2',
                      !isCollapsed && 'w-full'
                    )}
                  >
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
                      <span className="text-white font-semibold">
                        {user?.firstName?.charAt(0).toUpperCase() || 'J'}
                      </span>
                    </div>
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {user?.firstName ? `${user.firstName} ${user.lastName}` : 'John Doe'}
                        </p>
                        <p className="text-sm text-secondary truncate">Los Angeles</p>
                      </div>
                    )}
                  </div>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="User menu"
                  onAction={key => {
                    if (key === 'settings') {
                      router.push(userIsAdmin ? '/admin/settings' : '/settings')
                    } else if (key === 'logout') {
                      logout()
                      router.push('/')
                    }
                  }}
                >
                  <DropdownItem
                    key="settings"
                    className="text-gray-700 dark:text-gray-300"
                    startContent={<Settings size={16} />}
                  >
                    Settings
                  </DropdownItem>
                  <DropdownItem
                    key="logout"
                    className="text-red-600 dark:text-red-400"
                    startContent={<LogOut size={16} />}
                  >
                    Logout
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
              <Tooltip
                content={
                  isCollapsed ? 'Expand' : !isManuallyExpanded ? 'Keep expanded' : 'Collapse'
                }
                placement="right"
                delay={100}
                closeDelay={0}
              >
                <Button
                  onPress={handleArrowToggle}
                  variant="light"
                  isIconOnly
                  size="sm"
                  className="min-w-8 w-8 h-8"
                >
                  <ArrowLeftToLine
                    size={20}
                    className={cn(
                      'transition-transform duration-100',
                      (isCollapsed || !isManuallyExpanded) && 'rotate-180'
                    )}
                  />
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </aside>

      {/* History Modal */}
      <HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} />
    </>
  )
}

export default Sidebar
