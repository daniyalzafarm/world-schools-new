/**
 * Protected Route Component for World Camps Applications
 *
 * This component provides route protection with authentication and role-based
 * access control. It handles redirects and loading states.
 *
 * @example
 * ```typescript
 * import { createAuthStore, ProtectedRoute } from '@world-schools/wc-utils'
 *
 * const { useAuthStore } = createAuthStore({ ... })
 *
 * function AdminPage() {
 *   return (
 *     <ProtectedRoute
 *       useAuthStore={useAuthStore}
 *       requireAuth
 *       requireRole="superadmin"
 *       checkRole={(user) => user?.roles?.some(r => r.name === 'superadmin')}
 *     >
 *       <AdminContent />
 *     </ProtectedRoute>
 *   )
 * }
 * ```
 */

'use client'

import React, { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@world-schools/wc-types'

interface ProtectedRouteProps {
  children: React.ReactNode
  /**
   * The useAuthStore hook from createAuthStore
   */
  useAuthStore: () => {
    isAuthenticated: boolean
    user: User | null
    isInitialized: boolean
  }
  /**
   * Whether authentication is required
   */
  requireAuth?: boolean
  /**
   * Role(s) required to access this route
   * Can be a string or array of strings
   */
  requireRole?: string | string[]
  /**
   * Custom function to check if user has required role
   * If not provided, will check user.roles array for role name match
   */
  checkRole?: (user: User | null) => boolean
  /**
   * Path to redirect to when not authenticated
   * @default '/auth/signin'
   */
  redirectTo?: string
  /**
   * Path to redirect to when user lacks required role
   * @default '/not-authorized'
   */
  unauthorizedRedirect?: string
  /**
   * Optional custom loading component
   */
  loadingComponent?: React.ReactNode
}

export function ProtectedRoute({
  children,
  useAuthStore,
  requireAuth = false,
  requireRole,
  checkRole,
  redirectTo = '/auth/signin',
  unauthorizedRedirect = '/not-authorized',
  loadingComponent,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isInitialized } = useAuthStore()
  const router = useRouter()

  // Check if user has required role
  const hasRequiredRole = useMemo(() => {
    if (!requireRole) return true

    if (checkRole) {
      return checkRole(user)
    }

    // Default role checking logic
    if (!user?.roles) return false

    const requiredRoles = Array.isArray(requireRole) ? requireRole : [requireRole]
    return requiredRoles.some(role => user.roles.some(r => r.name === role))
  }, [user, requireRole, checkRole])

  useEffect(() => {
    // Only redirect after initialization is complete
    if (!isInitialized) {
      return
    }

    if (requireAuth && !isAuthenticated) {
      router.push(redirectTo)
    } else if (requireRole && (!isAuthenticated || !hasRequiredRole)) {
      router.push(unauthorizedRedirect)
    }
  }, [
    requireAuth,
    requireRole,
    isAuthenticated,
    hasRequiredRole,
    router,
    isInitialized,
    redirectTo,
    unauthorizedRedirect,
  ])

  // Show loading state while initializing
  if (!isInitialized) {
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }

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
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Redirecting...</p>
        </div>
      </div>
    )
  }

  if (requireRole && (!isAuthenticated || !hasRequiredRole)) {
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }

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
