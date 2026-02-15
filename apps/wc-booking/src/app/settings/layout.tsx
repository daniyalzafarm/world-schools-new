'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { cn } from '@world-schools/ui-web'
import { Menu, X } from 'lucide-react'
import { MainLayout } from '@/components/layout/main-layout'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { SettingsSidebar } from '@/components/layout/settings-sidebar'
import eventBus from '@/utils/event-bus'

const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Emit sidebar collapse event when settings page mounts
  useEffect(() => {
    // Emit the collapse event to the main sidebar
    eventBus.$emit('sidebar:collapse')
  }, []) // Empty dependency array ensures this only runs once on mount

  return (
    <ProtectedRoute requireAuth={true} requireParentRole={true}>
      <MainLayout>
        <div className="flex h-full bg-white dark:bg-gray-900">
          {/* Settings Sidebar */}
          <SettingsSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

          {/* Mobile Header with Menu Toggle - only visible on mobile */}
          <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
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
              <div className="mx-auto max-w-4xl w-full">{children}</div>
            </div>
          </main>
        </div>
      </MainLayout>
    </ProtectedRoute>
  )
}

export default SettingsLayout
