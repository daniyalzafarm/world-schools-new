'use client'

import { useOnboardingStore } from '../../stores/onboarding-store'
import { Progress } from '@heroui/react'
import { HowScoringWorks } from './HowScoringWorks'

interface OnboardingTopBarProps {
  breadcrumb: string
  showTrustScore?: boolean
}

export function OnboardingTopBar({ breadcrumb, showTrustScore = true }: OnboardingTopBarProps) {
  const { status } = useOnboardingStore()
  const trustScore = status?.trustScore ?? 0

  // Determine color based on score
  const getScoreColor = (score: number): 'success' | 'warning' | 'danger' => {
    if (score >= 70) return 'success'
    if (score >= 40) return 'warning'
    return 'danger'
  }

  const color = getScoreColor(trustScore)

  return (
    <div className="flex h-18 bg-white px-12 items-center justify-between border-b border-default-200">
      {/* Breadcrumb */}
      <div className="text-sm text-default-500">{breadcrumb}</div>

      {/* Trust Score indicator */}
      {showTrustScore && (
        <div className="flex items-center gap-2">
          <HowScoringWorks />
          <div className="flex flex-col items-center gap-1">
            <div className="flex w-full justify-between items-center">
              <p className="text-sm font-medium text-default-500">Trust Score</p>
              <div
                className={`text-sm font-bold ${
                  color === 'success'
                    ? 'text-success'
                    : color === 'warning'
                      ? 'text-warning'
                      : 'text-danger'
                }`}
              >
                {trustScore}/100
              </div>
            </div>
            <Progress
              value={trustScore}
              maxValue={100}
              color={color}
              size="md"
              className="w-32"
              aria-label="Trust score progress"
            />
          </div>
        </div>
      )}
    </div>
  )
}
