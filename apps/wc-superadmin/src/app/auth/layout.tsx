'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isInitialized } = useAuthStore()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Wait for auth to be initialized before checking
    if (!isInitialized) {
      return
    }

    // Allow access to 2FA verification page even if authenticated
    const is2FAPage = pathname === '/auth/verify-2fa'

    if (isAuthenticated && !is2FAPage) {
      // User is authenticated, redirect to analytics dashboard
      router.replace('/analytics-dashboard')
    } else {
      // User is not authenticated OR on 2FA page, safe to show auth pages
      setIsChecking(false)
    }
  }, [isAuthenticated, isInitialized, pathname, router])

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

  // Only render children if user is NOT authenticated OR on 2FA page
  return <>{children}</>
}
