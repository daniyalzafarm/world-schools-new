'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { getFirstAccessibleRoute, hasRouteAccess } from '@/utils/navigation'

interface RouteGuardProps {
  children: React.ReactNode
}

/**
 * RouteGuard component that checks if the user has permission to access the current route
 * If not, redirects to the first accessible route or 404 page
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading } = useAuthStore()

  useEffect(() => {
    // Wait for auth to initialize
    if (isLoading) return

    // If not authenticated, let ProtectedRoute handle it
    if (!isAuthenticated) return

    // Get user permissions
    const userPermissions = user?.permissions ?? []

    // Check if user has access to current route
    const hasAccess = hasRouteAccess(pathname, userPermissions)

    if (!hasAccess) {
      // User doesn't have access to this route
      // Redirect to first accessible route or 404
      const firstRoute = getFirstAccessibleRoute(userPermissions)

      if (firstRoute) {
        router.push(firstRoute)
      } else {
        // No accessible routes - redirect to 404 (security: don't reveal protected routes exist)
        router.push('/404')
      }
    }
  }, [pathname, user, isAuthenticated, isLoading, router])

  // Render children if we haven't redirected
  return <>{children}</>
}
