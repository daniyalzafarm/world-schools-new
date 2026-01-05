'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardBody, Spinner } from '@heroui/react'
import { onboardingService } from '../../services/onboarding.services'

interface TrustScoreBreakdownData {
  score: number
  breakdown: {
    hasGoogleBusiness?: number
    googleRating?: number
    googleReviews?: number
    businessAge?: number
    legalInfoComplete?: number
    descriptionComplete?: number
    campTypeSelected?: number
    ageRangeDefined?: number
    depositConfigured?: number
    cancellationPolicy?: number
  }
}

/**
 * TrustScoreBreakdown Component
 *
 * Displays detailed breakdown of trust score calculation
 * Shows all factors contributing to the total score
 */
export function TrustScoreBreakdown() {
  const [data, setData] = useState<TrustScoreBreakdownData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBreakdown = async () => {
      try {
        setIsLoading(true)
        const response = await onboardingService.getTrustScoreBreakdown()
        setData(response)
      } catch (err: any) {
        console.error('Error fetching trust score breakdown:', err)
        setError(err?.message || 'Failed to load trust score breakdown')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchBreakdown()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardBody className="flex items-center justify-center p-8">
          <Spinner size="lg" />
        </CardBody>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardBody className="p-6">
          <p className="text-danger">{error || 'No data available'}</p>
        </CardBody>
      </Card>
    )
  }

  const { score, breakdown } = data

  return (
    <Card>
      <CardBody className="p-6">
        <div className="mb-6">
          <h3 className="mb-2 text-xl font-bold text-foreground">Trust Score Breakdown</h3>
          <p className="text-sm text-default-500">
            Detailed view of all factors contributing to your trust score
          </p>
        </div>

        <div className="mb-6 rounded-lg bg-primary-50 p-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">{score}</div>
            <div className="text-sm text-default-600">Total Score</div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-foreground">Score Components:</h4>

          {breakdown.hasGoogleBusiness !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-default-50 p-3">
              <span className="text-sm text-foreground">Google Business Profile</span>
              <span className="font-semibold text-success">{breakdown.hasGoogleBusiness} pts</span>
            </div>
          )}

          {breakdown.googleRating !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-default-50 p-3">
              <span className="text-sm text-foreground">Google Rating</span>
              <span className="font-semibold text-success">{breakdown.googleRating} pts</span>
            </div>
          )}

          {breakdown.googleReviews !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-default-50 p-3">
              <span className="text-sm text-foreground">Google Reviews</span>
              <span className="font-semibold text-success">{breakdown.googleReviews} pts</span>
            </div>
          )}

          {breakdown.legalInfoComplete !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-default-50 p-3">
              <span className="text-sm text-foreground">Legal Info Complete</span>
              <span className="font-semibold text-success">{breakdown.legalInfoComplete} pts</span>
            </div>
          )}

          {breakdown.businessAge !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-default-50 p-3">
              <span className="text-sm text-foreground">Business Age</span>
              <span className="font-semibold text-success">{breakdown.businessAge} pts</span>
            </div>
          )}

          {breakdown.descriptionComplete !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-default-50 p-3">
              <span className="text-sm text-foreground">Description Complete</span>
              <span className="font-semibold text-success">
                {breakdown.descriptionComplete} pts
              </span>
            </div>
          )}

          {breakdown.campTypeSelected !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-default-50 p-3">
              <span className="text-sm text-foreground">Camp Type Selected</span>
              <span className="font-semibold text-success">{breakdown.campTypeSelected} pts</span>
            </div>
          )}

          {breakdown.ageRangeDefined !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-default-50 p-3">
              <span className="text-sm text-foreground">Age Range Defined</span>
              <span className="font-semibold text-success">{breakdown.ageRangeDefined} pts</span>
            </div>
          )}

          {breakdown.depositConfigured !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-default-50 p-3">
              <span className="text-sm text-foreground">Deposit Configured</span>
              <span className="font-semibold text-success">{breakdown.depositConfigured} pts</span>
            </div>
          )}

          {breakdown.cancellationPolicy !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-default-50 p-3">
              <span className="text-sm text-foreground">Cancellation Policy</span>
              <span className="font-semibold text-success">{breakdown.cancellationPolicy} pts</span>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
