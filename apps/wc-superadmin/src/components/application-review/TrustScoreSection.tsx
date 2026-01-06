'use client'

import { Card, CardBody, Progress } from '@heroui/react'
import { EMOJI } from '@world-schools/wc-frontend-utils'
import type { ApplicationDetail } from '../../types/application-review'

interface TrustScoreSectionProps {
  application: ApplicationDetail
}

export function TrustScoreSection({ application }: TrustScoreSectionProps) {
  const trustScore = application.trustScore ?? 0
  const breakdown = application.trustScoreBreakdown

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success'
    if (score >= 60) return 'warning'
    return 'danger'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Needs Review'
  }

  return (
    <Card className="my-6">
      <CardBody className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              {EMOJI.STAR} Trust Score Assessment
            </h2>
            <div className="text-right">
              <div className="text-sm text-default-600">Status</div>
              <div
                className={`text-sm font-semibold ${
                  trustScore >= 80
                    ? 'text-success'
                    : trustScore >= 60
                      ? 'text-warning'
                      : 'text-danger'
                }`}
              >
                {getScoreLabel(trustScore)}
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          {breakdown && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Overall Trust Score */}
                <div className="rounded-xl border-2 border-primary/30 bg-linear-to-br from-primary/5 to-primary/10 p-4 hover:border-primary/50 transition-colors">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{EMOJI.STAR}</span>
                      <span className="text-sm font-semibold text-foreground">
                        Overall Trust Score
                      </span>
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        trustScore >= 80
                          ? 'text-success'
                          : trustScore >= 60
                            ? 'text-warning'
                            : 'text-danger'
                      }`}
                    >
                      {trustScore} / 100
                    </span>
                  </div>
                  <Progress
                    value={trustScore}
                    color={getScoreColor(trustScore)}
                    size="sm"
                    className="mb-2"
                  />
                  <div className="text-xs text-default-500">
                    {getScoreLabel(trustScore)} - Combined score from all categories
                  </div>
                </div>

                {/* Google Business Profile - 30 points */}
                <div className="rounded-xl border border-default-200 bg-default-50/50 p-4 hover:border-primary/30 transition-colors">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{EMOJI.SEARCH}</span>
                      <span className="text-sm font-semibold text-foreground">
                        Google Business Profile
                      </span>
                    </div>
                    <span className="text-sm font-bold text-primary-700">
                      {breakdown.breakdown.googleBusinessProfile.score} / 30
                    </span>
                  </div>
                  <Progress
                    value={(breakdown.breakdown.googleBusinessProfile.score / 30) * 100}
                    color={
                      breakdown.breakdown.googleBusinessProfile.score >= 21
                        ? 'success'
                        : breakdown.breakdown.googleBusinessProfile.score > 0
                          ? 'warning'
                          : 'danger'
                    }
                    size="sm"
                    className="mb-2"
                  />
                  <div className="text-xs text-default-500">
                    Profile verification, rating & reviews
                  </div>
                </div>

                {/* Legal Info + Business Age - 30 points */}
                <div className="rounded-xl border border-default-200 bg-default-50/50 p-4 hover:border-primary/30 transition-colors">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{EMOJI.DOCUMENT}</span>
                      <span className="text-sm font-semibold text-foreground">
                        Legal Info + Business Age
                      </span>
                    </div>
                    <span className="text-sm font-bold text-primary-700">
                      {breakdown.breakdown.legalInformation.score +
                        breakdown.breakdown.businessAge.score}{' '}
                      / 30
                    </span>
                  </div>
                  <Progress
                    value={
                      ((breakdown.breakdown.legalInformation.score +
                        breakdown.breakdown.businessAge.score) /
                        30) *
                      100
                    }
                    color={
                      breakdown.breakdown.legalInformation.score +
                        breakdown.breakdown.businessAge.score >=
                      21
                        ? 'success'
                        : breakdown.breakdown.legalInformation.score +
                              breakdown.breakdown.businessAge.score >
                            0
                          ? 'warning'
                          : 'danger'
                    }
                    size="sm"
                    className="mb-2"
                  />
                  <div className="text-xs text-default-500">
                    Legal info complete & years in business
                  </div>
                </div>

                {/* Camp Profile - 10 points */}
                <div className="rounded-xl border border-default-200 bg-default-50/50 p-4 hover:border-primary/30 transition-colors">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{EMOJI.TENT}</span>
                      <span className="text-sm font-semibold text-foreground">Camp Profile</span>
                    </div>
                    <span className="text-sm font-bold text-primary-700">
                      {breakdown.breakdown.campProfile.score} / 10
                    </span>
                  </div>
                  <Progress
                    value={(breakdown.breakdown.campProfile.score / 10) * 100}
                    color={
                      breakdown.breakdown.campProfile.score >= 7
                        ? 'success'
                        : breakdown.breakdown.campProfile.score > 0
                          ? 'warning'
                          : 'danger'
                    }
                    size="sm"
                    className="mb-2"
                  />
                  <div className="text-xs text-default-500">Description, camp type & age range</div>
                </div>

                {/* Document Verification - 20 points */}
                <div className="rounded-xl border border-default-200 bg-default-50/50 p-4 hover:border-primary/30 transition-colors">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{EMOJI.SHIELD}</span>
                      <span className="text-sm font-semibold text-foreground">
                        Document Verification
                      </span>
                    </div>
                    <span className="text-sm font-bold text-primary-700">
                      {breakdown.breakdown.verificationDocuments.score} / 20
                    </span>
                  </div>
                  <Progress
                    value={(breakdown.breakdown.verificationDocuments.score / 20) * 100}
                    color={
                      breakdown.breakdown.verificationDocuments.score >= 14
                        ? 'success'
                        : breakdown.breakdown.verificationDocuments.score > 0
                          ? 'warning'
                          : 'danger'
                    }
                    size="sm"
                    className="mb-2"
                  />
                  <div className="text-xs text-default-500">Business registration & insurance</div>
                </div>

                {/* Payment & Policies - 10 points */}
                <div className="rounded-xl border border-default-200 bg-default-50/50 p-4 hover:border-primary/30 transition-colors">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{EMOJI.CREDIT_CARD}</span>
                      <span className="text-sm font-semibold text-foreground">
                        Payment & Policies
                      </span>
                    </div>
                    <span className="text-sm font-bold text-primary-700">
                      {breakdown.breakdown.paymentPolicies.score} / 10
                    </span>
                  </div>
                  <Progress
                    value={(breakdown.breakdown.paymentPolicies.score / 10) * 100}
                    color={
                      breakdown.breakdown.paymentPolicies.score >= 7
                        ? 'success'
                        : breakdown.breakdown.paymentPolicies.score > 0
                          ? 'warning'
                          : 'danger'
                    }
                    size="sm"
                    className="mb-2"
                  />
                  <div className="text-xs text-default-500">Deposit & cancellation policy</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
