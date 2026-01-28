'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { useCampsStore } from '../../stores/camps-store'

interface CampWizardFooterProps {
  currentStep: number
  campId?: string
}

const STEP_PATHS: Record<number, string> = {
  1: 'basic-info',
  2: 'audience',
  3: 'programs',
  4: 'photos',
  5: 'sessions',
}

export function CampWizardFooter({ currentStep, campId }: CampWizardFooterProps) {
  const router = useRouter()
  const { wizardFormValid, wizardFormSubmit, isLoading, hasUnsavedChanges } = useCampsStore()

  const handleBack = () => {
    if (currentStep > 1 && campId) {
      const prevStep = currentStep - 1
      router.push(`/camps/create/${STEP_PATHS[prevStep]}?id=${campId}`)
    } else {
      router.push('/camps')
    }
  }

  const handleNext = async () => {
    // Navigate to next step WITHOUT saving
    if (currentStep < 5 && campId) {
      const nextStep = currentStep + 1
      router.push(`/camps/create/${STEP_PATHS[nextStep]}?id=${campId}`)
    } else if (currentStep === 5 && campId) {
      // After sessions step, redirect to camps list or publish
      router.push('/camps')
    }
  }

  const handleSaveAndNext = async () => {
    // Save current step data, then navigate to next step
    if (wizardFormSubmit) {
      await wizardFormSubmit()
    }

    // Navigate to next step after successful save
    if (currentStep < 5 && campId) {
      const nextStep = currentStep + 1
      router.push(`/camps/create/${STEP_PATHS[nextStep]}?id=${campId}`)
    } else if (currentStep === 5 && campId) {
      router.push('/camps')
    }
  }

  const handleSave = async () => {
    // For step 4 (photos), trigger the save handler
    if (wizardFormSubmit) {
      await wizardFormSubmit()
    }
  }

  // Determine navigation availability
  const hasNext = currentStep < 5

  // Next button: enabled when form is valid (doesn't require unsaved changes)
  // For step 1, we need wizardFormValid. For other steps, we need both campId and wizardFormValid
  const isNextDisabled =
    currentStep === 1 ? !wizardFormValid || isLoading : !campId || !wizardFormValid || isLoading

  // Save & Continue button: only enabled when there are unsaved changes
  const isSaveAndContinueDisabled = !hasUnsavedChanges || !wizardFormValid || isLoading

  // Save button (step 4): only enabled when there are unsaved changes
  const isSaveDisabled = !hasUnsavedChanges || !wizardFormValid || isLoading

  return (
    <div className="h-20 bg-white px-12 py-4 border-t-2 border-default-100">
      <div className="mx-auto max-w-4xl px-12 flex items-center justify-between">
        {/* Left side: Navigation buttons (Back and Next) */}
        <div className="flex items-center gap-3">
          <Button variant="bordered" onPress={handleBack} isDisabled={currentStep === 1}>
            Back
          </Button>
          {hasNext && (
            <Button color="secondary" onPress={handleNext} isDisabled={isNextDisabled}>
              Next
            </Button>
          )}
        </div>

        {/* Right side: Save action buttons */}
        <div className="flex items-center gap-3">
          {/* Save & Continue Button for steps 1-3 */}
          {currentStep < 4 && (
            <Button
              color="primary"
              size="lg"
              onPress={handleSaveAndNext}
              isDisabled={isSaveAndContinueDisabled}
              isLoading={isLoading}
            >
              Save & Continue →
            </Button>
          )}

          {/* Save Photos Button for step 4 */}
          {currentStep === 4 && (
            <Button
              color="primary"
              size="lg"
              onPress={handleSave}
              isDisabled={isSaveDisabled}
              isLoading={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Photos'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
