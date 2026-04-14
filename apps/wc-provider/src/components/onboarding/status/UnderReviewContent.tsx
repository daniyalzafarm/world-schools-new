import type { OnboardingStatus } from '../../../types/onboarding'

interface UnderReviewContentProps {
  status: OnboardingStatus
  contactFirstName?: string
  contactEmail?: string
}

export function UnderReviewContent({ contactFirstName, contactEmail }: UnderReviewContentProps) {
  const firstName = contactFirstName || 'there'
  const email = contactEmail || 'your email'

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center text-center">
      {/* Animated Icon */}
      <div className="mb-5 flex h-20 w-20 animate-pulse items-center justify-center rounded-full border-4 border-warning bg-warning-50 text-4xl">
        ⏳
      </div>

      {/* Title */}
      <h1 className="mb-2 text-[28px] font-bold leading-tight text-foreground">
        Application Under Review
      </h1>
      <p className="mb-8 text-base text-default-500">
        Thank you for applying, <span className="font-semibold text-foreground">{firstName}</span>!
        <br />
        Our team is reviewing your application.
      </p>

      {/* Timeline Card */}
      <div className="mb-8 w-full rounded-xl border-2 border-warning bg-warning-50 p-5 text-left">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-lg">⏱️</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-default-500">
            Estimated Review Time
          </span>
        </div>
        <div className="mb-1 text-2xl font-bold text-foreground">2-3 business days</div>
        <p className="text-sm text-default-500">We'll email you as soon as a decision is made.</p>
      </div>

      {/* What Happens Next */}
      <div className="w-full">
        <h2 className="mb-4 text-center text-base font-bold text-foreground">What Happens Next?</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4 rounded-xl border border-default-200 bg-white p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-default-100 text-sm font-bold text-foreground">
              1
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-foreground">
                Our team reviews your details
              </div>
              <div className="text-xs text-default-500">
                We verify your business information, insurance, and safety credentials.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-default-200 bg-white p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-default-100 text-sm font-bold text-foreground">
              2
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-foreground">
                We may request additional information
              </div>
              <div className="text-xs text-default-500">
                If needed, we'll message you directly through the platform.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-default-200 bg-white p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-default-100 text-sm font-bold text-foreground">
              3
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-foreground">
                You'll receive an email notification
              </div>
              <div className="text-xs text-default-500">
                We'll let you know as soon as a decision is made.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Confirmation Banner */}
      <div className="mt-8 flex w-full items-center gap-3 rounded-xl border border-primary bg-primary-50 p-4">
        <span className="text-xl">📧</span>
        <p className="text-sm text-foreground">
          We'll notify you at <span className="font-semibold">{email}</span>
        </p>
      </div>
    </div>
  )
}
