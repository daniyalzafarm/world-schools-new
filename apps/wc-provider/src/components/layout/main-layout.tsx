'use client'

import React, { useEffect, useState } from 'react'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { RouteGuard } from '@/components/auth/route-guard'
import { OnboardingGuard } from '@/components/auth/onboarding-guard'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'
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
        <main className="min-h-screen flex-1 overflow-auto bg-white dark:bg-slate-900">
          <div className="relative h-full">{children}</div>
        </main>
      )
    }
    return (
      <div className="flex h-screen bg-white dark:bg-gray-900">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <MobileHeader menuOpen={sidebarOpen} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-auto bg-white dark:bg-slate-900">
            <div className="h-full pt-14 lg:pt-0">{children}</div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute requireAuth requireProviderRole>
      <RouteGuard>
        <OnboardingGuard>
          <div className="flex h-screen bg-white dark:bg-gray-900">
            {/* Sidebar */}
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

            {/* Main content area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile Header */}
              <MobileHeader
                menuOpen={sidebarOpen}
                onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
              />

              {/* Main content */}
              <main className="flex-1 overflow-auto bg-white dark:bg-slate-900">
                <div className="h-full pt-14 lg:pt-0">{children}</div>
              </main>
            </div>
          </div>
        </OnboardingGuard>
      </RouteGuard>
    </ProtectedRoute>
  )
}
