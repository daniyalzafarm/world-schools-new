'use client'

import React, { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import MainLayout from '@/components/layout/main-layout'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuthStore } from '@/stores/auth-store'
import { isAdmin } from '@/utils/auth'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  // Check if current user is admin
  const userIsAdmin = isAdmin(user)
  const isNewChatRoute = pathname === '/chat/new'

  // Handle admin access to /chat/new
  useEffect(() => {
    if (isNewChatRoute && isAuthenticated && userIsAdmin) {
      // Admin trying to access /chat/new - redirect to admin dashboard
      router.push('/admin/dashboard')
    }
  }, [isNewChatRoute, isAuthenticated, userIsAdmin, router])

  // Show loading state while redirecting admin
  if (isNewChatRoute && isAuthenticated && userIsAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Redirecting to admin dashboard...</p>
        </div>
      </div>
    )
  }

  // For /chat/new: allow unauthenticated access, but block admin users
  // For other chat routes: require user authentication and block admin users
  const requireAuth = !isNewChatRoute
  const requireUser = isAuthenticated // Only apply user requirement if authenticated

  return (
    <ProtectedRoute requireAuth={requireAuth} requireUser={requireUser}>
      <MainLayout>
        <div className="h-full flex flex-col">{children}</div>
      </MainLayout>
    </ProtectedRoute>
  )
}
