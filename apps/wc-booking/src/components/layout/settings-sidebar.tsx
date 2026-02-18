'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@world-schools/ui-web'
import { User } from 'lucide-react'

interface SettingsSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

interface SettingsNavigationItem {
  name: string
  href: string
  icon: React.ReactNode
}

const settingsNavigationItems: SettingsNavigationItem[] = [
  {
    name: 'Profile',
    href: '/settings/profile',
    icon: <User size={20} />,
  },
]

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
}) => {
  const router = useRouter()
  const pathname = usePathname()

  const handleNavigation = (item: SettingsNavigationItem) => {
    router.push(item.href)
    setSidebarOpen(false) // Close sidebar on mobile after navigation
  }

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
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
          'transition-all duration-300 ease-in-out',
          // Full width on mobile, match main sidebar width (w-64) on desktop
          'w-full lg:w-64',
          // Add top padding on mobile to account for top navigation height
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

                return (
                  <div key={item.href} className="w-full">
                    <div
                      onClick={() => handleNavigation(item)}
                      className={cn(
                        'flex items-center p-2 rounded-lg cursor-pointer transition-all duration-200',
                        active ? 'bg-primary-100' : 'hover:bg-gray-200 dark:hover:bg-gray-800'
                      )}
                    >
                      <span className="w-8 flex justify-center">
                        <span className={cn('shrink-0')}>{item.icon}</span>
                      </span>
                      <div className="flex select-none items-center justify-between w-full ml-2">
                        <span className={cn('font-medium transition-all duration-200')}>
                          {item.name}
                        </span>
                      </div>
                    </div>
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
