'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { useOnboardingStore } from '../../stores/onboarding-store'
import { getNextAccessibleStep } from '../../utils/onboarding-access'

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

    if (!status.stepCompletion) {
      console.error('stepCompletion is missing from status response')
      router.push('/onboarding/contact')
      return
    }

    router.push(getNextAccessibleStep(status))
  }, [status, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" color="primary" />
    </div>
  )
}
