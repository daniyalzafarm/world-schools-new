'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../stores/auth-store'
import { useOnboardingStore } from '../../stores/onboarding-store'
import Image from 'next/image'
import { OnboardingSidebar } from '../../components/onboarding/OnboardingSidebar'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
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

  // Redirect if onboarding is already completed
  useEffect(() => {
    if (status?.isCompleted && status.approvalStatus === 'approved') {
      router.push('/dashboard')
    }
  }, [status, router])

  // Show loading state while fetching status
  if (!status) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-[60px] items-center bg-white px-6 md:hidden">
        <Image
          src="/images/logo-mobile.svg"
          alt="World-Camps"
          width={36}
          height={36}
          className="h-9 w-auto"
        />
      </div>

      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <OnboardingSidebar
          stepCompletion={status.stepCompletion}
          isOnboardingCompleted={status.isCompleted}
          approvalStatus={status.approvalStatus}
        />
      </div>

      {/* Main Content - Full height with flex column layout */}
      <main className="flex h-full flex-1 flex-col pt-[60px] md:ml-[280px] md:pt-0">
        {children}
      </main>
    </div>
  )
}
