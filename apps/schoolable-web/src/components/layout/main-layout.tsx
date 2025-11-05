'use client'

import React, { useEffect, useState } from 'react'
import Sidebar from './sidebar'
import { MobileHeader } from './mobile-header'
import TopNav from './top-nav'
import { useAuthStore } from '@/stores/auth-store'

interface MainLayoutProps {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isAuthenticated } = useAuthStore()

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false) // Close mobile sidebar on desktop
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Sidebar only for authenticated users */}
      {isAuthenticated && <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Transparent top nav for logged-out users on desktop too */}
        {!isAuthenticated && <TopNav />}

        {/* Mobile Header - keep for authenticated to toggle sidebar */}
        {isAuthenticated && (
          <MobileHeader menuOpen={sidebarOpen} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="h-full pt-14 lg:pt-0">{children}</div>
        </main>
      </div>
    </div>
  )
}
