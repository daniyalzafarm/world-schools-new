'use client'

import { Card, CardBody, Chip, Progress } from '@heroui/react'
import { EMOJI } from '@world-schools/wc-frontend-utils'
import type { ApplicationDetail } from '../../types/application-review'

interface TrustScoreSectionProps {
  application: ApplicationDetail
}

export function TrustScoreSection({ application }: TrustScoreSectionProps) {
  const trustScore = application.trustScore ?? 0
  const breakdown = application.trustScoreBreakdown

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'success'
    if (score >= 50) return 'warning'
    return 'danger'
  }

  const getRecommendationColor = (action: string) => {
    if (action === 'auto_approve') return 'success'
    if (action === 'manual_review') return 'warning'
    return 'danger'
  }

  return (
    <Card className="mb-6">
      <CardBody>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              {EMOJI.STAR} Trust Score Assessment
            </h2>

            <div className="mb-6 flex items-center gap-6">
              <div>
                <div className="mb-1 text-sm text-default-600">Overall Score</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary">{trustScore}</span>
                  <span className="text-lg text-default-500">/ 100</span>
                </div>
              </div>

              <div className="flex-1">
                <Progress
                  value={trustScore}
                  color={getScoreColor(trustScore)}
                  size="lg"
                  className="mb-2"
                  aria-label="Trust score"
                />
                <div className="text-sm text-default-600">
                  {breakdown?.label || 'Calculating...'}
                </div>
              </div>

              {breakdown?.recommendedAction && (
                <Chip
                  size="lg"
                  color={getRecommendationColor(breakdown.recommendedAction)}
                  variant="flat"
                >
                  {breakdown.recommendedAction === 'auto_approve'
                    ? 'Recommended: Approve'
                    : breakdown.recommendedAction === 'manual_review'
                      ? 'Recommended: Manual Review'
                      : 'Recommended: Reject'}
                </Chip>
              )}
            </div>

            {breakdown && (
              <div className="grid grid-cols-2 gap-4">
                {/* Google Business Profile */}
                <div className="rounded-lg border border-default-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {EMOJI.SEARCH} Google Business Profile
                    </span>
                    <span className="text-sm text-default-600">
                      {breakdown.breakdown.googleBusinessProfile.score} /{' '}
                      {breakdown.breakdown.googleBusinessProfile.maxScore}
                    </span>
                  </div>
                  <Progress
                    value={
                      (breakdown.breakdown.googleBusinessProfile.score /
                        breakdown.breakdown.googleBusinessProfile.maxScore) *
                      100
                    }
                    color={
                      breakdown.breakdown.googleBusinessProfile.score >=
                      breakdown.breakdown.googleBusinessProfile.maxScore * 0.7
                        ? 'success'
                        : 'warning'
                    }
                    size="sm"
                  />
                </div>

                {/* Verification Documents */}
                <div className="rounded-lg border border-default-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {EMOJI.SHIELD} Verification Documents
                    </span>
                    <span className="text-sm text-default-600">
                      {breakdown.breakdown.verificationDocuments.score} /{' '}
                      {breakdown.breakdown.verificationDocuments.maxScore}
                    </span>
                  </div>
                  <Progress
                    value={
                      (breakdown.breakdown.verificationDocuments.score /
                        breakdown.breakdown.verificationDocuments.maxScore) *
                      100
                    }
                    color={
                      breakdown.breakdown.verificationDocuments.score >=
                      breakdown.breakdown.verificationDocuments.maxScore * 0.7
                        ? 'success'
                        : 'warning'
                    }
                    size="sm"
                  />
                </div>

                {/* Business Age */}
                <div className="rounded-lg border border-default-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {EMOJI.CALENDAR} Business Age
                    </span>
                    <span className="text-sm text-default-600">
                      {breakdown.breakdown.businessAge.score} /{' '}
                      {breakdown.breakdown.businessAge.maxScore}
                    </span>
                  </div>
                  <Progress
                    value={
                      (breakdown.breakdown.businessAge.score /
                        breakdown.breakdown.businessAge.maxScore) *
                      100
                    }
                    color={
                      breakdown.breakdown.businessAge.score >=
                      breakdown.breakdown.businessAge.maxScore * 0.7
                        ? 'success'
                        : 'warning'
                    }
                    size="sm"
                  />
                </div>

                {/* Contact Information */}
                <div className="rounded-lg border border-default-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {EMOJI.USER} Contact Information
                    </span>
                    <span className="text-sm text-default-600">
                      {breakdown.breakdown.contactInformation.score} /{' '}
                      {breakdown.breakdown.contactInformation.maxScore}
                    </span>
                  </div>
                  <Progress
                    value={
                      (breakdown.breakdown.contactInformation.score /
                        breakdown.breakdown.contactInformation.maxScore) *
                      100
                    }
                    color={
                      breakdown.breakdown.contactInformation.score >=
                      breakdown.breakdown.contactInformation.maxScore * 0.7
                        ? 'success'
                        : 'warning'
                    }
                    size="sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
