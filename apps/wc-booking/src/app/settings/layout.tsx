'use client'

import React, { useState } from 'react'
import { Button } from '@heroui/react'
import { cn } from '@world-schools/ui-web'
import { Menu, X } from 'lucide-react'
import TopNav from '@/components/layout/top-nav'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { SettingsSidebar } from '@/components/layout/settings-sidebar'

const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ProtectedRoute requireAuth={true}>
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <div className="flex h-[calc(100vh-64px)] bg-white dark:bg-gray-900">
          {/* Settings Sidebar */}
          <SettingsSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

          {/* Mobile Header with Menu Toggle - only visible on mobile */}
          <div className="lg:hidden fixed top-16 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-3">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
              <Button
                isIconOnly
                variant="light"
                onPress={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
              >
                <div className="relative w-6 h-6">
                  <Menu
                    size={20}
                    className={cn(
                      'absolute inset-0 transition-all duration-200',
                      sidebarOpen
                        ? 'opacity-0 rotate-90 scale-75'
                        : 'opacity-100 rotate-0 scale-100'
                    )}
                  />
                  <X
                    size={20}
                    className={cn(
                      'absolute inset-0 transition-all duration-200',
                      sidebarOpen
                        ? 'opacity-100 rotate-0 scale-100'
                        : 'opacity-0 -rotate-90 scale-75'
                    )}
                  />
                </div>
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 min-w-0 lg:ml-0">
            <div className="h-full overflow-auto">
              <div className="w-full">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default SettingsLayout
