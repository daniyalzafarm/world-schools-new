import { Button } from '@heroui/react'
import { formatSnakeCaseToTitleCase } from '@world-schools/wc-frontend-utils'
import type { OnboardingStatus } from '../../../types/onboarding'

interface RejectedContentProps {
  status: OnboardingStatus
  contactFirstName?: string
}

export function RejectedContent({ status, contactFirstName }: RejectedContentProps) {
  const firstName = contactFirstName || 'there'

  const formattedCategory = status.rejectionCategory
    ? formatSnakeCaseToTitleCase(status.rejectionCategory)
    : undefined

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center text-center">
      {/* Icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-danger bg-danger-50 text-3xl font-bold text-danger">
        ✕
      </div>

      {/* Title */}
      <h1 className="mb-2 text-[28px] font-bold text-foreground">Application Not Approved</h1>
      <p className="mb-8 text-base text-default-500">
        Hi <span className="font-semibold text-foreground">{firstName}</span>, unfortunately we're
        unable to approve your application at this time.
      </p>

      {/* Rejection Reason Card */}
      {status.rejectionReason && (
        <div className="mb-8 w-full rounded-xl border border-danger bg-danger-50 p-5 text-left">
          <div className="mb-3 flex items-center gap-2">
            <span>📋</span>
            <span className="text-[15px] font-bold text-foreground">Reason for Decision</span>
          </div>
          {formattedCategory && (
            <div className="mb-2 text-sm font-semibold text-danger">{formattedCategory}</div>
          )}
          <ul className="list-none space-y-2">
            <li className="flex gap-2 text-sm leading-relaxed text-default-600">
              <span className="font-bold text-danger">•</span>
              <span>{status.rejectionReason}</span>
            </li>
          </ul>
        </div>
      )}

      {/* Ready to Reapply */}
      <div className="w-full border-t border-default-100 pt-8">
        <div className="rounded-xl border border-primary bg-primary-50 p-6 text-center">
          <h3 className="mb-2 text-lg font-bold text-foreground">Ready to Reapply?</h3>
          <p className="mb-5 text-sm text-default-500">
            Once you've addressed these issues, you can reapply.
            <br />
            Your previous information will be saved.
          </p>
          <Button
            color="primary"
            size="lg"
            className="font-semibold"
            onPress={() => (window.location.href = '/onboarding')}
          >
            Reapply Now
          </Button>
        </div>

        {/* Support Links */}
        <div className="mt-6 flex items-center justify-center gap-6">
          <a
            href="mailto:support@worldcamps.com"
            className="flex items-center gap-1.5 text-sm text-default-500 hover:text-foreground"
          >
            <span>📧</span>
            <span>support@worldcamps.com</span>
          </a>
          <a
            href="tel:+15551234567"
            className="flex items-center gap-1.5 text-sm text-default-500 hover:text-foreground"
          >
            <span>📞</span>
            <span>+1 (555) 123-4567</span>
          </a>
        </div>
      </div>
    </div>
  )
}
