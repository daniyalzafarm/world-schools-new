'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Spinner } from '@heroui/react'
import { useOnboardingStore } from '../../../../stores/onboarding-store'
import { OnboardingTopBar } from '../../../../components/onboarding/OnboardingTopBar'

export default function RejectedPage() {
  const router = useRouter()
  const { status, fetchStatus } = useOnboardingStore()

  useEffect(() => {
    fetchStatus().catch(error => {
      console.error('Failed to fetch status:', error)
    })
  }, [fetchStatus])

  useEffect(() => {
    // Redirect if status changes
    if (status?.approvalStatus === 'approved') {
      router.push('/dashboard')
    } else if (status?.approvalStatus === 'under_review') {
      router.push('/onboarding/status/under-review')
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
          <div className="mb-8 rounded-xl border border-[#FF385C] bg-white p-12 text-center">
            <div className="mb-6 text-7xl">❌</div>
            <h1 className="mb-4 text-[36px] font-bold leading-tight text-[#222222]">
              Application Not Approved
            </h1>
            <p className="mb-8 text-[18px] text-[#717171]">
              Unfortunately, we're unable to approve your application at this time.
            </p>

            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF5F5] px-6 py-3">
              <span className="font-semibold text-[#FF385C]">Rejected</span>
            </div>
          </div>

          {/* Rejection Reason */}
          {status.rejectionReason && (
            <div className="mb-8 rounded-xl border-2 border-[#FF385C] bg-[#FFF5F5] p-8">
              <h2 className="mb-4 flex items-center gap-2 text-[24px] font-semibold text-[#FF385C]">
                ⚠️ Reason for Rejection
              </h2>
              {status.rejectionCategory && (
                <div className="mb-2 text-sm font-semibold text-[#FF385C]">
                  Category: {status.rejectionCategory}
                </div>
              )}
              <p className="text-[#717171]">{status.rejectionReason}</p>
            </div>
          )}

          {/* What Can You Do */}
          <div className="mb-8 rounded-xl border border-[#E5E5E5] bg-white p-8">
            <h2 className="mb-6 text-[24px] font-semibold text-[#222222]">What can you do?</h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8FDF7] text-2xl">
                  📧
                </div>
                <div className="flex-1">
                  <div className="mb-1 font-semibold text-[#222222]">Contact Support</div>
                  <div className="text-sm text-[#717171]">
                    Reach out to our support team for more details about the rejection and how to
                    address the issues.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8FDF7] text-2xl">
                  📄
                </div>
                <div className="flex-1">
                  <div className="mb-1 font-semibold text-[#222222]">Review Requirements</div>
                  <div className="text-sm text-[#717171]">
                    Make sure you meet all the requirements for becoming a World Camps provider.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8FDF7] text-2xl">
                  🔄
                </div>
                <div className="flex-1">
                  <div className="mb-1 font-semibold text-[#222222]">Reapply</div>
                  <div className="text-sm text-[#717171]">
                    Once you've addressed the issues, you can submit a new application.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Need Help */}
          <div className="mb-8 rounded-xl border border-[#E5E5E5] bg-white p-8">
            <h2 className="mb-4 text-[24px] font-semibold text-[#222222]">❓ Need Help?</h2>
            <p className="mb-6 text-[#717171]">
              Our support team is here to help you understand the rejection and guide you through
              the process of reapplying.
            </p>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span>📧</span>
                <a href="mailto:support@worldcamps.com" className="text-[#45F0B5] hover:underline">
                  support@worldcamps.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span>📞</span>
                <a href="tel:+1-555-123-4567" className="text-[#45F0B5] hover:underline">
                  +1 (555) 123-4567
                </a>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-center">
            <Button
              className="bg-[#45F0B5] font-semibold text-[#222222] hover:bg-[#3de0a5]"
              size="lg"
              onPress={() => (window.location.href = 'mailto:support@worldcamps.com')}
            >
              📧 Contact Support
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
