import type { OnboardingStatus, VerificationDocument } from '../types/onboarding'

export interface ValidationError {
  step: number
  stepName: string
  field: string
  message: string
  path: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Validates all onboarding steps before submission
 */
export function validateOnboardingCompletion(
  status: OnboardingStatus,
  documents: VerificationDocument[]
): ValidationResult {
  const errors: ValidationError[] = []

  // Step 1: Google Business Profile
  if (!status.stepCompletion.step1) {
    errors.push({
      step: 1,
      stepName: 'Find Your Camp',
      field: 'googleBusinessProfile',
      message: 'Google Business Profile must be selected and saved',
      path: '/onboarding/step-1',
    })
  }

  // Step 2: Contact & Account Info
  if (!status.stepCompletion.step2) {
    errors.push({
      step: 2,
      stepName: 'Contact & Account',
      field: 'contactInfo',
      message: 'All required contact information and legal company details must be completed',
      path: '/onboarding/step-2',
    })
  }

  // Step 3: Camp Info
  if (!status.stepCompletion.step3) {
    errors.push({
      step: 3,
      stepName: 'About Your Camp',
      field: 'campInfo',
      message: 'Camp description, type, and age range must be filled',
      path: '/onboarding/step-3',
    })
  }

  // Step 4: Required Documents
  if (!status.stepCompletion.step4) {
    errors.push({
      step: 4,
      stepName: 'Verification Documents',
      field: 'documents',
      message: 'Required documents must be uploaded',
      path: '/onboarding/step-4',
    })
  } else {
    // Check for specific required documents
    const hasBusinessRegistration = documents.some(
      doc => doc.documentType === 'business_registration'
    )
    const hasInsuranceCertificate = documents.some(
      doc => doc.documentType === 'insurance_certificate'
    )

    if (!hasBusinessRegistration) {
      errors.push({
        step: 4,
        stepName: 'Verification Documents',
        field: 'business_registration',
        message: 'Business Registration document is required',
        path: '/onboarding/step-4',
      })
    }

    if (!hasInsuranceCertificate) {
      errors.push({
        step: 4,
        stepName: 'Verification Documents',
        field: 'insurance_certificate',
        message: 'Insurance Certificate document is required',
        path: '/onboarding/step-4',
      })
    }
  }

  // Step 5: Payment & Policies
  if (!status.stepCompletion.step5) {
    errors.push({
      step: 5,
      stepName: 'Payment & Policies',
      field: 'settings',
      message: 'Payment settings and cancellation policy must be configured',
      path: '/onboarding/step-5',
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validates deposit settings
 */
export function validateDepositSettings(
  depositType: 'percentage' | 'fixed_amount',
  depositPercentage: string,
  depositFixedAmount: string
): { isValid: boolean; error?: string } {
  if (depositType === 'percentage') {
    const percentage = parseFloat(depositPercentage)
    if (isNaN(percentage) || percentage < 1 || percentage > 100) {
      return {
        isValid: false,
        error: 'Deposit percentage must be between 1 and 100',
      }
    }
  } else {
    const amount = parseFloat(depositFixedAmount)
    if (isNaN(amount) || amount < 1) {
      return {
        isValid: false,
        error: 'Deposit amount must be at least $1',
      }
    }
  }

  return { isValid: true }
}
