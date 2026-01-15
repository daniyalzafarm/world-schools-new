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
  const { publishCamp, currentCamp, hasUnsavedChanges } = useCampsStore()
  const [isPublishing, setIsPublishing] = useState(false)

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

  const canPublish = currentCamp?.status !== 'published'

  const handleExit = () => {
    router.push('/camps')
  }

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
        {/* Exit Button */}
        <Button color="danger" variant="flat" onPress={handleExit}>
          Exit
        </Button>

        {/* Publish Button - Only show if not published */}
        {canPublish && (
          <Button
            color="primary"
            onPress={handlePublish}
            isDisabled={isPublishing || hasUnsavedChanges}
            isLoading={isPublishing}
          >
            Publish
          </Button>
        )}
      </div>
    </div>
  )
}
