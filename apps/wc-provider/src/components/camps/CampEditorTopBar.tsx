'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Button } from '@heroui/react'
import { Eye } from 'lucide-react'
import { useCampsStore } from '../../stores/camps-store'
import * as campsService from '../../services/camps.services'
import config from '../../config/config'

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

  const handlePreview = async () => {
    if (!campId || !currentCamp?.slug) return

    setIsPreviewing(true)
    try {
      // Generate a preview token for the camp
      const token = await campsService.generatePreviewToken(campId)

      // Redirect to the booking app's camp page with preview token
      const bookingAppUrl = config.app.bookingAppUrl
      const campUrl = `${bookingAppUrl}/camps/${currentCamp.slug}?preview=${token}`
      window.open(campUrl, '_blank')
    } catch (error) {
      console.error('Failed to generate preview token:', error)
      addToast({
        title: 'Error',
        description: 'Failed to open camp preview. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsPreviewing(false)
    }
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
