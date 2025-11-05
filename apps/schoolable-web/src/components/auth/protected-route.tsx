'use client'

import React, { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { isAdmin } from '@/utils/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireAdmin?: boolean
  requireUser?: boolean // New prop to require regular user (non-admin)
}

export function ProtectedRoute({
  children,
  requireAuth = false,
  requireAdmin = false,
  requireUser = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()

  // Memoize the admin check to ensure stable dependencies
  const userIsAdmin = useMemo(() => isAdmin(user), [user])

  useEffect(() => {
    if (requireAuth && !isAuthenticated) {
      router.push('/auth/signin')
    } else if (requireAdmin && (!isAuthenticated || !userIsAdmin)) {
      // If admin is required but user is not authenticated or not admin, redirect to 404
      router.push('/not-found')
    } else if (requireUser && (!isAuthenticated || userIsAdmin)) {
      // If regular user is required but user is not authenticated or is admin, redirect to 404
      router.push('/not-found')
    }
  }, [requireAuth, requireAdmin, requireUser, isAuthenticated, userIsAdmin, router])

  // If auth is required but user is not authenticated, don't render children
  if (requireAuth && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Redirecting...</p>
        </div>
      </div>
    )
  }

  // If admin is required but user is not admin, don't render children
  if (requireAdmin && (!isAuthenticated || !userIsAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Redirecting to 404...</p>
        </div>
      </div>
    )
  }

  // If regular user is required but user is admin, don't render children
  if (requireUser && (!isAuthenticated || userIsAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Redirecting to 404...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
