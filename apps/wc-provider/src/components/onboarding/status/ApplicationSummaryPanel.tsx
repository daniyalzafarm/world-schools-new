import type { OnboardingStatus } from '../../../types/onboarding'

interface ApplicationSummaryPanelProps {
  status: OnboardingStatus
  providerName?: string
  location?: string
}

function ApprovalStatusBadge({ status }: { status: OnboardingStatus['approvalStatus'] }) {
  const config = {
    approved: { label: 'Approved', bg: 'bg-success-50', dot: 'bg-success', pulse: false },
    under_review: { label: 'Under Review', bg: 'bg-warning-50', dot: 'bg-warning', pulse: true },
    info_requested: {
      label: 'Info Requested',
      bg: 'bg-warning-50',
      dot: 'bg-warning',
      pulse: true,
    },
    rejected: { label: 'Not Approved', bg: 'bg-danger-50', dot: 'bg-danger', pulse: false },
    suspended: { label: 'Suspended', bg: 'bg-danger-50', dot: 'bg-danger', pulse: false },
    pending: { label: 'Pending', bg: 'bg-default-50', dot: 'bg-default-400', pulse: false },
  } as const

  const { label, bg, dot, pulse } = config[status] ?? config.pending

  return (
    <div className={`mb-5 flex items-center gap-2.5 rounded-xl px-4 py-3 ${bg}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </div>
  )
}

export function ApplicationSummaryPanel({
  status,
  providerName,
  location,
}: ApplicationSummaryPanelProps) {
  const isApproved = status.approvalStatus === 'approved'
  const isUnderReview = status.approvalStatus === 'under_review'
  const isInfoRequested = status.approvalStatus === 'info_requested'
  const isRejected = status.approvalStatus === 'rejected'

  const submittedDate = status.onboardingCompletedAt
    ? new Date(status.onboardingCompletedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground">Application Summary</h2>
        <p className="text-sm text-default-500">Your submitted information</p>
      </div>

      {/* Status Card */}
      <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <ApprovalStatusBadge status={status.approvalStatus} />

        {/* Detail Groups */}
        <div className="flex flex-col gap-4">
          {providerName && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-default-500">
                Provider Name
              </div>
              <div className="text-[15px] font-semibold text-foreground">{providerName}</div>
            </div>
          )}

          {submittedDate && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-default-500">
                Submitted
              </div>
              <div className="text-sm font-medium text-foreground">{submittedDate}</div>
            </div>
          )}

          {location && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-default-500">
                Location
              </div>
              <div className="text-sm font-medium text-foreground">{location}</div>
            </div>
          )}
        </div>
      </div>

      {/* Verification Checklist */}
      <div className="rounded-xl bg-white p-5">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-default-500">
          Verification Checklist
        </h3>
        <div className="flex flex-col gap-3">
          <ChecklistItem
            label="Contact information complete"
            checked={status.stepCompletion.step1}
            pending={false}
          />
          <ChecklistItem
            label="Google Business verified"
            checked={status.stepCompletion.step2}
            pending={false}
          />
          <ChecklistItem
            label="Verification documents uploaded"
            checked={status.stepCompletion.step4}
            pending={false}
          />
          <ChecklistItem
            label="Manual verification"
            checked={isApproved}
            pending={isUnderReview || isInfoRequested}
            failed={isRejected}
          />
        </div>
      </div>
    </div>
  )
}

interface ChecklistItemProps {
  label: string
  checked: boolean
  pending?: boolean
  failed?: boolean
}

function ChecklistItem({ label, checked, pending = false, failed = false }: ChecklistItemProps) {
  return (
    <div className="flex items-center gap-3 text-sm text-foreground">
      {checked ? (
        <span className="text-base font-bold text-success">✓</span>
      ) : failed ? (
        <span className="text-base font-bold text-danger">✕</span>
      ) : pending ? (
        <span className="text-base text-warning">⏳</span>
      ) : (
        <span className="text-base text-default-300">○</span>
      )}
      <span>{label}</span>
    </div>
  )
}
