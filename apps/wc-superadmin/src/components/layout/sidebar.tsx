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
  Activity,
  ArrowLeftToLine,
  Bell,
  ChartBarBig,
  ChartPie,
  ChevronDown,
  ChevronRight,
  Circle,
  Inbox,
  Layers3,
  LogOut,
  MessageCircle,
  Settings,
  ShieldCheck,
  Users2,
} from 'lucide-react'
import { cn } from '@world-schools/ui-web'

import { Logo } from '@/components/layout/logo'
import { useAuthStore } from '@/stores/auth-store'

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
    icon: <ChartBarBig size={20} />,
    type: 'regular',
  },
  {
    name: 'Financial Dashboard',
    href: '/financial-dashboard',
    icon: <ChartPie size={20} />,
    type: 'regular',
  },
  {
    name: 'Provider Requests',
    href: '/provider-requests',
    icon: <Layers3 size={20} />,
    badge: 2,
    type: 'regular',
  },
  {
    name: 'Provider Messages',
    href: '',
    icon: <Inbox size={20} />,
    type: 'collapsible',
    children: [
      { name: 'My Inbox', href: '/provider-messages/my-inbox', icon: <Circle size={16} /> },
      { name: 'Unassigned', href: '/provider-messages/unassigned', icon: <Circle size={16} /> },
      { name: 'Team Inbox', href: '/provider-messages/team-inbox', icon: <Circle size={16} /> },
    ],
  },
  {
    name: 'User Messages',
    href: '',
    icon: <MessageCircle size={20} />,
    type: 'collapsible',
    children: [
      { name: 'My Inbox', href: '/user-messages/my-inbox', icon: <Circle size={16} /> },
      { name: 'Unassigned', href: '/user-messages/unassigned', icon: <Circle size={16} /> },
      { name: 'Team Inbox', href: '/user-messages/team-inbox', icon: <Circle size={16} /> },
    ],
  },
  {
    name: 'All Providers',
    href: '/all-providers',
    icon: <Activity size={20} />,
    type: 'regular',
  },
  {
    name: 'Users',
    href: '/users',
    icon: <Users2 size={20} />,
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
  const [isCollapsed, setIsCollapsed] = React.useState(true)
  const [isManuallyExpanded, setIsManuallyExpanded] = React.useState(false)
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    'Provider Messages': false,
    'User Messages': false,
  })

  // Refs
  const asideRef = React.useRef<HTMLDivElement | null>(null)
  const userSectionRef = React.useRef<HTMLDivElement | null>(null)

  const toggleCollapsed = () => {
    setIsCollapsed(prev => !prev)
  }

  const handleArrowToggle = React.useCallback(() => {
    if (isCollapsed) {
      setIsManuallyExpanded(true)
      toggleCollapsed()
    } else if (!isManuallyExpanded) {
      setIsManuallyExpanded(true)
    } else {
      setIsManuallyExpanded(false)
      setIsCollapsed(true)
    }
  }, [isCollapsed, isManuallyExpanded])

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }))
  }

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
      >
        <div className="flex h-full flex-col">
          {/* Logo section */}
          <div className={cn('pt-4 pb-2', !isCollapsed ? 'px-4' : 'px-4')}>
            <div className="flex items-center justify-between gap-2 whitespace-nowrap">
              <div className={cn('flex w-full', 'justify-start')}>
                <div className="flex-shrink-0">
                  <Logo size={'md'} showWordmark={!isCollapsed} />
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
                    <span className="flex justify-center min-w-[24px]">
                      {item.badge ? (
                        <Badge
                          color="success"
                          content={item.badge}
                          size="sm"
                          placement="top-right"
                          showOutline
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
                                  ? 'bg-primary-100 text-primary'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                              )}
                              onClick={() => {
                                if (sidebarOpen) setSidebarOpen(false)
                              }}
                            >
                              <span className="flex justify-center min-w-[20px]">{child.icon}</span>
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

          {/* Spacer */}
          <div className="flex-1" />

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
                      router.push('/settings')
                    } else if (key === 'logout') {
                      logout()
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
                content={isCollapsed ? 'Expand' : !isManuallyExpanded ? 'Keep expanded' : 'Collapse'}
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
