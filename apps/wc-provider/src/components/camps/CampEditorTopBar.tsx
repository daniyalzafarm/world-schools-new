'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Button } from '@heroui/react'
import { useCampsStore } from '../../stores/camps-store'

interface CampEditorTopBarProps {
  campId: string
}

export function CampEditorTopBar({ campId }: CampEditorTopBarProps) {
  const router = useRouter()
  const { publishCamp, currentCamp, isLoading, hasUnsavedChanges } = useCampsStore()
  const [isPublishing, setIsPublishing] = useState(false)

  const handleDiscard = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        router.push('/camps')
      }
    } else {
      router.push('/camps')
    }
  }

  const handlePublish = async () => {
    if (!campId) return

    setIsPublishing(true)
    try {
      await publishCamp(campId)
      addToast({
        title: 'Success',
        description: 'Camp published successfully!',
        color: 'success',
      })
      router.push('/camps')
    } catch (error) {
      console.error('Failed to publish camp:', error)
      addToast({
        title: 'Error',
        description: 'Failed to publish camp. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const canPublish = currentCamp?.status === 'draft'

  return (
    <div className="flex h-18 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/camps')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Camps
        </button>
        <span className="text-sm text-gray-400">/</span>
        <span className="text-sm font-medium text-gray-900">
          {currentCamp?.name || 'Edit Camp'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Unsaved Changes Indicator */}
        {hasUnsavedChanges && <span className="text-xs text-gray-500">Unsaved changes</span>}

        {/* Discard Button */}
        <Button variant="light" onPress={handleDiscard} isDisabled={isLoading || isPublishing}>
          Discard
        </Button>

        {/* Save Button */}
        <Button
          color="primary"
          variant="flat"
          isDisabled={!hasUnsavedChanges || isLoading || isPublishing}
          isLoading={isLoading}
        >
          Save
        </Button>

        {/* Publish Button */}
        {canPublish && (
          <Button
            color="primary"
            onPress={handlePublish}
            isDisabled={isLoading || isPublishing || hasUnsavedChanges}
            isLoading={isPublishing}
          >
            Publish
          </Button>
        )}
      </div>
    </div>
  )
}
