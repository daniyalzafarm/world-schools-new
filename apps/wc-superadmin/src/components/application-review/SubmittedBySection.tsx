'use client'

import { EMOJI } from '@world-schools/wc-frontend-utils'
import type { ApplicationDetail } from '../../types/application-review'

interface SubmittedBySectionProps {
  application: ApplicationDetail
}

export function SubmittedBySection({ application }: SubmittedBySectionProps) {
  const ownerName =
    [application.ownerFirstName, application.ownerLastName].filter(Boolean).join(' ') || 'N/A'

  return (
    <div className="rounded-lg border border-default-200 p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        {EMOJI.USER} Submitted By (Provider Owner)
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-default-600">Owner Name</div>
          <div className="text-foreground">{ownerName}</div>
        </div>
        <div>
          <div className="text-sm text-default-600">Email</div>
          <div className="text-foreground">{application.ownerEmail || 'N/A'}</div>
        </div>
        <div>
          <div className="text-sm text-default-600">Email Verified</div>
          <div className="text-foreground">
            {application.emailVerified ? (
              <span className="text-success">{EMOJI.CHECK_MARK} Yes</span>
            ) : (
              <span className="text-danger">No</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
