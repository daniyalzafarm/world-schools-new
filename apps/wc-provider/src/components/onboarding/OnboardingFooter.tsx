'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@heroui/react'

interface OnboardingFooterProps {
  /**
   * Optional custom next button handler
   * If not provided, will navigate to the next step automatically
   */
  onNext?: () => void | Promise<void>

  /**
   * Optional custom back button handler
   * If not provided, will navigate to the previous step automatically
   */
  onBack?: () => void | Promise<void>

  /**
   * Whether the next button is loading
   */
  isLoading?: boolean

  /**
   * Whether the next button is disabled
   */
  isDisabled?: boolean

  /**
   * Custom text for the next button
   */
  nextButtonText?: string

  /**
   * Custom text for the back button
   */
  backButtonText?: string
}

// Onboarding step paths in order
const ONBOARDING_STEPS = [
  'contact',
  'find-your-camp',
  'about-your-camp',
  'verification',
  'payment-policies',
  'review',
]

export function OnboardingFooter({
  onNext,
  onBack,
  isLoading = false,
  isDisabled = false,
  nextButtonText,
  backButtonText = '← Back',
}: OnboardingFooterProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Get current step from pathname
  const currentStep = ONBOARDING_STEPS.find(step => pathname.includes(step))
  const currentIndex = currentStep ? ONBOARDING_STEPS.indexOf(currentStep) : -1

  // Calculate navigation
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < ONBOARDING_STEPS.length - 1
  const previousStep = hasPrevious ? ONBOARDING_STEPS[currentIndex - 1] : null
  const nextStep = hasNext ? ONBOARDING_STEPS[currentIndex + 1] : null

  // Default next button text based on position
  const defaultNextButtonText = hasNext ? 'Save & Continue →' : 'Complete Onboarding'

  const handleBack = async () => {
    if (onBack) {
      await onBack()
    } else if (previousStep) {
      router.push(`/onboarding/${previousStep}`)
    }
  }

  const handleNext = async () => {
    if (onNext) {
      await onNext()
    } else if (nextStep) {
      router.push(`/onboarding/${nextStep}`)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <Button variant="light" onPress={handleBack} isDisabled={!hasPrevious}>
        {backButtonText}
      </Button>
      <Button
        color="primary"
        size="lg"
        onPress={handleNext}
        isLoading={isLoading}
        isDisabled={isDisabled}
      >
        {nextButtonText || defaultNextButtonText}
      </Button>
    </div>
  )
}
