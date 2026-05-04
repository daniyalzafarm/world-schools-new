import type { OnboardingStatus } from '../types/onboarding'

/**
 * Where an authenticated provider should go when they hit an /auth/* route or
 * complete sign-in / email verification. Single source of truth shared by the
 * signin page and the auth layout so the two cannot drift.
 */
export function getPostAuthRedirect(status: OnboardingStatus | null): string {
  if (status?.approvalStatus === 'approved') return '/dashboard'
  if (!status?.isCompleted) return '/onboarding'
  if (
    status.approvalStatus === 'under_review' ||
    status.approvalStatus === 'rejected' ||
    status.approvalStatus === 'info_requested'
  ) {
    return '/onboarding/status'
  }
  return '/onboarding'
}
