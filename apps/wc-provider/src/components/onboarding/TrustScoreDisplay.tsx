'use client'

import { Progress } from '@heroui/react'
import type { TrustScoreBreakdown } from '../../types/onboarding'

interface TrustScoreDisplayProps {
  score: number
  breakdown?: TrustScoreBreakdown | null
  showBreakdown?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TrustScoreDisplay({
  score,
  breakdown,
  showBreakdown = false,
  size = 'md',
  className = '',
}: TrustScoreDisplayProps) {
  // Determine color based on score
  const getScoreColor = (score: number): 'success' | 'warning' | 'danger' => {
    if (score >= 70) return 'success'
    if (score >= 40) return 'warning'
    return 'danger'
  }

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Needs Review'
  }

  const color = getScoreColor(score)
  const label = getScoreLabel(score)

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Score header */}
      <div className="flex items-center justify-between">
        <span className={`font-medium text-default-700 ${sizeClasses[size]}`}>
          Trust Score: {score}/100
        </span>
        <span
          className={`text-xs font-semibold ${
            color === 'success'
              ? 'text-success'
              : color === 'warning'
                ? 'text-warning'
                : 'text-danger'
          }`}
        >
          {label}
        </span>
      </div>

      {/* Progress bar */}
      <Progress
        value={score}
        maxValue={100}
        color={color}
        size={size}
        className="w-full"
        aria-label="Trust score progress"
      />

      {/* Breakdown */}
      {showBreakdown && breakdown && (
        <div className="mt-4 space-y-3 rounded-lg border border-default-200 bg-default-50 p-3">
          <div className="text-xs font-semibold text-default-600">Score Breakdown</div>

          {/* Step 1: Google Business Profile (max 30 points) */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-default-500">
              Step 1: Google Business Profile (max 30)
            </div>
            <div className="space-y-1 pl-2 text-xs">
              <div className="flex justify-between">
                <span className="text-default-600">Profile Verified</span>
                <span className="font-medium text-default-700">
                  +{breakdown.hasGoogleBusiness ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-600">Rating Score</span>
                <span className="font-medium text-default-700">+{breakdown.googleRating ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-600">Review Count</span>
                <span className="font-medium text-default-700">
                  +{breakdown.googleReviews ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Step 2: Legal Info + Business Age (max 30 points) */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-default-500">
              Step 2: Legal Info + Business Age (max 30)
            </div>
            <div className="space-y-1 pl-2 text-xs">
              <div className="flex justify-between">
                <span className="text-default-600">Legal Info Complete</span>
                <span className="font-medium text-default-700">
                  +{breakdown.legalInfoComplete ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-600">Years in Business</span>
                <span className="font-medium text-default-700">+{breakdown.businessAge ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Step 3: Camp Profile (max 10 points) */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-default-500">
              Step 3: Camp Profile (max 10)
            </div>
            <div className="space-y-1 pl-2 text-xs">
              <div className="flex justify-between">
                <span className="text-default-600">Description Quality</span>
                <span className="font-medium text-default-700">
                  +{breakdown.descriptionComplete ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-600">Camp Type Selected</span>
                <span className="font-medium text-default-700">
                  +{breakdown.campTypeSelected ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-600">Age Range Defined</span>
                <span className="font-medium text-default-700">
                  +{breakdown.ageRangeDefined ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Step 4: Document Verification (max 20 points) */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-default-500">
              Step 4: Document Verification (max 20)
            </div>
            <div className="space-y-1 pl-2 text-xs">
              <div className="flex justify-between">
                <span className="text-default-600">Business Registration</span>
                <span className="font-medium text-default-700">
                  +{breakdown.businessRegistration ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-600">Insurance Certificate</span>
                <span className="font-medium text-default-700">
                  +{breakdown.insuranceCertificate ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Step 5: Payment & Policies (max 10 points) */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-default-500">
              Step 5: Payment & Policies (max 10)
            </div>
            <div className="space-y-1 pl-2 text-xs">
              <div className="flex justify-between">
                <span className="text-default-600">Deposit Configured</span>
                <span className="font-medium text-default-700">
                  +{breakdown.depositConfigured ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-600">Cancellation Policy</span>
                <span className="font-medium text-default-700">
                  +{breakdown.cancellationPolicy ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
