'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { MessagesSidebar } from './messages-sidebar'
import { MobileHeader } from './mobile-header'

interface MessagesMainLayoutProps {
  children: React.ReactNode
}

export function MessagesMainLayout({ children }: MessagesMainLayoutProps) {
  const pathname = usePathname()
  const [mainSidebarOpen, setMainSidebarOpen] = useState(false)
  const [messagesSidebarOpen, setMessagesSidebarOpen] = useState(false)

  // Mobile navigation state
  const [mobileView, setMobileView] = useState<'main' | 'messages' | 'conversation'>('main')

  // Determine current mobile view based on pathname and screen size
  useEffect(() => {
    const updateMobileView = () => {
      if (window.innerWidth >= 1024) {
        // Desktop - show all sidebars
        setMainSidebarOpen(false)
        setMessagesSidebarOpen(false)
        setMobileView('main')
      } else {
        // Mobile - determine view based on pathname
        if (pathname === '/messages' || pathname === '/messages/archived') {
          // On messages list page - show messages sidebar, hide main sidebar
          setMobileView('messages')
          setMessagesSidebarOpen(true)
          setMainSidebarOpen(false)
        } else if (pathname.startsWith('/messages/')) {
          // On conversation pages - hide both sidebars, show conversation view
          setMobileView('conversation')
          setMessagesSidebarOpen(false)
          setMainSidebarOpen(false)
        } else {
          // Default - show main sidebar
          setMobileView('main')
          setMainSidebarOpen(false)
          setMessagesSidebarOpen(false)
        }
      }
    }

    updateMobileView()
    window.addEventListener('resize', updateMobileView)
    return () => window.removeEventListener('resize', updateMobileView)
  }, [pathname])

  // Handle mobile navigation
  const handleMobileNavigation = () => {
    if (mobileView === 'main') {
      // Toggle main sidebar
      setMainSidebarOpen(!mainSidebarOpen)
    } else if (mobileView === 'messages') {
      // Toggle messages sidebar or go back to main
      if (messagesSidebarOpen) {
        setMessagesSidebarOpen(false)
      } else {
        setMessagesSidebarOpen(!messagesSidebarOpen)
      }
    }
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Main Application Sidebar */}
      <Sidebar sidebarOpen={mainSidebarOpen} setSidebarOpen={setMainSidebarOpen} />

      {/* Messages Sidebar - only show on desktop or when in messages view on mobile */}
      <MessagesSidebar sidebarOpen={messagesSidebarOpen} setSidebarOpen={setMessagesSidebarOpen} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header - Hidden in conversation view since conversations have their own back button */}
        {mobileView !== 'conversation' && (
          <MobileHeader
            showMenuButton={true}
            showBackButton={false}
            menuOpen={mainSidebarOpen}
            onMenuToggle={handleMobileNavigation}
            onBackPress={handleMobileNavigation}
            className="bg-gray-50 dark:bg-gray-900"
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  )
}
