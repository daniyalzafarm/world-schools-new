import { Button } from '@heroui/react'
import type { OnboardingStatus } from '../../../types/onboarding'

interface InfoRequestedContentProps {
  status: OnboardingStatus
}

export function InfoRequestedContent({ status: _status }: InfoRequestedContentProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Main Status Card */}
      <div className="mb-8 rounded-xl border border-[#FFB800] bg-white p-12 text-center">
        <div className="mb-6 text-7xl">❓</div>
        <h1 className="mb-4 text-[36px] font-bold leading-tight text-[#222222]">
          Additional Information Needed
        </h1>
        <p className="mb-8 text-[18px] text-[#717171]">
          We need some additional information to complete your application review.
        </p>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF5E6] px-6 py-3">
          <span className="font-semibold text-[#FFB800]">Info Requested</span>
        </div>
      </div>

      {/* Information Request */}
      <div className="mb-8 rounded-xl border-2 border-[#FFB800] bg-[#FFF5E6] p-8">
        <h2 className="mb-4 flex items-center gap-2 text-[24px] font-semibold text-[#FFB800]">
          ℹ️ Information Request
        </h2>
        <p className="text-[#717171]">
          Our review team has requested additional information to process your application. Please
          review the message below and provide the requested details.
        </p>
      </div>

      {/* What to Do Next */}
      <div className="mb-8 rounded-xl border border-[#E5E5E5] bg-white p-8">
        <h2 className="mb-6 text-[24px] font-semibold text-[#222222]">What to do next?</h2>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8FDF7] text-2xl">
              📧
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-[#222222]">Check Your Email</div>
              <div className="text-sm text-[#717171]">
                We've sent you a detailed email with the specific information we need.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8FDF7] text-2xl">
              📄
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-[#222222]">Gather Information</div>
              <div className="text-sm text-[#717171]">
                Collect the requested documents or information as outlined in the email.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8FDF7] text-2xl">
              📤
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-[#222222]">Submit Response</div>
              <div className="text-sm text-[#717171]">
                Reply to the email with the requested information or contact our support team.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8FDF7] text-2xl">
              ⏳
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-[#222222]">Wait for Review</div>
              <div className="text-sm text-[#717171]">
                Once we receive your response, we'll continue reviewing your application.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Response Time */}
      <div className="mb-8 rounded-xl border border-[#E5E5E5] bg-white p-8">
        <h2 className="mb-4 text-[24px] font-semibold text-[#222222]">⏰ Response Time</h2>
        <p className="text-[#717171]">
          Please provide the requested information within <strong>7 days</strong> to avoid delays in
          processing your application. If you need more time, please contact our support team.
        </p>
      </div>

      {/* Have Questions */}
      <div className="mb-8 rounded-xl bg-[#F9F9F9] p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">❓</span>
          <div className="text-sm text-[#717171]">
            <strong>Have questions?</strong> Our support team is here to help clarify what
            information is needed.
            <div className="mt-3 flex flex-col gap-2">
              <a href="mailto:support@worldcamps.com" className="text-[#45F0B5] hover:underline">
                📧 support@worldcamps.com
              </a>
              <a href="tel:+1-555-123-4567" className="text-[#45F0B5] hover:underline">
                📞 +1 (555) 123-4567
              </a>
            </div>
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
  )
}
