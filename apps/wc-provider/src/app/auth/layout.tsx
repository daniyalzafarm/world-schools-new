'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isInitialized } = useAuthStore()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Wait for auth to be initialized before checking
    if (!isInitialized) {
      return
    }

    if (isAuthenticated) {
      // User is authenticated, redirect to dashboard
      router.replace('/dashboard')
    } else {
      // User is not authenticated, safe to show auth pages
      setIsChecking(false)
    }
  }, [isAuthenticated, isInitialized, router])

  // Show loading state while checking authentication
  if (!isInitialized || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Only render children if user is NOT authenticated
  return <>{children}</>
}
