'use client'

import { useRouter } from 'next/navigation'
import { addToast, Button } from '@heroui/react'
import { useCampsStore } from '../../stores/camps-store'
import { useState } from 'react'
import { Can } from '@/components/auth/can'

interface CampWizardTopBarProps {
  currentStep: number
  campId?: string
}

const STEP_TITLES: Record<number, string> = {
  1: 'Basic Information',
  2: 'Target Audience',
  3: 'Programs & Activities',
  4: 'Photos',
  5: 'Sessions',
}

export function CampWizardTopBar({ currentStep, campId }: CampWizardTopBarProps) {
  const router = useRouter()
  const { saveDraft, publishCamp, isLoading } = useCampsStore()
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const handleSaveDraft = async () => {
    if (!campId) return

    setIsSaving(true)
    saveDraft()
    setIsSaving(false)
    router.push('/camps')
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
    await publishCamp(campId)
    setIsPublishing(false)
    if (useCampsStore.getState().error) return
    addToast({
      title: 'Success',
      description: 'Camp published successfully!',
      color: 'success',
    })
    router.push('/camps')
  }

  return (
    <div className="flex h-18 items-center justify-between border-b border-default-200 bg-white px-12 py-5">
      {/* Breadcrumb */}
      <div className="text-sm text-default-500">
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
            <Can permission="camps.publish">
              <Button
                color="primary"
                onPress={handlePublish}
                isLoading={isPublishing}
                isDisabled={isLoading || isSaving || currentStep !== 4}
              >
                Publish
              </Button>
            </Can>
          </>
        )}
      </div>
    </div>
  )
}
