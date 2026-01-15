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
    // If there's a form submit handler from the page, use it
    if (wizardFormSubmit) {
      await wizardFormSubmit()
    } else if (currentStep < 4 && campId) {
      // Default navigation for steps without custom handlers
      const nextStep = currentStep + 1
      router.push(`/camps/create/${STEP_PATHS[nextStep]}?id=${campId}`)
    }
  }

  const handleSave = async () => {
    // For step 4 (photos), trigger the save handler
    if (wizardFormSubmit) {
      await wizardFormSubmit()
    }
  }

  // Determine if next button should be disabled
  // For step 1, we need wizardFormValid. For other steps, we need both campId and wizardFormValid
  const isNextDisabled =
    currentStep === 1 ? !wizardFormValid || isLoading : !campId || !wizardFormValid || isLoading

  // For step 4, determine if save button should be disabled
  const isSaveDisabled = !hasUnsavedChanges || !wizardFormValid || isLoading

  return (
    <div className="border-t border-default-100 bg-white px-12 py-4">
      <div className="flex items-center justify-between">
        {/* Back Button */}
        <Button variant="light" onPress={handleBack}>
          ← {currentStep === 1 ? 'Cancel' : 'Back'}
        </Button>

        {/* Next/Continue Button for steps 1-3 */}
        {currentStep < 4 && (
          <Button color="primary" size="lg" onPress={handleNext} isDisabled={isNextDisabled}>
            Save & Continue →
          </Button>
        )}

        {/* Save Button for step 4 (photos) */}
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
  )
}
