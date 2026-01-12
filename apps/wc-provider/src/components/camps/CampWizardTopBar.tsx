'use client'

import { useRouter } from 'next/navigation'
import { addToast, Button } from '@heroui/react'
import { useCampsStore } from '../../stores/camps-store'
import { useState } from 'react'

interface CampWizardTopBarProps {
  currentStep: number
  campId?: string
}

const STEP_TITLES: Record<number, string> = {
  1: 'Basic Information',
  2: 'Target Audience',
  3: 'Programs & Activities',
  4: 'Photos',
}

export function CampWizardTopBar({ currentStep, campId }: CampWizardTopBarProps) {
  const router = useRouter()
  const { saveDraft, publishCamp, isLoading } = useCampsStore()
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const handleSaveDraft = async () => {
    if (!campId) return

    setIsSaving(true)
    try {
      await saveDraft()
      router.push('/camps')
    } catch (error) {
      console.error('Failed to save draft:', error)
      addToast({
        title: 'Error',
        description: 'Failed to save draft. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!campId) return

    // Only allow publishing from step 4
    if (currentStep !== 4) {
      addToast({
        title: 'Cannot Publish',
        description: 'Please complete all steps before publishing.',
        color: 'warning',
      })
      return
    }

    setIsPublishing(true)
    try {
      await publishCamp(campId)
      // Show success and redirect
      addToast({
        title: 'Success',
        description: 'Camp published successfully!',
        color: 'success',
      })
      router.push('/camps')
    } catch (error: any) {
      console.error('Failed to publish camp:', error)
      addToast({
        title: 'Error',
        description: error.message || 'Failed to publish camp. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="flex min-h-[61px] items-center justify-between border-b border-default-200 bg-white px-12 py-5">
      {/* Breadcrumb */}
      <div className="text-[13px] text-default-500">
        Create Camp / {STEP_TITLES[currentStep] || 'Unknown Step'}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {campId && (
          <>
            <Button
              variant="bordered"
              onPress={handleSaveDraft}
              isLoading={isSaving}
              isDisabled={isLoading || isPublishing}
            >
              Save Draft
            </Button>
            <Button
              color="primary"
              onPress={handlePublish}
              isLoading={isPublishing}
              isDisabled={isLoading || isSaving || currentStep !== 4}
            >
              Publish
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
