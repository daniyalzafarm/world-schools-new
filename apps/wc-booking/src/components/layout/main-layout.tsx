'use client'

import React, { useEffect, useState } from 'react'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
    <ProtectedRoute requireAuth requireParentRole>
      <div className="flex h-screen bg-white dark:bg-gray-900">
        {/* Sidebar */}
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Header */}
          <MobileHeader menuOpen={sidebarOpen} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

          {/* Main content */}
          <main className="flex-1 overflow-auto bg-white dark:bg-slate-900">
            <div className="relative h-full pt-14 lg:pt-0">{children}</div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
