'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '../../stores/auth-store'
import { useOnboardingStore } from '../../stores/onboarding-store'
import { OnboardingSidebar } from '../../components/onboarding/OnboardingSidebar'
import { Logo } from '@/components/layout/logo'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated } = useAuthStore()
  const { status, fetchStatus } = useOnboardingStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/signin')
      return
    }

    fetchStatus().catch(error => {
      console.error('Failed to fetch status:', error)
    })
  }, [isAuthenticated, fetchStatus, router])

  // Approved + completed providers belong on the dashboard, not stuck on a
  // stale onboarding page. The single exception is /onboarding/stripe-connect,
  // which they can reach deliberately from the Account → Stripe Account page
  // to finish (or restart) Stripe setup.
  //
  // We intentionally do NOT gate this on Stripe state: grandfathered providers
  // (approved before Stripe Connect shipped) have all stripe_* defaults set
  // to false/null and would otherwise be trapped on the onboarding tree.
  useEffect(() => {
    if (
      status?.isCompleted &&
      status.approvalStatus === 'approved' &&
      pathname !== '/onboarding/stripe-connect'
    ) {
      router.push('/dashboard')
    }
  }, [status, pathname, router])

  // Show loading state while fetching status
  if (!status) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center bg-white px-6 md:hidden">
        <Logo size="md" />
      </div>

      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <OnboardingSidebar
          stepCompletion={status.stepCompletion}
          isOnboardingCompleted={status.isCompleted}
          approvalStatus={status.approvalStatus}
          stripeOnboardingCompleted={status.stripeOnboardingCompleted}
          stripeOnboardingSkipped={!!status.stripeOnboardingSkippedAt}
        />
      </div>

      {/* Main Content - Full height with flex column layout */}
      <main className="flex h-full flex-1 flex-col pt-16 md:ml-72 md:pt-0">{children}</main>
    </div>
  )
}
