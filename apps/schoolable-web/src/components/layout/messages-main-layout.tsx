'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './sidebar'
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
        } else if (
          pathname.startsWith('/messages/') &&
          (pathname.includes('/school-detail') || pathname.match(/^\/messages\/[^/]+$/))
        ) {
          // On conversation or school detail pages - hide both sidebars, show conversation view
          setMobileView('conversation')
          setMessagesSidebarOpen(false)
          setMainSidebarOpen(false)
        } else {
          // On other pages - show main sidebar only
          setMobileView('main')
          setMessagesSidebarOpen(false)
          setMainSidebarOpen(false)
        }
      }
    }

    updateMobileView()
    window.addEventListener('resize', updateMobileView)
    return () => window.removeEventListener('resize', updateMobileView)
  }, [pathname])

  // Listen for messages sidebar show event
  useEffect(() => {
    const handleShowMessagesSidebar = () => {
      if (window.innerWidth < 1024) {
        setMessagesSidebarOpen(true)
        setMainSidebarOpen(false)
        setMobileView('messages')
      }
    }

    window.addEventListener('showMessagesSidebar', handleShowMessagesSidebar)
    return () => window.removeEventListener('showMessagesSidebar', handleShowMessagesSidebar)
  }, [])

  // Listen for conversation selection to hide messages sidebar on mobile
  useEffect(() => {
    const handleSelectConversation = () => {
      if (window.innerWidth < 1024) {
        setMessagesSidebarOpen(false)
        setMainSidebarOpen(false)
        setMobileView('conversation')
      }
    }

    window.addEventListener('selectConversation', handleSelectConversation)
    return () => window.removeEventListener('selectConversation', handleSelectConversation)
  }, [])

  const handleMobileNavigation = () => {
    if (mobileView === 'conversation') {
      // From conversation view, go back to messages list
      setMobileView('messages')
      setMessagesSidebarOpen(true)
      setMainSidebarOpen(false)
    } else if (mobileView === 'messages') {
      // From messages list, toggle main sidebar (keep messages sidebar open)
      setMainSidebarOpen(!mainSidebarOpen)
      // Don't change mobileView or close messages sidebar - allow overlay
    } else {
      // From main view, toggle main sidebar
      setMainSidebarOpen(!mainSidebarOpen)
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
            className="bg-[#F9F9FA] dark:bg-gray-900"
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
