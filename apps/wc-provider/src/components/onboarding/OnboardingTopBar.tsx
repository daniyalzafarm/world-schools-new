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
    <div className="flex min-h-[61px] items-center justify-between border-b border-[#F0F0F0] bg-white px-12 py-5">
      {/* Breadcrumb */}
      <div className="text-[13px] text-[#717171]">{breadcrumb}</div>

      {/* Status indicator */}
      {showAutoSave && (
        <div className="flex items-center gap-2 text-[13px]">
          {isSubmitted ? (
            <>
              <CheckCircle className="h-4 w-4 text-[#45F0B5]" />
              <span className="font-medium text-[#45F0B5]">Submitted</span>
            </>
          ) : (
            <>
              <FileEdit className="h-4 w-4 text-[#717171]" />
              <span className="font-medium text-[#717171]">Draft</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
