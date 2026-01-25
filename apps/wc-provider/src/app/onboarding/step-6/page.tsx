'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Checkbox, Spinner } from '@heroui/react'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { ValidationErrors } from '../../../components/onboarding/ValidationErrors'
import { SubmitConfirmationDialog } from '../../../components/onboarding/SubmitConfirmationDialog'
import { TrustScoreDisplay } from '../../../components/onboarding/TrustScoreDisplay'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'
import {
  validateOnboardingCompletion,
  type ValidationError,
} from '../../../utils/onboarding-validation'

const COMPLETION_ITEMS = [
  { step: 1, label: 'Google Business Profile selected', path: '/onboarding/step-1' },
  { step: 2, label: 'Contact and legal information completed', path: '/onboarding/step-2' },
  { step: 3, label: 'Camp description and details provided', path: '/onboarding/step-3' },
  { step: 4, label: 'Required documents uploaded', path: '/onboarding/step-4' },
  { step: 5, label: 'Payment and cancellation policies configured', path: '/onboarding/step-5' },
]

export default function OnboardingStep6Page() {
  const router = useRouter()
  const { status, validateOnboarding, completeOnboarding, fetchDocuments } = useOnboardingStore()

  // Terms agreement - set to true if already completed
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // Read-only mode when application is already submitted
  const isReadOnly = status?.isCompleted ?? false

  // Validation state
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean
    errors: ValidationError[]
  } | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isValidating, setIsValidating] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Ref to track if validation has already run
  const hasValidated = useRef(false)

  // Route protection: Check if user can access Step 6
  useEffect(() => {
    if (status && !canAccessStep(6, status)) {
      const nextStep = getNextAccessibleStep(status)
      router.push(nextStep)
    }
  }, [status, router])

  // Set checkbox to checked if application is already completed
  useEffect(() => {
    if (status?.isCompleted) {
      setAgreedToTerms(true)
    }
  }, [status?.isCompleted])

  // Fetch documents and run validation on mount (only once)
  useEffect(() => {
    // Prevent running validation multiple times
    if (hasValidated.current) return

    const runValidation = async () => {
      // Mark as validated to prevent re-runs
      hasValidated.current = true

      try {
        // Fetch documents first
        await fetchDocuments()
      } catch (error) {
        console.error('Failed to fetch documents:', error)
      }

      if (!status) {
        setIsValidating(false)
        return
      }

      setIsValidating(true)
      setValidationErrors([])

      try {
        // Get current documents from store
        const currentDocuments = useOnboardingStore.getState().documents

        // Run frontend validation
        const frontendValidation = validateOnboardingCompletion(status, currentDocuments)

        // Run backend validation
        const backendValidation = await validateOnboarding()

        // Combine results
        const allErrors = [...frontendValidation.errors, ...backendValidation.errors]
        const isValid = frontendValidation.isValid && backendValidation.isValid

        setValidationResult({ isValid, errors: allErrors })
        setValidationErrors(allErrors)
      } catch (error: any) {
        console.error('Validation error:', error)
        if (error.response?.data?.errors) {
          setValidationErrors(error.response.data.errors)
          setValidationResult({ isValid: false, errors: error.response.data.errors })
        }
      } finally {
        setIsValidating(false)
      }
    }

    void runValidation()
  }, []) // Empty dependency array - run only once on mount

  const handleSubmitApplication = () => {
    if (!agreedToTerms || !validationResult?.isValid) {
      return
    }

    // Show confirmation dialog
    setShowConfirmDialog(true)
  }

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true)
    try {
      await completeOnboarding()
      setShowConfirmDialog(false)
      router.push('/onboarding/status')
    } catch (error: any) {
      setIsSubmitting(false)
      // Handle submission errors
      if (error.response?.data?.errors) {
        setValidationErrors(error.response.data.errors)
        setValidationResult({ isValid: false, errors: error.response.data.errors })
        setShowConfirmDialog(false)
      }
    }
  }

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <OnboardingPageLayout
      breadcrumb="Provider Onboarding / Review & Submit"
      showAutoSave={false}
      footer={
        <div className="flex items-center justify-between">
          <Button variant="light" onPress={() => router.push('/onboarding/step-5')}>
            ← Back
          </Button>
          {!isReadOnly && (
            <Button
              className="bg-primary font-semibold text-foreground hover:bg-primary-600"
              size="lg"
              onPress={handleSubmitApplication}
              isDisabled={!agreedToTerms || !validationResult?.isValid}
              isLoading={isSubmitting}
            >
              Submit Application →
            </Button>
          )}
          {isReadOnly && (
            <Button
              className="bg-primary font-semibold text-foreground hover:bg-primary-600"
              size="lg"
              onPress={() => router.push('/onboarding/status')}
            >
              View Status →
            </Button>
          )}
        </div>
      }
    >
      <div>
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold leading-tight text-foreground">
            Review & Submit Application
          </h1>
          <p className="text-base text-default-500">
            Please review your application details before final submission
          </p>
        </div>

        {/* Trust Score Section */}
        {status?.trustScore !== undefined && status?.trustScore !== null && (
          <div className="mb-8 rounded-xl border border-primary-200 bg-primary-50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Your Trust Score</h2>
            <TrustScoreDisplay
              score={status.trustScore}
              breakdown={status.trustScoreBreakdown}
              showBreakdown={true}
              size="lg"
            />
          </div>
        )}

        {/* Validation Status Section */}
        {isValidating ? (
          <div className="mb-8 rounded-xl border border-default-200 bg-white p-8">
            <div className="flex items-center justify-center gap-3">
              <Spinner size="md" />
              <span className="text-default-500">Running validation checks...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Validation Summary */}
            {validationResult?.isValid ? (
              <div className="mb-8 rounded-xl bg-primary-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  All Requirements Complete
                </h3>
                <div className="flex flex-col gap-2">
                  {COMPLETION_ITEMS.map(item => {
                    const stepKey = `step${item.step}` as keyof typeof status.stepCompletion
                    const isCompleted = status.stepCompletion[stepKey]

                    return (
                      <div key={item.step} className="flex items-center gap-2">
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-success-300" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-warning-600" />
                        )}
                        <span
                          className={`text-sm ${isCompleted ? 'text-secondary-400' : 'text-default-500'}`}
                        >
                          {item.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="mb-8 rounded-xl border border-danger-200 bg-danger-50 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <XCircle className="h-6 w-6 text-danger-600" />
                  <h3 className="text-xl font-semibold text-foreground">Validation Issues Found</h3>
                </div>
                <p className="mb-4 text-sm text-default-500">
                  Please complete the following requirements before submitting your application:
                </p>
                <ValidationErrors errors={validationErrors} />
              </div>
            )}

            {/* What Happens Next */}
            <div className="mb-8 rounded-xl border border-default-200 bg-default-50 p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">What happens next?</h3>
              <ul className="flex flex-col gap-3 text-sm text-default-500">
                <li className="flex items-start gap-3">
                  <span className="text-secondary">1.</span>
                  <span>Your application will be submitted for review</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-secondary">2.</span>
                  <span>Our team will review your information within 2-3 business days</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-secondary">3.</span>
                  <span>You'll receive an email notification with the review decision</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-secondary">4.</span>
                  <span>Once approved, you can start creating and publishing camps</span>
                </li>
              </ul>
            </div>

            {/* Important Notice */}
            <div className="mb-8 rounded-xl border border-warning-200 bg-warning-50 p-6">
              <p className="text-sm text-default-500">
                <strong className="text-foreground">Important:</strong> After submission, you won't
                be able to edit your application until the review is complete. Make sure all
                information is accurate.
              </p>
            </div>

            {/* Terms Agreement */}
            <div className="mb-8 flex items-center rounded-xl border border-default-200 bg-white p-6">
              <Checkbox
                isSelected={agreedToTerms}
                onValueChange={setAgreedToTerms}
                isDisabled={isReadOnly}
              />
              <div className="flex-1">
                <label
                  className={`select-none text-sm text-foreground ${!isReadOnly ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                  onClick={() => !isReadOnly && setAgreedToTerms(!agreedToTerms)}
                >
                  I agree to the{' '}
                  <a
                    href="/terms-of-service"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="cursor-pointer text-primary-600 hover:underline focus:outline-none"
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    href="/provider-agreement"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="cursor-pointer text-primary-600 hover:underline focus:outline-none"
                  >
                    Provider Agreement
                  </a>
                </label>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Submit Confirmation Dialog */}
      <SubmitConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmSubmit}
        isLoading={isSubmitting}
      />
    </OnboardingPageLayout>
  )
}
