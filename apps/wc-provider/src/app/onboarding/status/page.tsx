'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { useAuthStore } from '../../../stores/auth-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { canAccessStatusPage, getNextAccessibleStep } from '../../../utils/onboarding-access'
import { UnderReviewContent } from '../../../components/onboarding/status/UnderReviewContent'
import { RejectedContent } from '../../../components/onboarding/status/RejectedContent'
import { InfoRequestedContent } from '../../../components/onboarding/status/InfoRequestedContent'
import { ApplicationSummaryPanel } from '../../../components/onboarding/status/ApplicationSummaryPanel'
import { useOnboardingStatusWebSocket } from '../../../hooks/useOnboardingStatusWebSocket'

export default function OnboardingStatusPage() {
  const router = useRouter()
  const { status, fetchStatus, googleBusinessProfile, fetchGoogleBusinessProfile } =
    useOnboardingStore()
  const { user } = useAuthStore()

  useEffect(() => {
    fetchStatus().catch(error => {
      console.error('Failed to fetch status:', error)
    })
    fetchGoogleBusinessProfile().catch(error => {
      console.error('Failed to fetch business profile:', error)
    })
  }, [fetchStatus, fetchGoogleBusinessProfile])

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

  // Real-time status updates via WebSocket — replaces 30-second polling
  const handleStatusChanged = useCallback(() => {
    new Audio('/sounds/notification.mp3').play().catch(() => {
      // Ignore autoplay policy errors (browser may block without prior user interaction)
    })
    fetchStatus().catch(error => {
      console.error('Failed to fetch status after WS update:', error)
    })
  }, [fetchStatus])

  useOnboardingStatusWebSocket({ onStatusChanged: handleStatusChanged })

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  const rightSidebar = (
    <ApplicationSummaryPanel
      status={status}
      providerName={googleBusinessProfile?.businessName}
      location={googleBusinessProfile?.formattedAddress}
    />
  )

  return (
    <OnboardingPageLayout
      breadcrumb="Provider Onboarding / Application Status"
      showAutoSave={false}
      rightSidebar={rightSidebar}
    >
      {status.approvalStatus === 'under_review' && (
        <UnderReviewContent
          status={status}
          contactFirstName={user?.firstName}
          contactEmail={user?.email}
        />
      )}
      {status.approvalStatus === 'rejected' && (
        <RejectedContent status={status} contactFirstName={user?.firstName} />
      )}
      {status.approvalStatus === 'info_requested' && <InfoRequestedContent status={status} />}
    </OnboardingPageLayout>
  )
}
