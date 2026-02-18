'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { cn } from '@world-schools/ui-web'
import { Menu, X } from 'lucide-react'
import { ChildrenSidebar } from '@/components/layout/children-sidebar'
import { ChildDetailFooter } from '@/components/children/ChildDetailFooter'
import { ChildDetailProvider } from '@/components/children/ChildDetailContext'
import eventBus from '@/utils/event-bus'

const ChildDetailLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Emit sidebar collapse event when child detail page mounts
  useEffect(() => {
    // Emit the collapse event to the main sidebar
    eventBus.$emit('sidebar:collapse')
  }, []) // Empty dependency array ensures this only runs once on mount

  return (
    <ChildDetailProvider>
      {/* Use absolute positioning to escape the dashboard layout wrapper and position at the MainLayout level */}
      {/* This mimics the settings layout structure where the sidebar is a direct child of MainLayout's content area */}
      {/* absolute + inset-0 positions relative to the nearest positioned ancestor (MainLayout's main element) */}
      <div className="absolute inset-0 lg:left-0">
        <div className="flex h-full bg-white dark:bg-slate-900">
          {/* Children Sidebar */}
          <ChildrenSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

          {/* Mobile Header with Menu Toggle - only visible on mobile */}
          <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-4 py-3">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                Child Profile
              </h1>
              <Button
                isIconOnly
                variant="light"
                onPress={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
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

          {/* Main Content - Flex column layout with scrollable content and sticky footer */}
          <main className="flex-1 min-w-0 lg:ml-0 flex flex-col overflow-hidden">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>
            </div>

            {/* Footer - Sticky with reserved space */}
            <div className="sticky bottom-0 z-40 shrink-0">
              <ChildDetailFooter />
            </div>
          </main>
        </div>
      </div>
    </ChildDetailProvider>
  )
}

export default ChildDetailLayout
