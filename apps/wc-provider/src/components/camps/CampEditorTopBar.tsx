'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Button } from '@heroui/react'
import { Eye } from 'lucide-react'
import { useCampsStore } from '../../stores/camps-store'
import * as campsService from '../../services/camps.services'
import config from '../../config/config'
import { Can } from '@/components/auth/can'

interface CampEditorTopBarProps {
  campId: string
}

export function CampEditorTopBar({ campId }: CampEditorTopBarProps) {
  const router = useRouter()
  const { publishCamp, currentCamp, hasUnsavedChanges } = useCampsStore()
  const [isPublishing, setIsPublishing] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)

  const handlePublish = async () => {
    if (!campId) return

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

  const canPublish = currentCamp?.status !== 'published'

  const handleExit = () => {
    router.push('/camps')
  }

  const handlePreview = async () => {
    if (!campId || !currentCamp?.slug) return

    setIsPreviewing(true)
    const response = await campsService.generatePreviewToken(campId)
    setIsPreviewing(false)
    if (!response.success) {
      addToast({
        title: 'Error',
        description: response.data.message || 'Failed to open camp preview. Please try again.',
        color: 'danger',
      })
      return
    }
    const campUrl = `${config.app.bookingAppUrl}/camps/${currentCamp.slug}?preview=${response.data.token}`
    window.open(campUrl, '_blank')
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

        {/* Preview Button */}
        <Button
          variant="bordered"
          onPress={handlePreview}
          isDisabled={!campId || isPreviewing}
          isLoading={isPreviewing}
          startContent={!isPreviewing && <Eye className="h-4 w-4" />}
        >
          Preview
        </Button>

        {/* Publish Button - Only show if not published and user may publish */}
        {canPublish && (
          <Can permission="camps.publish">
            <Button
              color="primary"
              onPress={handlePublish}
              isDisabled={isPublishing || hasUnsavedChanges}
              isLoading={isPublishing}
            >
              Publish
            </Button>
          </Can>
        )}
      </div>
    </div>
  )
}
