'use client'

import { useOnboardingStore } from '../../stores/onboarding-store'
import { CheckCircle, FileEdit } from 'lucide-react'

interface OnboardingTopBarProps {
  breadcrumb: string
  showAutoSave?: boolean
}

export function OnboardingTopBar({ breadcrumb, showAutoSave = true }: OnboardingTopBarProps) {
  const { status } = useOnboardingStore()
  const isSubmitted = status?.isCompleted ?? false

  return (
    <div className="flex min-h-[61px] items-center justify-between border-b border-default-200 bg-white px-12 py-5">
      {/* Breadcrumb */}
      <div className="text-[13px] text-default-500">{breadcrumb}</div>

      {/* Status indicator */}
      {showAutoSave && (
        <div className="flex items-center gap-2 text-[13px]">
          {isSubmitted ? (
            <>
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">Submitted</span>
            </>
          ) : (
            <>
              <FileEdit className="h-4 w-4 text-default-500" />
              <span className="font-medium text-default-500">Draft</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
