'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { getFirstAccessibleRoute } from '@/utils/navigation'

export default function Index() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuthStore()

  useEffect(() => {
    // Wait for auth to initialize
    if (isLoading) return

    // If not authenticated, redirect to signin
    if (!isAuthenticated) {
      router.push('/auth/signin')
      return
    }

    // Get user permissions
    const userPermissions = user?.permissions ?? []

    // Get the first accessible route based on user permissions
    const firstRoute = getFirstAccessibleRoute(userPermissions)

    if (firstRoute) {
      router.push(firstRoute)
    } else {
      // No accessible routes - redirect to 404 (security: don't reveal protected routes exist)
      router.push('/404')
    }
  }, [user, isAuthenticated, isLoading, router])

  // Show loading state while determining redirect
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  )
}
