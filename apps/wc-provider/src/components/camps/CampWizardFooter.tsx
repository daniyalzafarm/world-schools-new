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
  const { wizardFormValid, wizardFormSubmit, isLoading, hasUnsavedChanges, hasPendingAutoSave } =
    useCampsStore()

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
    if (wizardFormSubmit) {
      await wizardFormSubmit()
      if (useCampsStore.getState().error) return
    }

    // Use store fallback so new-camp creation (where campId prop is still undefined) works
    const resolvedCampId = campId ?? useCampsStore.getState().wizardCamp?.id
    if (currentStep < 5 && resolvedCampId) {
      const nextStep = currentStep + 1
      router.push(`/camps/create/${STEP_PATHS[nextStep]}?id=${resolvedCampId}`)
    } else if (currentStep === 5 && resolvedCampId) {
      router.push('/camps')
    }
  }

  // Determine navigation availability
  const hasNext = currentStep < 5

  // For steps 1–3, when Save & Continue is actionable the user must save before navigating
  const saveAndContinueIsActive =
    currentStep <= 3 && hasUnsavedChanges && wizardFormValid && !isLoading

  const isNextDisabled =
    currentStep === 1
      ? !wizardFormValid || isLoading || saveAndContinueIsActive
      : !campId ||
        !wizardFormValid ||
        isLoading ||
        saveAndContinueIsActive ||
        (currentStep === 4 && hasPendingAutoSave)

  // Save & Continue button: only enabled when there are unsaved changes
  const isSaveAndContinueDisabled = !hasUnsavedChanges || !wizardFormValid || isLoading

  return (
    <div className="h-20 bg-white px-12 py-4 border-t border-default-200">
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

        {/* Right side: Save action buttons (steps 1-3 only; step 4 auto-saves per action) */}
        <div className="flex items-center gap-3">
          {currentStep < 4 && (
            <Button
              color="primary"
              onPress={handleSaveAndNext}
              isDisabled={isSaveAndContinueDisabled}
              isLoading={isLoading}
            >
              Save & Continue →
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
