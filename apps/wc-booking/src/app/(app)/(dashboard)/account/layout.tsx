'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AccountSidebar } from '@/components/layout/account-sidebar'
import { ChildrenSidebar } from '@/components/layout/children-sidebar'
import { ChildDetailProvider } from '@/components/children/ChildDetailContext'
import { ChildDetailFooter } from '@/components/children/ChildDetailFooter'
import eventBus from '@/utils/event-bus'

const AccountLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const isChildDetailPage = pathname.startsWith('/account/children/')

  // Emit sidebar collapse event when account page mounts
  useEffect(() => {
    // Emit the collapse event to the main sidebar
    eventBus.$emit('sidebar:collapse')
  }, []) // Empty dependency array ensures this only runs once on mount

  return (
    <>
      {/* Use absolute positioning to escape the dashboard layout wrapper and position at the MainLayout level */}
      {/* This mimics the children detail layout structure where the sidebar is a direct child of MainLayout's content area */}
      {/* absolute + inset-0 positions relative to the nearest positioned ancestor (MainLayout's main element) */}
      <div className="absolute inset-0 lg:left-0">
        <div className="flex h-full bg-white dark:bg-slate-900">
          {/* Sidebar — switches based on route */}
          {isChildDetailPage ? (
            <ChildrenSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          ) : (
            <AccountSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          )}

          {/* Main Content - Flex column layout with scrollable content */}
          <main className="flex-1 min-w-0 lg:ml-0 flex flex-col overflow-hidden">
            {isChildDetailPage ? (
              <ChildDetailProvider>
                <div className="flex-1 overflow-y-auto">
                  <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>
                </div>
                <div className="sticky bottom-0 z-40 shrink-0">
                  <ChildDetailFooter />
                </div>
              </ChildDetailProvider>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}

export default AccountLayout
