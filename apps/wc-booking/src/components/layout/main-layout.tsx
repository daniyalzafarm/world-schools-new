'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Sidebar } from '@/components/layout/sidebar'
import { useAuthStore } from '@/stores/auth-store'

interface MainLayoutProps {
  children: React.ReactNode
  /** When true, /help is public: no ProtectedRoute, sidebar only when authenticated */
  allowPublic?: boolean
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  )
}

export function MainLayout({ children, allowPublic = false }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isInitialized, isAuthenticated } = useAuthStore()
  const pathname = usePathname()
  const isChildDetailRoute = pathname?.startsWith('/children/')
  const isWishlistDetailRoute =
    !!pathname && pathname.startsWith('/wishlists/') && pathname !== '/wishlists'
  const needsOverflowHidden = isChildDetailRoute || isWishlistDetailRoute

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

  // Public route (e.g. /help): no ProtectedRoute, sidebar only when authenticated
  if (allowPublic) {
    if (!isInitialized) {
      return <LoadingScreen />
    }
    if (!isAuthenticated) {
      return (
        <main
          className={`h-screen bg-white dark:bg-slate-900 ${
            needsOverflowHidden ? 'overflow-hidden' : 'overflow-auto'
          }`}
        >
          <div className="h-full">{children}</div>
        </main>
      )
    }
    // Authenticated: full layout with sidebar
    return (
      <div className="flex h-screen bg-white dark:bg-gray-900">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main
            className={`flex-1 bg-white dark:bg-slate-900 ${
              needsOverflowHidden ? 'overflow-hidden' : 'overflow-auto'
            }`}
          >
            <div className="relative h-full">{children}</div>
          </main>
          <BottomNav />
        </div>
      </div>
    )
  }

  // Protected dashboard: require auth and parent role
  return (
    <ProtectedRoute requireAuth requireParentRole>
      <div className="flex h-screen bg-white dark:bg-gray-900">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <main
            className={`flex-1 bg-white dark:bg-slate-900 ${
              needsOverflowHidden ? 'overflow-hidden' : 'overflow-auto'
            }`}
          >
            <div className="relative h-full">{children}</div>
          </main>
          <BottomNav />
        </div>
      </div>
    </ProtectedRoute>
  )
}
