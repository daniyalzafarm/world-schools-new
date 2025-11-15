'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@world-schools/ui-web'
import { ChevronDown, ChevronRight, Plus, School, Tent, User, Users } from 'lucide-react'
import { useChildrenStore } from '@/stores/children-store'
import { getChildDisplayName } from '@/types/child'

interface SettingsSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

interface SettingsNavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  isCollapsible?: boolean
}

const settingsNavigationItems: SettingsNavigationItem[] = [
  {
    name: 'Profile',
    href: '/settings',
    icon: <User size={20} />,
  },
  {
    name: 'School Preferences',
    href: '/settings/preferences/school',
    icon: <School size={20} />,
  },
  {
    name: 'Camp Preferences',
    href: '/settings/preferences/camp',
    icon: <Tent size={20} />,
  },
  {
    name: 'Children',
    href: '/settings/children',
    icon: <Users size={20} />,
    isCollapsible: true,
  },
]

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isChildrenExpanded, setIsChildrenExpanded] = React.useState(true)
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null)

  // Get children from store
  const { children } = useChildrenStore()

  const handleNavigation = (item: SettingsNavigationItem) => {
    const isChildrenItem = item.name === 'Children'

    // Handle collapsible items - toggle dropdown state
    if (isChildrenItem && item.isCollapsible) {
      toggleCollapseFor(item)
      return
    }

    router.push(item.href)
    setSidebarOpen(false) // Close sidebar on mobile after navigation
  }

  const handleChildNavigation = (childId: string) => {
    router.push(`/settings/children/${childId}`)
    setSidebarOpen(false)
  }

  const handleAddChild = () => {
    router.push('/settings/children/new')
    setSidebarOpen(false)
  }

  const toggleCollapseFor = (item: SettingsNavigationItem) => {
    const isChildrenItem = item.name === 'Children'

    if (isChildrenItem) {
      setIsChildrenExpanded(prev => !prev)
      return
    }
  }

  const isActive = (href: string) => {
    if (href === '/settings') {
      return pathname === '/settings'
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-100"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Settings Sidebar */}
      <aside
        className={cn(
          'h-full bg-white dark:bg-gray-900/95 backdrop-blur-md',
          'border-r border-gray-200 dark:border-gray-700',
          'fixed lg:static z-40',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          // Full width on mobile, fixed width on desktop
          'w-full lg:w-80',
          // Add top padding on mobile to account for MobileHeader height
          'pt-8 lg:pt-0'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Settings Header */}
          <div className="h-20 px-6 mb-2 flex items-center border-b border-gray-200 dark:border-gray-700/50">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-2">
            <div className="space-y-1">
              {settingsNavigationItems.map(item => {
                const active = isActive(item.href)
                const isChildrenItem = item.name === 'Children'
                const isCollapsible = item.isCollapsible
                const isExpanded = isChildrenItem ? isChildrenExpanded : false

                return (
                  <div key={item.href} className="w-full">
                    <div
                      onClick={() => handleNavigation(item)}
                      className={cn(
                        'flex items-center p-2 rounded-lg cursor-pointer transition-all duration-200',
                        active && !isChildrenItem
                          ? 'bg-primary-100'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-800'
                      )}
                      onMouseEnter={() => setHoveredItem(item.name)}
                      onMouseLeave={() =>
                        setHoveredItem(prev => (prev === item.name ? null : prev))
                      }
                    >
                      <span className="w-8 flex justify-center">
                        {isCollapsible && hoveredItem === item.name ? (
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
                        ) : (
                          <span className={cn('flex-shrink-0')}>{item.icon}</span>
                        )}
                      </span>
                      <div className="flex select-none items-center justify-between w-full ml-2">
                        <span className={cn('font-medium transition-all duration-200')}>
                          {item.name}
                        </span>
                      </div>
                    </div>

                    {/* Children Sub-items */}
                    {isChildrenItem && isExpanded && (
                      <div className="mt-1 ml-8 space-y-2">
                        {/* Add a child button */}
                        <div
                          onClick={handleAddChild}
                          className={cn(
                            'flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200',
                            pathname === `/settings/children/new`
                              ? 'bg-primary-100 dark:bg-primary-900/30'
                              : 'hover:bg-gray-200 dark:hover:bg-gray-800',
                            'text-sm font-medium select-none'
                          )}
                        >
                          <Plus size={18} className="mr-2" />
                          <span>Add a child</span>
                        </div>

                        {/* Children list */}
                        {children.length > 0 ? (
                          children.map(child => {
                            const isActive = pathname === `/settings/children/${child.id}`
                            return (
                              <div
                                key={child.id}
                                onClick={() => handleChildNavigation(child.id)}
                                className={cn(
                                  'flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200',
                                  isActive
                                    ? 'bg-primary-100 dark:bg-primary-900/30'
                                    : 'hover:bg-gray-200 dark:hover:bg-gray-800',
                                  'text-sm font-medium select-none'
                                )}
                              >
                                <User size={18} className="mr-2" />
                                <span className={cn('truncate')}>{getChildDisplayName(child)}</span>
                              </div>
                            )
                          })
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            No children added yet
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </nav>
        </div>
      </aside>
    </>
  )
}
