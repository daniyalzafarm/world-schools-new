'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { canAccessStatusPage, getNextAccessibleStep } from '../../../utils/onboarding-access'
import { UnderReviewContent } from '../../../components/onboarding/status/UnderReviewContent'
import { RejectedContent } from '../../../components/onboarding/status/RejectedContent'
import { InfoRequestedContent } from '../../../components/onboarding/status/InfoRequestedContent'

export default function OnboardingStatusPage() {
  const router = useRouter()
  const { status, fetchStatus } = useOnboardingStore()

  useEffect(() => {
    fetchStatus().catch(error => {
      console.error('Failed to fetch status:', error)
    })
  }, [fetchStatus])

  // Route protection: Check if user can access status page
  useEffect(() => {
    if (status && !canAccessStatusPage(status)) {
      const nextStep = getNextAccessibleStep(status)
      router.push(nextStep)
    }
  }, [status, router])

  // Redirect based on approval status changes
  useEffect(() => {
    if (status?.approvalStatus === 'approved') {
      router.push('/dashboard')
    }
  }, [status, router])

  // Poll for status updates every 30 seconds (only for under_review)
  useEffect(() => {
    if (status?.approvalStatus === 'under_review') {
      const interval = setInterval(() => {
        fetchStatus().catch(error => {
          console.error('Failed to fetch status:', error)
        })
      }, 30000)

      return () => clearInterval(interval)
    }
  }, [status?.approvalStatus, fetchStatus])

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <OnboardingPageLayout
      breadcrumb="Provider Onboarding / Application Status"
      showAutoSave={false}
    >
      {status.approvalStatus === 'under_review' && <UnderReviewContent status={status} />}
      {status.approvalStatus === 'rejected' && <RejectedContent status={status} />}
      {status.approvalStatus === 'info_requested' && <InfoRequestedContent status={status} />}
    </OnboardingPageLayout>
  )
}
