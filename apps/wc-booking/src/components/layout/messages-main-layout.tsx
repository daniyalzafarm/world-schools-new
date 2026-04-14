'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { BottomNav } from './bottom-nav'
import { Sidebar } from './sidebar'
import { MessagesSidebar } from './messages-sidebar'

interface MessagesMainLayoutProps {
  children: React.ReactNode
}

export function MessagesMainLayout({ children }: MessagesMainLayoutProps) {
  const pathname = usePathname()
  const [messagesSidebarOpen, setMessagesSidebarOpen] = useState(false)
  const isListView = pathname === '/messages' || pathname === '/messages/archived'

  useEffect(() => {
    const updateSidebarVisibility = () => {
      if (window.innerWidth >= 1024) {
        // Desktop: MessagesSidebar is lg:static — state not relevant
        setMessagesSidebarOpen(false)
      } else if (pathname === '/messages' || pathname === '/messages/archived') {
        // Mobile list view: show conversation list full-screen
        setMessagesSidebarOpen(true)
      } else if (pathname.startsWith('/messages/')) {
        // Mobile conversation view: hide sidebar, show chat
        setMessagesSidebarOpen(false)
      }
    }

    updateSidebarVisibility()
    window.addEventListener('resize', updateSidebarVisibility)
    return () => window.removeEventListener('resize', updateSidebarVisibility)
  }, [pathname])

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Main Application Sidebar — always closed on mobile (no trigger); always static on desktop */}
      <Sidebar sidebarOpen={false} setSidebarOpen={() => {}} />

      {/* Messages Sidebar — full-screen on mobile list view, w-96 panel on desktop */}
      <MessagesSidebar sidebarOpen={messagesSidebarOpen} setSidebarOpen={setMessagesSidebarOpen} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          <div className="h-full">{children}</div>
        </main>
        {/* Show bottom nav on conversation list, hide it inside a conversation */}
        {isListView && <BottomNav />}
      </div>
    </div>
  )
}
