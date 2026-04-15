'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@heroui/react'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { RouteGuard } from '@/components/auth/route-guard'
import { OnboardingGuard } from '@/components/auth/onboarding-guard'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Sidebar } from '@/components/layout/sidebar'
import { useAuthStore } from '@/stores/auth-store'
import config from '@/config/config'

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
  const { isInitialized, isAuthenticated, user, logout } = useAuthStore()

  const isImpersonated = !!(user as any)?.isImpersonated
  const impersonatedBy = (user as any)?.impersonatedBy as
    | { id: string; email: string; name: string }
    | undefined

  const handleExitImpersonation = useCallback(async () => {
    await logout()
    window.location.href = config.app.superadminAppUrl
  }, [logout])

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
          <main className="flex-1 overflow-auto bg-white dark:bg-slate-900">
            <div className="relative h-full">{children}</div>
          </main>
          <BottomNav />
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute requireAuth requireProviderRole>
      <RouteGuard>
        <OnboardingGuard>
          {/* Superadmin impersonation banner — fixed at top, visible across all routes */}
          {isImpersonated && (
            <div className="fixed inset-x-0 top-0 z-9999 flex items-center gap-4 bg-secondary-500 px-4 py-2 text-sm font-medium text-white shadow-md">
              <span>
                SuperAdmin view — acting on behalf of this provider account
                {impersonatedBy?.name ? ` · ${impersonatedBy.name}` : ''}
              </span>
              <Button size="sm" color="primary" onPress={() => void handleExitImpersonation()}>
                Exit
              </Button>
            </div>
          )}

          <div
            className={`flex h-screen bg-white dark:bg-gray-900 ${isImpersonated ? 'pt-10' : ''}`}
          >
            {/* Sidebar */}
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

            {/* Main content area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Main content */}
              <main className="flex-1 overflow-auto bg-white dark:bg-slate-900">
                <div className="relative h-full">{children}</div>
              </main>
              <BottomNav />
            </div>
          </div>
        </OnboardingGuard>
      </RouteGuard>
    </ProtectedRoute>
  )
}
