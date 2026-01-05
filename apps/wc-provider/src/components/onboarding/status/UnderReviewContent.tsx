import { Progress } from '@heroui/react'
import type { OnboardingStatus } from '../../../types/onboarding'

interface UnderReviewContentProps {
  status: OnboardingStatus
}

export function UnderReviewContent({ status }: UnderReviewContentProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Main Status Card */}
      <div className="p-12 text-center">
        <div className="mb-6 text-6xl">⏳</div>
        <h1 className="mb-4 text-3xl font-bold leading-tight text-foreground">
          Application Under Review
        </h1>
        <p className="mb-8 text-lg text-default-500">
          Thank you for submitting your application! Our team is currently reviewing your
          information.
        </p>
      </div>

      {/* What's Being Reviewed */}
      <div className="mb-8 rounded-xl border border-default-300 bg-white p-8">
        <h2 className="mb-6 text-[24px] font-semibold text-foreground">What's being reviewed?</h2>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-2xl">
              📄
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-foreground">Business Information</div>
              <div className="text-sm text-default-500">
                Verifying your business details and legal information
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-2xl">
              🛡️
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-foreground">Verification Documents</div>
              <div className="text-sm text-default-500">
                Reviewing your business registration and insurance certificates
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-2xl">
              ⭐
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-foreground">Trust Score Assessment</div>
              <div className="text-sm text-default-500">
                Calculating your provider trust score based on submitted information
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Score */}
      {status.trustScore !== null && status.trustScore !== undefined && (
        <div className="mb-8 rounded-xl border border-default-300 bg-white p-8">
          <h2 className="mb-4 text-[24px] font-semibold text-foreground">Your Trust Score</h2>
          <div className="mb-4 flex items-center gap-4">
            <div className="text-5xl font-bold text-primary">{status.trustScore}</div>
            <div className="text-default-500">out of 100</div>
          </div>
          <Progress
            value={status.trustScore}
            maxValue={100}
            size="md"
            aria-label="Trust score progress"
          />
          <p className="text-sm text-default-500">
            {status.trustScore >= 70
              ? 'Excellent! Your application looks great.'
              : status.trustScore >= 50
                ? 'Good progress. Our team will review your application.'
                : 'Our team will carefully review your application.'}
          </p>
        </div>
      )}

      {/* Estimated Review Time */}
      <div className="mb-8 rounded-xl border border-default-300 bg-white p-8">
        <h2 className="mb-4 text-[24px] font-semibold text-foreground">⏰ Estimated Review Time</h2>
        <p className="text-default-500">
          Most applications are reviewed within <strong>2-3 business days</strong>. You'll receive
          an email notification once your application has been reviewed.
        </p>
      </div>

      {/* Contact Info */}
      <div className="rounded-xl bg-default-50 p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="text-sm text-default-500">
            <strong>Need to make changes?</strong> If you need to update any information, please
            contact our support team at{' '}
            <a href="mailto:support@worldcamps.com" className="text-primary-700 hover:underline">
              support@worldcamps.com
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
