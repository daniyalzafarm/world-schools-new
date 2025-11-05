'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from "@world-schools/ui-web"
import { ChevronDown, ChevronRight, Plus, School, Tent, User } from 'lucide-react'
import { useSchoolsStore } from '@/stores/schools-store'
import { useCampsStore } from '@/stores/camps-store'

interface AdminSettingsSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

interface AdminSettingsNavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  isCollapsible?: boolean
}

const adminSettingsNavigationItems: AdminSettingsNavigationItem[] = [
  {
    name: 'Profile',
    href: '/admin/settings',
    icon: <User size={20} />,
  },
  {
    name: 'Schools',
    href: '/admin/settings/schools',
    icon: <School size={20} />,
    isCollapsible: true,
  },
  {
    name: 'Camps',
    href: '/admin/settings/camps',
    icon: <Tent size={20} />,
    isCollapsible: true,
  },
]

export const AdminSettingsSidebar: React.FC<AdminSettingsSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isSchoolsExpanded, setIsSchoolsExpanded] = React.useState(true)
  const [isCampsExpanded, setIsCampsExpanded] = React.useState(true)
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null)

  // Get schools and camps from stores
  const { schools } = useSchoolsStore()
  const { camps } = useCampsStore()

  const handleNavigation = (item: AdminSettingsNavigationItem) => {
    const isSchoolsItem = item.name === 'Schools'
    const isCampsItem = item.name === 'Camps'

    // Handle collapsible items - toggle dropdown state
    if ((isSchoolsItem || isCampsItem) && item.isCollapsible) {
      toggleCollapseFor(item)
      return
    }

    router.push(item.href)
    setSidebarOpen(false) // Close sidebar on mobile after navigation
  }

  const handleSchoolNavigation = (schoolId: string) => {
    router.push(`/admin/settings/schools/${schoolId}`)
    setSidebarOpen(false)
  }

  const handleAddSchool = () => {
    router.push('/admin/settings/schools/new')
    setSidebarOpen(false)
  }

  const handleCampNavigation = (campId: string) => {
    router.push(`/admin/settings/camps/${campId}`)
    setSidebarOpen(false)
  }

  const handleAddCamp = () => {
    router.push('/admin/settings/camps/new')
    setSidebarOpen(false)
  }

  const toggleCollapseFor = (item: AdminSettingsNavigationItem) => {
    const isSchoolsItem = item.name === 'Schools'
    const isCampsItem = item.name === 'Camps'

    if (isSchoolsItem) {
      setIsSchoolsExpanded(prev => !prev)
      return
    }
    if (isCampsItem) {
      setIsCampsExpanded(prev => !prev)
      return
    }
  }

  const isActive = (href: string) => {
    if (href === '/admin/settings') {
      return pathname === '/admin/settings'
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-100"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'h-full bg-white dark:bg-gray-900/95 backdrop-blur-md',
          'border-r border-gray-200 dark:border-gray-700',
          'fixed lg:static z-40',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'w-full lg:w-80',
          'pt-8 lg:pt-0'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="h-20 px-6 mb-2 flex items-center border-b border-gray-200 dark:border-gray-700/50">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
          </div>

          <nav className="flex-1 px-4 py-2">
            <div className="space-y-1">
              {adminSettingsNavigationItems.map(item => {
                const active = isActive(item.href)
                const isSchoolsItem = item.name === 'Schools'
                const isCollapsible = item.isCollapsible
                const isCampsItem = item.name === 'Camps'
                const isExpanded = isSchoolsItem
                  ? isSchoolsExpanded
                  : isCampsItem
                    ? isCampsExpanded
                    : false

                return (
                  <div key={item.href} className="w-full">
                    <div
                      onClick={() => handleNavigation(item)}
                      className={cn(
                        'flex items-center p-2 rounded-lg cursor-pointer transition-all duration-200',
                        active && !isSchoolsItem
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

                    {/* Schools Sub-items */}
                    {isSchoolsItem && isExpanded && (
                      <div className="mt-1 ml-8 space-y-2">
                        {/* Add a school button */}
                        <div
                          onClick={handleAddSchool}
                          className={cn(
                            'flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200',
                            pathname === `/admin/settings/schools/new`
                              ? 'bg-primary-100 dark:bg-primary-900/30'
                              : 'hover:bg-gray-200 dark:hover:bg-gray-800',
                            'text-sm font-medium select-none'
                          )}
                        >
                          <Plus size={18} className="mr-2" />
                          <span>Add a school</span>
                        </div>

                        {/* Schools list */}
                        {schools.length > 0 ? (
                          schools.map(school => {
                            const isActive = pathname === `/admin/settings/schools/${school.id}`
                            return (
                              <div
                                key={school.id}
                                onClick={() => handleSchoolNavigation(school.id)}
                                className={cn(
                                  'flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200',
                                  isActive
                                    ? 'bg-primary-100 dark:bg-primary-900/30'
                                    : 'hover:bg-gray-200 dark:hover:bg-gray-800',
                                  'text-sm font-medium select-none'
                                )}
                              >
                                <School size={18} className="mr-2" />
                                <span className={cn('truncate')}>{school.name}</span>
                              </div>
                            )
                          })
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            No schools added yet
                          </div>
                        )}
                      </div>
                    )}

                    {/* Camps Sub-items */}
                    {isCampsItem && isExpanded && (
                      <div className="mt-1 ml-8 space-y-2">
                        {/* Add a camp button */}
                        <div
                          onClick={handleAddCamp}
                          className={cn(
                            'flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200',
                            pathname === `/admin/settings/camps/new`
                              ? 'bg-primary-100 dark:bg-primary-900/30'
                              : 'hover:bg-gray-200 dark:hover:bg-gray-800',
                            'text-sm font-medium select-none'
                          )}
                        >
                          <Plus size={18} className="mr-2" />
                          <span>Add a camp</span>
                        </div>

                        {/* Camps list */}
                        {camps.length > 0 ? (
                          camps.map((camp: { id: string; name: string }) => {
                            const isActive = pathname === `/admin/settings/camps/${camp.id}`
                            return (
                              <div
                                key={camp.id}
                                onClick={() => handleCampNavigation(camp.id)}
                                className={cn(
                                  'flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200',
                                  isActive
                                    ? 'bg-primary-100 dark:bg-primary-900/30'
                                    : 'hover:bg-gray-200 dark:hover:bg-gray-800',
                                  'text-sm font-medium select-none'
                                )}
                              >
                                <Tent size={18} className="mr-2" />
                                <span className={cn('truncate')}>{camp.name}</span>
                              </div>
                            )
                          })
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            No camps added yet
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

export default AdminSettingsSidebar
