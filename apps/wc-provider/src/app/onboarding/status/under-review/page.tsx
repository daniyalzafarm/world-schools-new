'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { useOnboardingStore } from '../../../../stores/onboarding-store'
import { OnboardingTopBar } from '../../../../components/onboarding/OnboardingTopBar'

export default function UnderReviewPage() {
  const router = useRouter()
  const { status, fetchStatus } = useOnboardingStore()

  useEffect(() => {
    fetchStatus().catch(error => {
      console.error('Failed to fetch status:', error)
    })
    // Poll for status updates every 30 seconds
    const interval = setInterval(() => {
      fetchStatus().catch(error => {
        console.error('Failed to fetch status:', error)
      })
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchStatus])

  useEffect(() => {
    // Redirect based on approval status changes
    if (status?.approvalStatus === 'approved') {
      router.push('/dashboard')
    } else if (status?.approvalStatus === 'rejected') {
      router.push('/onboarding/status/rejected')
    } else if (status?.approvalStatus === 'info_requested') {
      router.push('/onboarding/status/info-requested')
    }
  }, [status, router])

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <OnboardingTopBar breadcrumb="Provider Onboarding / Application Status" />

      <div className="flex min-h-screen items-center justify-center px-12 pb-20 pt-[60px]">
        <div className="w-full max-w-3xl">
          {/* Main Status Card */}
          <div className="mb-8 rounded-xl border border-[#E5E5E5] bg-white p-12 text-center">
            <div className="mb-6 text-7xl">⏳</div>
            <h1 className="mb-4 text-[36px] font-bold leading-tight text-[#222222]">
              Application Under Review
            </h1>
            <p className="mb-8 text-[18px] text-[#717171]">
              Thank you for submitting your application! Our team is currently reviewing your
              information.
            </p>

            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF5E6] px-6 py-3">
              <div className="h-2 w-2 animate-pulse rounded-full bg-[#FFB800]"></div>
              <span className="font-semibold text-[#FFB800]">Under Review</span>
            </div>
          </div>

          {/* What's Being Reviewed */}
          <div className="mb-8 rounded-xl border border-[#E5E5E5] bg-white p-8">
            <h2 className="mb-6 text-[24px] font-semibold text-[#222222]">
              What's being reviewed?
            </h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8FDF7] text-2xl">
                  📄
                </div>
                <div className="flex-1">
                  <div className="mb-1 font-semibold text-[#222222]">Business Information</div>
                  <div className="text-sm text-[#717171]">
                    Verifying your business details and legal information
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8FDF7] text-2xl">
                  🛡️
                </div>
                <div className="flex-1">
                  <div className="mb-1 font-semibold text-[#222222]">Verification Documents</div>
                  <div className="text-sm text-[#717171]">
                    Reviewing your business registration and insurance certificates
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8FDF7] text-2xl">
                  ⭐
                </div>
                <div className="flex-1">
                  <div className="mb-1 font-semibold text-[#222222]">Trust Score Assessment</div>
                  <div className="text-sm text-[#717171]">
                    Calculating your provider trust score based on submitted information
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Score */}
          {status.trustScore !== null && status.trustScore !== undefined && (
            <div className="mb-8 rounded-xl border border-[#E5E5E5] bg-white p-8">
              <h2 className="mb-4 text-[24px] font-semibold text-[#222222]">Your Trust Score</h2>
              <div className="mb-4 flex items-center gap-4">
                <div className="text-5xl font-bold text-[#45F0B5]">{status.trustScore}</div>
                <div className="text-[#717171]">out of 100</div>
              </div>
              <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-[#E5E5E5]">
                <div
                  className="h-full rounded-full bg-[#45F0B5]"
                  style={{ width: `${status.trustScore}%` }}
                ></div>
              </div>
              <p className="text-sm text-[#717171]">
                {status.trustScore >= 70
                  ? 'Excellent! Your application looks great.'
                  : status.trustScore >= 50
                    ? 'Good progress. Our team will review your application.'
                    : 'Our team will carefully review your application.'}
              </p>
            </div>
          )}

          {/* Estimated Review Time */}
          <div className="mb-8 rounded-xl border border-[#E5E5E5] bg-white p-8">
            <h2 className="mb-4 text-[24px] font-semibold text-[#222222]">
              ⏰ Estimated Review Time
            </h2>
            <p className="text-[#717171]">
              Most applications are reviewed within <strong>2-3 business days</strong>. You'll
              receive an email notification once your application has been reviewed.
            </p>
          </div>

          {/* Contact Info */}
          <div className="rounded-xl bg-[#F9F9F9] p-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div className="text-sm text-[#717171]">
                <strong>Need to make changes?</strong> If you need to update any information, please
                contact our support team at{' '}
                <a href="mailto:support@worldcamps.com" className="text-[#45F0B5] hover:underline">
                  support@worldcamps.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
