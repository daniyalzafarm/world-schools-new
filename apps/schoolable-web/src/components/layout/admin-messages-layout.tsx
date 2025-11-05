'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './sidebar'
import { AdminMessagesSidebar } from './admin-messages-sidebar'
import { MobileHeader } from './mobile-header'

interface AdminMessagesLayoutProps {
  children: React.ReactNode
}

export function AdminMessagesLayout({ children }: AdminMessagesLayoutProps) {
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
        if (pathname === '/admin/messages' || pathname === '/admin/messages/archived') {
          // On admin messages list page - show messages sidebar, hide main sidebar
          setMobileView('messages')
          setMessagesSidebarOpen(true)
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

  // Handle mobile navigation
  const handleMobileNavigation = () => {
    if (mobileView === 'main') {
      setMainSidebarOpen(!mainSidebarOpen)
    } else if (mobileView === 'messages') {
      setMessagesSidebarOpen(!messagesSidebarOpen)
    } else if (mobileView === 'conversation') {
      // In conversation view, back button should go to messages view
      setMobileView('messages')
      setMessagesSidebarOpen(true)
      setMainSidebarOpen(false)
    }
  }

  // Listen for conversation selection to hide messages sidebar on mobile
  useEffect(() => {
    const handleSelectConversation = () => {
      if (window.innerWidth < 1024) {
        setMessagesSidebarOpen(false)
        setMainSidebarOpen(false)
        setMobileView('conversation')
      }
    }

    const handleMobileBackToMessages = () => {
      if (window.innerWidth < 1024) {
        setMobileView('messages')
        setMessagesSidebarOpen(true)
        setMainSidebarOpen(false)
      }
    }

    window.addEventListener('selectConversation', handleSelectConversation)
    window.addEventListener('mobileBackToMessages', handleMobileBackToMessages)
    return () => {
      window.removeEventListener('selectConversation', handleSelectConversation)
      window.removeEventListener('mobileBackToMessages', handleMobileBackToMessages)
    }
  }, [])

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Main Sidebar - only show on desktop or when in main view on mobile */}
      {mobileView === 'main' && (
        <Sidebar sidebarOpen={mainSidebarOpen} setSidebarOpen={setMainSidebarOpen} />
      )}

      {/* Admin Messages Sidebar - only show on desktop or when in messages view on mobile */}
      <AdminMessagesSidebar
        sidebarOpen={messagesSidebarOpen}
        setSidebarOpen={setMessagesSidebarOpen}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Header - Hidden in conversation view since conversations have their own back button */}
        {mobileView !== 'conversation' && (
          <MobileHeader
            showMenuButton={true}
            showBackButton={mobileView === 'messages'}
            menuOpen={mobileView === 'main' ? mainSidebarOpen : messagesSidebarOpen}
            onMenuToggle={handleMobileNavigation}
            onBackPress={handleMobileNavigation}
            className="bg-[#F9F9FA] dark:bg-gray-900"
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="h-full flex flex-col">{children}</div>
        </main>
      </div>
    </div>
  )
}
