import { Button } from '@heroui/react'
import type { OnboardingStatus } from '../../../types/onboarding'

interface InfoRequestedContentProps {
  status: OnboardingStatus
}

export function InfoRequestedContent({ status: _status }: InfoRequestedContentProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Main Status Card */}
      <div className="mb-8 rounded-xl border border-warning bg-white p-12 text-center">
        <div className="mb-6 text-7xl">❓</div>
        <h1 className="mb-4 text-[36px] font-bold leading-tight text-foreground">
          Additional Information Needed
        </h1>
        <p className="mb-8 text-[18px] text-default-500">
          We need some additional information to complete your application review.
        </p>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-warning-50 px-6 py-3">
          <span className="font-semibold text-warning">Info Requested</span>
        </div>
      </div>

      {/* Information Request */}
      <div className="mb-8 rounded-xl border-2 border-warning bg-warning-50 p-8">
        <h2 className="mb-4 flex items-center gap-2 text-[24px] font-semibold text-warning">
          ℹ️ Information Request
        </h2>
        <p className="text-default-500">
          Our review team has requested additional information to process your application. Please
          review the message below and provide the requested details.
        </p>
      </div>

      {/* What to Do Next */}
      <div className="mb-8 rounded-xl border border-default-300 bg-white p-8">
        <h2 className="mb-6 text-[24px] font-semibold text-foreground">What to do next?</h2>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-2xl">
              📧
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-foreground">Check Your Email</div>
              <div className="text-sm text-default-500">
                We've sent you a detailed email with the specific information we need.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-2xl">
              📄
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-foreground">Gather Information</div>
              <div className="text-sm text-default-500">
                Collect the requested documents or information as outlined in the email.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-2xl">
              📤
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-foreground">Submit Response</div>
              <div className="text-sm text-default-500">
                Reply to the email with the requested information or contact our support team.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-2xl">
              ⏳
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-foreground">Wait for Review</div>
              <div className="text-sm text-default-500">
                Once we receive your response, we'll continue reviewing your application.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Response Time */}
      <div className="mb-8 rounded-xl border border-default-300 bg-white p-8">
        <h2 className="mb-4 text-[24px] font-semibold text-foreground">⏰ Response Time</h2>
        <p className="text-default-500">
          Please provide the requested information within <strong>7 days</strong> to avoid delays in
          processing your application. If you need more time, please contact our support team.
        </p>
      </div>

      {/* Have Questions */}
      <div className="mb-8 rounded-xl bg-default-50 p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">❓</span>
          <div className="text-sm text-default-500">
            <strong>Have questions?</strong> Our support team is here to help clarify what
            information is needed.
            <div className="mt-3 flex flex-col gap-2">
              <a href="mailto:support@worldcamps.com" className="text-primary hover:underline">
                📧 support@worldcamps.com
              </a>
              <a href="tel:+1-555-123-4567" className="text-primary hover:underline">
                📞 +1 (555) 123-4567
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <Button
          color="primary"
          className="font-semibold"
          size="lg"
          onPress={() => (window.location.href = 'mailto:support@worldcamps.com')}
        >
          📧 Contact Support
        </Button>
      </div>
    </div>
  )
}
