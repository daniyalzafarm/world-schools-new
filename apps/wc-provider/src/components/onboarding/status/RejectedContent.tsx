import { Button } from '@heroui/react'
import { formatSnakeCaseToTitleCase } from '@world-schools/wc-frontend-utils'
import type { OnboardingStatus } from '../../../types/onboarding'

interface RejectedContentProps {
  status: OnboardingStatus
}

export function RejectedContent({ status }: RejectedContentProps) {
  // Format rejection category from snake_case to Title Case
  const formattedCategory = status.rejectionCategory
    ? formatSnakeCaseToTitleCase(status.rejectionCategory)
    : undefined

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Main Status Card */}
      <div className="p-12 text-center">
        <div className="mb-6 text-6xl">❌</div>
        <h1 className="mb-4 text-3xl font-bold leading-tight text-foreground">
          Application Not Approved
        </h1>
        <p className="mb-8 text-lg text-default-600">
          Unfortunately, we're unable to approve your application at this time.
        </p>
      </div>

      {/* Rejection Reason */}
      {status.rejectionReason && (
        <div className="mb-8 rounded-xl border-2 border-danger bg-danger-50 p-8">
          <h2 className="mb-4 flex items-center gap-2 text-[24px] font-semibold text-danger">
            ⚠️ Reason for Rejection
          </h2>
          {formattedCategory && (
            <div className="mb-2 text-sm font-semibold text-danger">{formattedCategory}</div>
          )}
          <p className="text-default-600">{status.rejectionReason}</p>
        </div>
      )}

      {/* What Can You Do */}
      <div className="mb-8 rounded-xl border border-default-200 bg-white p-8">
        <h2 className="mb-6 text-[24px] font-semibold text-foreground">What can you do?</h2>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-2xl">
              📧
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-foreground">Contact Support</div>
              <div className="text-sm text-default-600">
                Reach out to our support team for more details about the rejection and how to
                address the issues.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-2xl">
              📄
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-foreground">Review Requirements</div>
              <div className="text-sm text-default-600">
                Make sure you meet all the requirements for becoming a World Camps provider.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-2xl">
              🔄
            </div>
            <div className="flex-1">
              <div className="mb-1 font-semibold text-foreground">Reapply</div>
              <div className="text-sm text-default-600">
                Once you've addressed the issues, you can submit a new application.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Need Help */}
      <div className="mb-8 rounded-xl border border-default-200 bg-white p-8">
        <h2 className="mb-4 text-[24px] font-semibold text-foreground">Need Help?</h2>
        <p className="mb-6 text-default-600">
          Our support team is here to help you understand the rejection and guide you through the
          process of reapplying.
        </p>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span>📧</span>
            <a href="mailto:support@worldcamps.com" className="text-primary-700 hover:underline">
              support@worldcamps.com
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span>📞</span>
            <a href="tel:+1-555-123-4567" className="text-primary-700 hover:underline">
              +1 (555) 123-4567
            </a>
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
