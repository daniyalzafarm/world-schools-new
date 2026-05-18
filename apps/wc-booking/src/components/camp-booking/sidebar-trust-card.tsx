'use client'

import { Check } from 'lucide-react'

interface SidebarTrustCardProps {
  beforeCancellationText: string
  onCancellationClick: () => void
}

export function SidebarTrustCard({
  beforeCancellationText,
  onCancellationClick,
}: SidebarTrustCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Check size={20} className="text-primary-600" />
          <p className="text-sm font-medium text-gray-900">Free cancellation</p>
          {beforeCancellationText ? (
            <button
              type="button"
              onClick={onCancellationClick}
              className="cursor-pointer text-sm text-gray-600 transition hover:text-gray-900"
            >
              ·{' '}
              <span className="underline decoration-gray-300 underline-offset-3">
                by {beforeCancellationText}
              </span>
            </button>
          ) : null}
        </div>

        <div className="flex items-start gap-3">
          <Check size={20} className="text-primary-600" />
          <p className="text-sm text-gray-700">No payment until camp confirms</p>
        </div>

        <div className="flex items-start gap-3">
          <Check size={20} className="text-primary-600" />
          <p className="text-sm text-gray-700">Secure checkout · data encrypted</p>
        </div>
      </div>
    </div>
  )
}
