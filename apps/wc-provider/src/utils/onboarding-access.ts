import type { OnboardingStatus } from '../types/onboarding'

/**
 * Determines if a user can access a specific onboarding step
 * based on their completion status
 */
export function canAccessStep(step: number, status: OnboardingStatus | null): boolean {
  if (!status) return false

  // Step 1 is always accessible
  if (step === 1) return true

  // Step 2 requires Step 1 to be completed
  if (step === 2) return status.stepCompletion.step1

  // Step 3 requires Steps 1-2 to be completed
  if (step === 3) return status.stepCompletion.step1 && status.stepCompletion.step2

  // Step 4 requires Steps 1-3 to be completed
  if (step === 4) {
    return status.stepCompletion.step1 && status.stepCompletion.step2 && status.stepCompletion.step3
  }

  // Step 5 requires Steps 1-4 to be completed
  if (step === 5) {
    return (
      status.stepCompletion.step1 &&
      status.stepCompletion.step2 &&
      status.stepCompletion.step3 &&
      status.stepCompletion.step4
    )
  }

  // Step 6 requires Steps 1-5 to be completed
  if (step === 6) {
    return (
      status.stepCompletion.step1 &&
      status.stepCompletion.step2 &&
      status.stepCompletion.step3 &&
      status.stepCompletion.step4 &&
      status.stepCompletion.step5
    )
  }

  return false
}

/**
 * Gets the next accessible step for a user based on their completion status
 */
export function getNextAccessibleStep(status: OnboardingStatus | null): string {
  if (!status) return '/onboarding/step-1'

  // If onboarding is completed, check approval status
  if (status.isCompleted) {
    if (status.approvalStatus === 'approved') {
      return '/dashboard'
    }
    // For other statuses (under_review, rejected, info_requested), go to consolidated status page
    if (
      status.approvalStatus === 'under_review' ||
      status.approvalStatus === 'rejected' ||
      status.approvalStatus === 'info_requested'
    ) {
      return '/onboarding/status'
    }
  }

  // Find the first incomplete step
  if (!status.stepCompletion.step1) return '/onboarding/step-1'
  if (!status.stepCompletion.step2) return '/onboarding/step-2'
  if (!status.stepCompletion.step3) return '/onboarding/step-3'
  if (!status.stepCompletion.step4) return '/onboarding/step-4'
  if (!status.stepCompletion.step5) return '/onboarding/step-5'
  if (!status.stepCompletion.step6) return '/onboarding/step-6'

  // All steps completed but onboarding not marked as complete
  return '/onboarding/status'
}

/**
 * Determines if a user can access the status page
 */
export function canAccessStatusPage(status: OnboardingStatus | null): boolean {
  if (!status) return false

  // Status page is only accessible if onboarding is completed
  // and the approval status is not 'approved' or 'pending'
  return (
    status.isCompleted &&
    status.approvalStatus !== 'approved' &&
    status.approvalStatus !== 'pending'
  )
}
