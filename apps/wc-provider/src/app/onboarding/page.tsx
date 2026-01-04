'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { useOnboardingStore } from '../../stores/onboarding-store'

export default function OnboardingPage() {
  const router = useRouter()
  const { status, fetchStatus } = useOnboardingStore()

  useEffect(() => {
    fetchStatus().catch(error => {
      console.error('Failed to fetch status:', error)
    })
  }, [fetchStatus])

  useEffect(() => {
    if (!status) return

    // Route based on approval status
    if (status.approvalStatus === 'approved') {
      router.push('/dashboard')
      return
    }

    if (
      status.approvalStatus === 'under_review' ||
      status.approvalStatus === 'rejected' ||
      status.approvalStatus === 'info_requested'
    ) {
      router.push('/onboarding/status')
      return
    }

    // Route to appropriate step based on completion
    // Add defensive check for stepCompletion
    if (!status.stepCompletion) {
      console.error('stepCompletion is missing from status response')
      router.push('/onboarding/step-1')
      return
    }

    if (!status.stepCompletion.step1) {
      router.push('/onboarding/step-1')
    } else if (!status.stepCompletion.step2) {
      router.push('/onboarding/step-2')
    } else if (!status.stepCompletion.step3) {
      router.push('/onboarding/step-3')
    } else if (!status.stepCompletion.step4) {
      router.push('/onboarding/step-4')
    } else if (!status.stepCompletion.step5) {
      router.push('/onboarding/step-5')
    } else {
      // All steps completed, redirect to status page
      router.push('/onboarding/status')
    }
  }, [status, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" color="primary" />
    </div>
  )
}
