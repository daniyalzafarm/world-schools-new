'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle, Info } from 'lucide-react'
import { Tooltip } from '@heroui/react'
import { onboardingService } from '../../services/onboarding.services'

interface TrustScoreBadgeProps {
  section: 'step1' | 'step2' | 'step3' | 'step4' | 'step5'
  maxPoints: number
  className?: string
}

interface TrustScoreBreakdown {
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
    businessRegistration?: number
    insuranceCertificate?: number
    depositConfigured?: number
    cancellationPolicy?: number
  }
}

/**
 * Enhanced TrustScoreBadge Component
 *
 * Shows exact points earned with interactive tooltip displaying breakdown.
 * Features:
 * - Displays earned points vs max potential points
 * - Interactive hover tooltip with sub-factor breakdown
 * - Color-coded: green when complete, amber when incomplete
 * - Keyboard accessible with focus states
 * - Real-time updates when data changes
 */
export function TrustScoreBadge({ section, maxPoints, className = '' }: TrustScoreBadgeProps) {
  const [breakdown, setBreakdown] = useState<TrustScoreBreakdown | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchBreakdown = async () => {
      try {
        const data = await onboardingService.getTrustScoreBreakdown()
        setBreakdown(data)
      } catch (error) {
        console.error('Error fetching trust score breakdown:', error)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchBreakdown()

    // Set up polling for real-time updates (every 30 seconds)
    const interval = setInterval(fetchBreakdown, 30000)
    return () => clearInterval(interval)
  }, [])

  // Calculate earned points for this section
  const getEarnedPoints = (): number => {
    if (!breakdown) return 0

    switch (section) {
      case 'step1':
        return (
          (breakdown.breakdown.hasGoogleBusiness ?? 0) +
          (breakdown.breakdown.googleRating ?? 0) +
          (breakdown.breakdown.googleReviews ?? 0)
        )
      case 'step2':
        // Step 2: Legal Info (15 pts) + Business Age (15 pts) = 30 pts max
        return (breakdown.breakdown.legalInfoComplete ?? 0) + (breakdown.breakdown.businessAge ?? 0)
      case 'step3':
        // Step 3: Camp Profile (10 pts) = Description (4) + Camp Type (2) + Age Range (4)
        return (
          (breakdown.breakdown.descriptionComplete ?? 0) +
          (breakdown.breakdown.campTypeSelected ?? 0) +
          (breakdown.breakdown.ageRangeDefined ?? 0)
        )
      case 'step4':
        // Step 4: Document Verification (20 pts) = Business Registration (10) + Insurance (10)
        return (
          (breakdown.breakdown.businessRegistration ?? 0) +
          (breakdown.breakdown.insuranceCertificate ?? 0)
        )
      case 'step5':
        // Step 5: Payment & Policies (10 pts) = Deposit (5) + Cancellation Policy (5)
        return (
          (breakdown.breakdown.depositConfigured ?? 0) +
          (breakdown.breakdown.cancellationPolicy ?? 0)
        )
      default:
        return 0
    }
  }

  // Get tooltip content with breakdown
  const getTooltipContent = (): React.ReactNode => {
    if (!breakdown) return 'Loading...'

    const factors: { label: string; points: number; maxPoints: number; explanation: string }[] = []

    switch (section) {
      case 'step1': {
        // Google Business Profile (10 pts)
        const hasGBP = breakdown.breakdown.hasGoogleBusiness ?? 0
        factors.push({
          label: 'Google Business Profile',
          points: hasGBP,
          maxPoints: 10,
          explanation:
            hasGBP > 0 ? 'Profile connected and verified' : 'Connect your Google Business Profile',
        })

        // Google Rating (15 pts)
        const rating = breakdown.breakdown.googleRating ?? 0
        if (rating > 0) {
          factors.push({
            label: 'Google Rating',
            points: rating,
            maxPoints: 15,
            explanation: `Based on your star rating (formula: rating ÷ 5 × 15)`,
          })
        } else {
          factors.push({
            label: 'Google Rating',
            points: 0,
            maxPoints: 15,
            explanation:
              hasGBP > 0
                ? 'No rating available yet'
                : 'Connect Google Business to earn rating points',
          })
        }

        // Google Reviews (5 pts)
        const reviews = breakdown.breakdown.googleReviews ?? 0
        if (reviews > 0) {
          factors.push({
            label: 'Google Reviews',
            points: reviews,
            maxPoints: 5,
            explanation: `${reviews * 10}+ reviews (1 pt per 10 reviews)`,
          })
        } else {
          factors.push({
            label: 'Google Reviews',
            points: 0,
            maxPoints: 5,
            explanation:
              hasGBP > 0 ? 'No reviews yet' : 'Connect Google Business to earn review points',
          })
        }
        break
      }

      case 'step2': {
        // Legal Info Complete (15 pts)
        const legalInfo = breakdown.breakdown.legalInfoComplete ?? 0
        factors.push({
          label: 'Legal Info Complete',
          points: legalInfo,
          maxPoints: 15,
          explanation:
            legalInfo > 0
              ? 'Company name, address, and city provided'
              : 'Provide legal company name, address, and city',
        })

        // Business Age (15 pts)
        const businessAge = breakdown.breakdown.businessAge ?? 0
        const years =
          businessAge === 15
            ? '10+'
            : businessAge === 10
              ? '5-9'
              : businessAge === 5
                ? '2-4'
                : businessAge === 0
                  ? 'Not set'
                  : '0-1'
        factors.push({
          label: 'Business Age',
          points: businessAge,
          maxPoints: 15,
          explanation:
            businessAge > 0
              ? `${years} years in business`
              : 'Provide year your business was founded',
        })
        break
      }

      case 'step3': {
        // Description Complete (4 pts)
        const description = breakdown.breakdown.descriptionComplete ?? 0
        factors.push({
          label: 'Description Complete',
          points: description,
          maxPoints: 4,
          explanation:
            description > 0
              ? 'Camp description (100-300 characters)'
              : 'Add a camp description (100-300 characters)',
        })

        // Camp Type Selected (2 pts)
        const campType = breakdown.breakdown.campTypeSelected ?? 0
        factors.push({
          label: 'Camp Type Selected',
          points: campType,
          maxPoints: 2,
          explanation:
            campType > 0
              ? 'Day camp or overnight camp selected'
              : 'Select day camp, overnight camp, or both',
        })

        // Age Range Defined (4 pts)
        const ageRange = breakdown.breakdown.ageRangeDefined ?? 0
        factors.push({
          label: 'Age Range Defined',
          points: ageRange,
          maxPoints: 4,
          explanation:
            ageRange > 0
              ? 'Minimum and maximum camper ages specified'
              : 'Define minimum and maximum camper ages',
        })
        break
      }

      case 'step4': {
        // Business Registration (10 pts)
        const businessReg = breakdown.breakdown.businessRegistration ?? 0
        factors.push({
          label: 'Business Registration',
          points: businessReg,
          maxPoints: 10,
          explanation:
            businessReg > 0
              ? 'Business registration document uploaded'
              : 'Upload business registration document',
        })

        // Insurance Certificate (10 pts)
        const insurance = breakdown.breakdown.insuranceCertificate ?? 0
        factors.push({
          label: 'Insurance Certificate',
          points: insurance,
          maxPoints: 10,
          explanation:
            insurance > 0 ? 'Insurance certificate uploaded' : 'Upload insurance certificate',
        })
        break
      }

      case 'step5': {
        // Deposit Configured (5 pts)
        const deposit = breakdown.breakdown.depositConfigured ?? 0
        factors.push({
          label: 'Deposit Configured',
          points: deposit,
          maxPoints: 5,
          explanation:
            deposit > 0
              ? 'Deposit requirement and amount set'
              : 'Configure deposit requirement (percentage or fixed amount)',
        })

        // Cancellation Policy (5 pts)
        const policy = breakdown.breakdown.cancellationPolicy ?? 0
        const policyType =
          policy === 5
            ? 'Flexible (most customer-friendly)'
            : policy === 3
              ? 'Moderate (balanced)'
              : policy === 2
                ? 'Strict (least flexible)'
                : 'Not set'
        factors.push({
          label: 'Cancellation Policy',
          points: policy,
          maxPoints: 5,
          explanation:
            policy > 0 ? `${policyType}` : 'Set cancellation policy (flexible earns most points)',
        })
        break
      }
    }

    return (
      <div className="max-w-xs space-y-2 p-2">
        <div className="mb-3 border-b border-default-200 pb-2">
          <div className="text-sm font-semibold text-foreground">Score Breakdown</div>
        </div>
        {factors.map((factor, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{factor.label}</span>
              <span className="text-xs font-semibold text-primary">
                {factor.points}/{factor.maxPoints} pts
              </span>
            </div>
            <div className="text-xs text-default-500">{factor.explanation}</div>
          </div>
        ))}
      </div>
    )
  }

  const earnedPoints = getEarnedPoints()
  const isComplete = earnedPoints >= maxPoints * 0.5 // Consider complete if >50% earned
  const isFullyComplete = earnedPoints === maxPoints

  if (isLoading) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-default-100 px-3 py-1 text-sm font-semibold text-default-400 ${className}`}
      >
        <Info className="h-4 w-4 animate-pulse" />
        Loading...
      </span>
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow Enter or Space to trigger tooltip (handled by HeroUI Tooltip)
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
    }
  }

  return (
    <Tooltip
      content={getTooltipContent()}
      placement="bottom"
      delay={200}
      closeDelay={100}
      classNames={{
        base: 'max-w-md',
        content: 'bg-white shadow-lg border border-default-200 rounded-lg',
      }}
    >
      <span
        className={`inline-flex cursor-help items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          isFullyComplete
            ? 'bg-success-50 text-success-700'
            : isComplete
              ? 'bg-primary-50 text-primary-700'
              : 'bg-warning-50 text-warning-700'
        } ${className}`}
        tabIndex={0}
        role="button"
        aria-label={`Trust score: ${earnedPoints} out of ${maxPoints} points earned. Press to view breakdown.`}
        onKeyDown={handleKeyDown}
      >
        {isFullyComplete && <CheckCircle className="h-4 w-4" />}
        {!isFullyComplete && <Info className="h-4 w-4" />}
        <span>
          {earnedPoints}/{maxPoints} pts
        </span>
      </span>
    </Tooltip>
  )
}
