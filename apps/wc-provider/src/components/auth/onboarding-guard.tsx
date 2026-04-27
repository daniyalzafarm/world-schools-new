'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { useAuthStore } from '../../stores/auth-store'
import { useOnboardingStore } from '../../stores/onboarding-store'

interface OnboardingGuardProps {
  children: React.ReactNode
}

/**
 * OnboardingGuard Component
 *
 * Manages access to onboarding and application routes based on approval status:
 * - Approved providers: Can access app routes, blocked from onboarding routes
 * - Non-approved providers: Can only access onboarding routes, blocked from app routes
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuthStore()
  const { status, fetchStatus } = useOnboardingStore()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isAuthenticated || !user) {
        setIsChecking(false)
        return
      }

      // Impersonated sessions bypass onboarding — superadmins have full access regardless of
      // the provider's approval or onboarding completion status
      if ((user as any).isImpersonated) {
        setIsChecking(false)
        return
      }

      // Fetch onboarding status
      await fetchStatus()
      setIsChecking(false)
    }

    checkOnboardingStatus().catch(error => {
      console.error('Error fetching onboarding status:', error)
      setIsChecking(false)
    })
  }, [isAuthenticated, user, pathname, fetchStatus])

  useEffect(() => {
    if (isChecking || !status) {
      return
    }

    const isOnOnboardingRoute = pathname?.startsWith('/onboarding')

    // If user is approved
    if (status.approvalStatus === 'approved') {
      const stripeReady = status.stripeOnboardingCompleted || !!status.stripeOnboardingSkippedAt

      if (!stripeReady) {
        // First visit after approval — push them to the Stripe Connect step.
        // They can still skip it from there to come back later via the Stripe
        // Account page on the dashboard.
        if (pathname !== '/onboarding/stripe-connect') {
          router.push('/onboarding/stripe-connect')
        }
        return
      }

      if (status.stripeOnboardingCompleted) {
        // Fully onboarded — block all onboarding routes, allow dashboard
        if (isOnOnboardingRoute) {
          router.push('/dashboard')
        }
        return
      }

      // Skipped (not completed) — allow returning to /onboarding/stripe-connect
      // to finish, but block other onboarding routes.
      if (isOnOnboardingRoute && pathname !== '/onboarding/stripe-connect') {
        router.push('/dashboard')
      }
      return
    }

    // If user is not approved (under_review, rejected, info_requested, or incomplete)
    // Block access to non-onboarding routes
    if (!isOnOnboardingRoute) {
      // Redirect to appropriate onboarding page based on status
      if (!status.isCompleted) {
        router.push('/onboarding')
      } else if (
        status.approvalStatus === 'under_review' ||
        status.approvalStatus === 'rejected' ||
        status.approvalStatus === 'info_requested'
      ) {
        router.push('/onboarding/status')
      } else {
        // Default fallback
        router.push('/onboarding')
      }
      return
    }
  }, [status, isChecking, pathname, router])

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    )
  }

  return <>{children}</>
}
