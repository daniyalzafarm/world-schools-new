'use client'

import React, { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import { useAuthStore } from '@/stores/auth-store'
import { isSuperAdmin } from '@/utils/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireSuperAdmin?: boolean
}

export function ProtectedRoute({
  children,
  requireAuth = false,
  requireSuperAdmin = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isInitialized } = useAuthStore()
  const router = useRouter()

  const userIsSuperAdmin = useMemo(() => isSuperAdmin(user), [user])

  useEffect(() => {
    // Only redirect after initialization is complete
    if (!isInitialized) {
      return
    }

    if (requireAuth && !isAuthenticated) {
      router.push('/auth/signin')
    } else if (requireSuperAdmin && (!isAuthenticated || !userIsSuperAdmin)) {
      router.push('/not-authorized')
    }
  }, [requireAuth, requireSuperAdmin, isAuthenticated, userIsSuperAdmin, router, isInitialized])

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (requireAuth && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Redirecting...</p>
        </div>
      </div>
    )
  }

  if (requireSuperAdmin && (!isAuthenticated || !userIsSuperAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
