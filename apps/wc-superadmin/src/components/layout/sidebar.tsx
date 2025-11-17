'use client'

import React from 'react'
import Link from 'next/link'
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
import {
  ArrowLeftToLine,
  Banknote,
  Bell,
  Building,
  ChevronDown,
  ChevronRight,
  House,
  Inbox,
  ListPlus,
  LogOut,
  MessageCircle,
  MessageCircleWarning,
  Settings,
  ShieldCheck,
  User,
} from 'lucide-react'
import { cn } from '@world-schools/ui-web'

import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'
import { eventBus } from '@world-schools/wc-utils'

// Custom hook for sidebar expansion state management
const useSidebarExpansion = (onToggleCollapse: () => void) => {
  const [isHovered, setIsHovered] = React.useState(false)
  const [isManuallyExpanded, setIsManuallyExpanded] = React.useState(true) // Start as manually expanded
  const [isExpandedFully, setIsExpandedFully] = React.useState(false)
  const [hoverTimeout, setHoverTimeout] = React.useState<NodeJS.Timeout | null>(null)

  const expandSidebar = React.useCallback(() => {
    setIsHovered(true)
    onToggleCollapse()
  }, [onToggleCollapse])

  const collapseSidebar = React.useCallback(() => {
    setIsHovered(false)
    onToggleCollapse()
  }, [onToggleCollapse])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeout) clearTimeout(hoverTimeout)
    }
  }, [hoverTimeout])

  return {
    isHovered,
    isManuallyExpanded,
    setIsManuallyExpanded,
    isExpandedFully,
    setIsExpandedFully,
    hoverTimeout,
    setHoverTimeout,
    expandSidebar,
    collapseSidebar,
  }
}

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

interface NavItem {
  name: string
  href?: string
  icon: React.ReactNode
  badge?: number
  children?: NavItem[]
  type?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Analytics Dashboard',
    href: '/analytics-dashboard',
    icon: <House size={20} />,
    type: 'regular',
  },
  {
    name: 'Financial Dashboard',
    href: '/financial-dashboard',
    icon: <Banknote size={20} />,
    type: 'regular',
  },
  {
    name: 'Provider Requests',
    href: '/provider-requests',
    icon: <ListPlus size={20} />,
    badge: 2,
    type: 'regular',
  },
  {
    name: 'Provider Messages',
    href: '',
    icon: <MessageCircle size={20} />,
    type: 'collapsible',
    badge: 4,
    children: [
      {
        name: 'My Inbox',
        href: '/provider-messages/my-inbox',
        badge: 2,
        icon: <MessageCircle size={18} />,
      },
      {
        name: 'Unassigned',
        href: '/provider-messages/unassigned',
        badge: 2,
        icon: <MessageCircleWarning size={18} />,
      },
      { name: 'Team Inbox', href: '/provider-messages/team-inbox', icon: <Inbox size={18} /> },
    ],
  },
  {
    name: 'User Messages',
    href: '',
    icon: <MessageCircle size={20} />,
    type: 'collapsible',
    children: [
      { name: 'My Inbox', href: '/user-messages/my-inbox', icon: <MessageCircle size={18} /> },
      {
        name: 'Unassigned',
        href: '/user-messages/unassigned',
        icon: <MessageCircleWarning size={18} />,
      },
      { name: 'Team Inbox', href: '/user-messages/team-inbox', icon: <Inbox size={18} /> },
    ],
  },
  {
    name: 'All Providers',
    href: '/all-providers',
    icon: <Building size={20} />,
    type: 'regular',
  },
  {
    name: 'Users',
    href: '/users',
    icon: <User size={20} />,
    type: 'regular',
  },
  {
    name: 'Roles',
    href: '/roles',
    icon: <ShieldCheck size={20} />,
    type: 'regular',
  },
  {
    name: 'Notifications',
    href: '/notifications',
    icon: <Bell size={20} />,
    badge: 2,
    type: 'regular',
  },
]

export const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  // Collapsed state is managed locally within the sidebar
  const [isCollapsed, setIsCollapsed] = React.useState(false) // Start expanded
  const toggleCollapsed = () => {
    setIsCollapsed(prev => !prev)
  }

  // Custom hook for state management
  const {
    isHovered,
    isManuallyExpanded,
    setIsManuallyExpanded,
    isExpandedFully,
    setIsExpandedFully,
    hoverTimeout,
    setHoverTimeout,
    expandSidebar,
    collapseSidebar,
  } = useSidebarExpansion(toggleCollapsed)

  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    'Provider Messages': false,
    'User Messages': false,
  })

  // Refs
  const asideRef = React.useRef<HTMLDivElement | null>(null)
  const userSectionRef = React.useRef<HTMLDivElement | null>(null)

  // Mouse event handlers
  const handleMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Safely check if the target is within the user section
      const target = e.target as Node
      const isInUserSection = target instanceof Node && userSectionRef.current?.contains(target)

      if (isManuallyExpanded || isInUserSection) return
      if (isCollapsed) {
        if (hoverTimeout) clearTimeout(hoverTimeout)
        const timeout = setTimeout(() => expandSidebar(), 300)
        setHoverTimeout(timeout)
      }
    },
    [isManuallyExpanded, isCollapsed, hoverTimeout, expandSidebar, setHoverTimeout]
  )

  const handleMouseLeave = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isManuallyExpanded) return

      const nextTarget = (e.relatedTarget ?? (e as any).nativeEvent?.relatedTarget) as Node | null
      // Safely check if we're leaving the sidebar by ensuring nextTarget is a valid Node
      const leavingSidebar =
        !nextTarget || !(nextTarget instanceof Node) || !asideRef.current?.contains(nextTarget)

      if (isCollapsed) {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout)
          setHoverTimeout(null)
        }
      } else if (isHovered && !isCollapsed && leavingSidebar) {
        if (hoverTimeout) clearTimeout(hoverTimeout)
        const timeout = setTimeout(() => collapseSidebar(), 100)
        setHoverTimeout(timeout)
      }
    },
    [isManuallyExpanded, isCollapsed, isHovered, hoverTimeout, collapseSidebar, setHoverTimeout]
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
    [hoverTimeout, setHoverTimeout]
  )

  const handleClickableAreaClick = React.useCallback(() => {
    if (!isCollapsed) {
      if (!isManuallyExpanded) {
        // Sidebar is hover-expanded, lock it open
        setIsManuallyExpanded(true)
      } else {
        // Sidebar is manually expanded, collapse it
        setIsManuallyExpanded(false)
        collapseSidebar()
      }
    } else {
      // Sidebar is collapsed, expand it
      toggleCollapsed()
    }
  }, [isCollapsed, isManuallyExpanded, setIsManuallyExpanded, collapseSidebar])

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

  // Listen for sidebar collapse event from settings page
  React.useEffect(() => {
    const handleCollapseEvent = () => {
      // Only collapse if not already collapsed
      if (!isCollapsed) {
        setIsManuallyExpanded(false)
        setIsCollapsed(true)
      }
    }

    eventBus.$on('sidebar:collapse', 'sidebar-component', handleCollapseEvent)

    return () => {
      eventBus.$off('sidebar:collapse', 'sidebar-component')
    }
  }, [isCollapsed, setIsManuallyExpanded])

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }))
  }

  const handleArrowToggle = React.useCallback(() => {
    if (isCollapsed) {
      setIsManuallyExpanded(true)
      toggleCollapsed()
    } else if (!isManuallyExpanded) {
      setIsManuallyExpanded(true)
    } else {
      setIsManuallyExpanded(false)
      collapseSidebar()
    }
  }, [isCollapsed, isManuallyExpanded, setIsManuallyExpanded, collapseSidebar])

  const handleNavigation = React.useCallback(
    (item: NavItem) => {
      const itemType = item.type || 'regular'

      if (itemType === 'collapsible') {
        if (isCollapsed) toggleCollapsed()
        toggleSection(item.name)
        return
      }

      if (item.href) {
        router.push(item.href)
      }

      // For mobile view, close the sidebar after navigation
      if (sidebarOpen) setSidebarOpen(false)
    },
    [isCollapsed, router, sidebarOpen, setSidebarOpen]
  )

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'WC'
    : 'WC'
  const userFullName = user?.firstName ? `${user.firstName} ${user.lastName}`.trim() : 'Superadmin'

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
          'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          isCollapsed ? 'w-16' : 'w-64'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <div className="flex h-full flex-col">
          {/* Logo section */}
          <div className={cn('pt-4 pb-2', !isCollapsed ? 'px-4' : 'px-4')}>
            <div className="flex items-center justify-between gap-2 whitespace-nowrap overflow-hidden">
              <div className={cn('flex w-full', 'justify-start')}>
                <div className="flex-shrink-0">
                  <Logo size={'md'} showText={!isCollapsed} />
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-3 space-y-1 overflow-x-hidden">
            {/* Main Navigation Items */}
            {NAV_ITEMS.map(item => {
              const isActive = item.href ? pathname.startsWith(item.href) : false
              const itemType = item.type || 'regular'
              const isCollapsible = itemType === 'collapsible'
              const isExpanded = isCollapsible ? expandedSections[item.name] : false
              const hasChildren = item.children && item.children.length > 0

              const NavigationItem = (
                <div key={item.name} className="w-full">
                  <div
                    onClick={() => handleNavigation(item)}
                    className={cn(
                      'flex h-10 items-center p-2 rounded-lg cursor-pointer whitespace-nowrap overflow-hidden',
                      isActive ? 'bg-primary-100' : 'hover:bg-gray-200 dark:hover:bg-gray-800'
                    )}
                  >
                    <span className="flex justify-center min-w-6">
                      {item.badge ? (
                        <Badge
                          color="primary"
                          content={item.badge}
                          size="sm"
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
                      <>
                        <span className="ml-3 flex-1 text-sm font-medium">{item.name}</span>
                        {isCollapsible && (
                          <span className="ml-auto">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Children items */}
                  {hasChildren && isExpanded && !isCollapsed && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children!.map(child => {
                        const childIsActive = child.href ? pathname.startsWith(child.href) : false
                        return (
                          <Link key={child.name} href={child.href || '#'}>
                            <div
                              className={cn(
                                'flex h-9 items-center p-2 rounded-lg cursor-pointer text-sm',
                                childIsActive
                                  ? 'bg-primary-100 dark:bg-primary-900/30'
                                  : 'hover:bg-gray-200 dark:hover:bg-gray-800'
                              )}
                              onClick={() => {
                                if (sidebarOpen) setSidebarOpen(false)
                              }}
                            >
                              {child.badge ? (
                                <Badge
                                  color="primary"
                                  content={child.badge}
                                  size="sm"
                                  placement="top-right"
                                  showOutline={false}
                                >
                                  {child.icon}
                                </Badge>
                              ) : (
                                child.icon
                              )}
                              <span className="ml-2">{child.name}</span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )

              return isCollapsed ? (
                <Tooltip
                  key={item.name}
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
              (isManuallyExpanded || isHovered) &&
                (isManuallyExpanded ? 'cursor-w-resize' : 'cursor-e-resize')
            )}
            onClick={isManuallyExpanded || isHovered ? handleClickableAreaClick : undefined}
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
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold">{userInitials}</span>
                    </div>
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {userFullName}
                        </p>
                        <p className="text-sm text-secondary truncate">World Camps HQ</p>
                      </div>
                    )}
                  </div>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="User menu"
                  onAction={key => {
                    if (key === 'settings') {
                      router.push('/settings/profile')
                    } else if (key === 'logout') {
                      logout().catch(e => console.error(e))
                      router.push('/auth/signin')
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
    </>
  )
}
