'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Badge, Button, Tooltip } from '@heroui/react'
import {
  AlertTriangle,
  ArrowLeftToLine,
  Banknote,
  Bell,
  Building,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Gavel,
  Headphones,
  HelpCircle,
  House,
  LayoutGrid,
  List,
  Notebook,
  Receipt,
  ShieldCheck,
  Tent,
  User,
  Users,
} from 'lucide-react'
import { cn, UserAvatar } from '@world-schools/ui-web'

import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'
import { eventBus } from '@world-schools/wc-utils'
import { usePermissions } from '@/hooks/use-permissions'
import { hasRouteAccess } from '@/utils/navigation'
import { disputesService } from '@/services/disputes.services'
import { supportTicketsService } from '@/services/support-tickets.services'
import { useUnreadNotificationsCount } from '@/hooks/use-unread-notifications-count'
import { useUnreadApplicationsCount } from '@/hooks/use-unread-applications-count'

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

interface NavSection {
  /** Uppercase group heading. Omit for the trailing footer-style group. */
  title?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Insights',
    items: [
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
    ],
  },
  {
    title: 'Users',
    items: [
      {
        name: 'All Providers',
        href: '/providers',
        icon: <Building size={20} />,
        type: 'regular',
      },
      {
        name: 'Parents',
        href: '/parents',
        icon: <Users size={20} />,
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
    ],
  },
  {
    title: 'Content',
    items: [
      {
        name: 'Camps',
        href: '/camps',
        icon: <Tent size={20} />,
        type: 'regular',
      },
      {
        name: 'Activity Catalogue',
        href: '/catalogue',
        icon: <FolderOpen size={20} />,
        type: 'regular',
      },
      {
        name: 'Knowledge Base',
        icon: <Notebook size={20} />,
        type: 'collapsible',
        children: [
          {
            name: 'Articles',
            href: '/kb/articles',
            icon: <List size={20} />,
            type: 'regular',
          },
          {
            name: 'Categories',
            href: '/kb/categories',
            icon: <LayoutGrid size={20} />,
            type: 'regular',
          },
        ],
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        name: 'Support',
        href: '/support',
        icon: <Headphones size={20} />,
        type: 'regular',
      },
      {
        name: 'Provider Reviews',
        href: '/provider-reviews',
        icon: <ShieldCheck size={20} />,
        type: 'regular',
      },
      {
        name: 'Reimbursements',
        href: '/reimbursements',
        icon: <Receipt size={20} />,
        type: 'regular',
      },
      {
        name: 'Disputes',
        href: '/disputes',
        icon: <Gavel size={20} />,
        type: 'regular',
      },
      {
        name: 'Payment Reviews',
        href: '/payment-reviews',
        icon: <Banknote size={20} />,
        type: 'regular',
      },
      {
        name: 'Force Majeure',
        href: '/force-majeure',
        icon: <AlertTriangle size={20} />,
        type: 'regular',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        name: 'Notifications',
        href: '/notifications',
        icon: <Bell size={20} />,
        type: 'regular',
      },
    ],
  },
  {
    title: 'Support',
    items: [
      {
        name: 'Help',
        href: '/help',
        icon: <HelpCircle size={20} />,
        type: 'regular',
      },
    ],
  },
]

export const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuthStore()
  const { hasPermission } = usePermissions()
  const [openTicketCount, setOpenTicketCount] = React.useState<number>(0)
  const [openDisputeCount, setOpenDisputeCount] = React.useState<number>(0)
  const unreadNotificationsCount = useUnreadNotificationsCount()
  const unreadApplicationsCount = useUnreadApplicationsCount()

  // Collapsed state is managed locally within the sidebar
  const [isCollapsed, setIsCollapsed] = React.useState(false) // Start expanded
  const toggleCollapsed = () => {
    setIsCollapsed(prev => !prev)
  }

  // Support tickets open count (for badge) when user has permission
  React.useEffect(() => {
    if (!hasPermission('support_tickets.read')) return
    supportTicketsService
      .getTicketStats()
      .then(result => (result.success ? setOpenTicketCount(result.data.open) : undefined))
      .catch(() => {})
    const interval = setInterval(
      () => {
        supportTicketsService
          .getTicketStats()
          .then(result => (result.success ? setOpenTicketCount(result.data.open) : undefined))
          .catch(() => {})
      },
      5 * 60 * 1000
    )
    return () => clearInterval(interval)
  }, [hasPermission])

  // Open dispute count (for badge) when user has permission. Mirrors the
  // support-tickets pattern above.
  React.useEffect(() => {
    if (!hasPermission('disputes.read')) return
    const fetchOpen = () => {
      disputesService
        .list({ outcome: 'open', limit: 1 })
        .then(result => (result.success ? setOpenDisputeCount(result.data.total) : undefined))
        .catch(() => {})
    }
    fetchOpen()
    const interval = setInterval(fetchOpen, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [hasPermission])

  // Custom hook for state management
  const {
    isHovered,
    isManuallyExpanded,
    setIsManuallyExpanded,
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

  /**
   * Filter navigation items (and their children) based on user permissions, then drop any
   * section left empty.
   * Visibility is derived from the shared ROUTES config (single source of truth) so the
   * sidebar and the RouteGuard can never disagree about what a user may access. A collapsible
   * parent with no destination is visible if any of its children are accessible.
   */
  const visibleSections = React.useMemo(() => {
    const userPermissions = user?.permissions ?? []
    const isVisible = (item: NavItem): boolean => {
      if (item.href) return hasRouteAccess(item.href, userPermissions)
      if (item.children?.length) return item.children.some(isVisible)
      return true
    }
    return NAV_SECTIONS.map(section => ({
      ...section,
      items: section.items
        .filter(isVisible)
        .map(item =>
          item.children?.length ? { ...item, children: item.children.filter(isVisible) } : item
        ),
    })).filter(section => section.items.length > 0)
  }, [user])

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
          'h-full bg-white dark:bg-gray-900 backdrop-blur-md z-40',
          'border-r border-default-200 dark:border-gray-700',
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
          <div className={cn('pt-4 pb-2', !isCollapsed ? 'px-4' : 'px-4')}>
            <div className="flex items-center justify-between gap-2 whitespace-nowrap overflow-hidden">
              <div className={cn('flex w-full', 'justify-start')}>
                <div className="shrink-0">
                  <Logo showText={!isCollapsed} />
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-3 overflow-x-hidden">
            {/* Main Navigation Items, grouped into sections */}
            {visibleSections.map((section, sectionIdx) => (
              <div
                key={section.title ?? `section-${sectionIdx}`}
                className={cn(sectionIdx > 0 && 'mt-2')}
              >
                {!isCollapsed && section.title && (
                  <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-default-400 dark:text-gray-500">
                    {section.title}
                  </div>
                )}
                <div className="space-y-1">
                  {section.items.map(item => {
                    const isActive = item.href ? pathname.startsWith(item.href) : false
                    const itemType = item.type || 'regular'
                    const isCollapsible = itemType === 'collapsible'
                    const isExpanded = isCollapsible ? expandedSections[item.name] : false
                    const hasChildren = item.children && item.children.length > 0

                    // Get dynamic badge count for Provider Requests / Support Tickets / Disputes
                    const badgeCount =
                      item.name === 'All Providers' && unreadApplicationsCount > 0
                        ? unreadApplicationsCount
                        : item.name === 'Support Tickets' && openTicketCount > 0
                          ? openTicketCount
                          : item.name === 'Disputes' && openDisputeCount > 0
                            ? openDisputeCount
                            : item.name === 'Notifications' && unreadNotificationsCount > 0
                              ? unreadNotificationsCount
                              : item.badge

                    const NavigationItem = (
                      <div key={item.name} className="w-full">
                        <div
                          onClick={() => handleNavigation(item)}
                          className={cn(
                            'flex h-10 items-center p-2 rounded-lg cursor-pointer whitespace-nowrap overflow-hidden',
                            isActive
                              ? 'bg-primary-100'
                              : 'hover:bg-default-100 dark:hover:bg-gray-800'
                          )}
                        >
                          <span className="flex justify-center min-w-6">
                            {badgeCount ? (
                              <Badge
                                color="primary"
                                content={badgeCount}
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
                                  {isExpanded ? (
                                    <ChevronDown size={16} />
                                  ) : (
                                    <ChevronRight size={16} />
                                  )}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Children items */}
                        {hasChildren && isExpanded && !isCollapsed && (
                          <div className="ml-6 mt-1 space-y-1">
                            {item.children!.map(child => {
                              const childIsActive = child.href
                                ? pathname.startsWith(child.href)
                                : false
                              return (
                                <Link key={child.name} href={child.href || '#'}>
                                  <div
                                    className={cn(
                                      'flex h-9 items-center p-2 rounded-lg cursor-pointer text-sm',
                                      childIsActive
                                        ? 'bg-primary-100 dark:bg-primary-900/30'
                                        : 'hover:bg-default-100 dark:hover:bg-gray-800'
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
                </div>
              </div>
            ))}
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
            className="p-4 border-t border-default-200 dark:border-gray-700 shadow-[0_-24px_16px_-2px_rgba(249,249,249,0.8)] dark:shadow-[0_-24px_16px_-2px_rgba(17,24,39,0.8)]"
          >
            <div
              className={cn(
                'flex',
                isCollapsed ? 'flex-col items-center gap-2' : 'items-center gap-3'
              )}
            >
              <div
                className={cn(
                  'cursor-pointer flex items-center gap-2 hover:bg-default-100 dark:hover:bg-gray-800/50 rounded-lg p-2',
                  !isCollapsed && 'w-5/6'
                )}
                onClick={() => {
                  router.push('/account')
                  if (sidebarOpen) setSidebarOpen(false)
                }}
              >
                <UserAvatar
                  photoUrl={user?.profilePhotoUrl}
                  fullName={userFullName}
                  variant="flat"
                  className="w-8 h-8 text-sm"
                />
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {userFullName}
                    </p>
                    <p className="text-xs text-secondary truncate">{user?.email}</p>
                  </div>
                )}
              </div>
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
