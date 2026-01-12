'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { useCampsStore } from '../../stores/camps-store'

interface CampEditorFooterProps {
  campId: string
}

const editorSections = [
  'basic-info',
  'photos',
  'whats-included',
  'daily-schedule',
  'meals',
  'sports',
  'languages',
  'arts',
  'adventure',
  'water',
  'environmental',
  'academics',
  'religion',
  'excursions',
  'location-campus',
  'accommodation',
  'getting-there',
  'camp-focus',
]

export function CampEditorFooter({ campId }: CampEditorFooterProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { hasUnsavedChanges, isLoading } = useCampsStore()

  // Get current section from pathname
  const currentSection = editorSections.find(section => pathname.includes(section))
  const currentIndex = currentSection ? editorSections.indexOf(currentSection) : -1

  const hasNext = currentIndex >= 0 && currentIndex < editorSections.length - 1
  const nextSection = hasNext ? editorSections[currentIndex + 1] : null

  const handleSaveAndNext = async () => {
    if (!nextSection) return

    // TODO: Trigger save of current section
    // For now, just navigate
    router.push(`/camps/${campId}/edit/${nextSection}`)
  }

  // Only show footer if there are unsaved changes
  if (!hasUnsavedChanges) {
    return null
  }

  return (
    <div
      className="fixed bottom-0 right-0 z-30 flex h-20 items-center justify-end border-t border-gray-200 bg-white px-6 shadow-lg"
      style={{ width: 'calc(100% - 280px)' }}
    >
      <div className="flex items-center gap-3">
        {hasNext && (
          <Button
            color="primary"
            onPress={handleSaveAndNext}
            isDisabled={isLoading}
            isLoading={isLoading}
          >
            Save & Next
          </Button>
        )}
        {!hasNext && (
          <Button color="primary" isDisabled={isLoading} isLoading={isLoading}>
            Save
          </Button>
        )}
      </div>
    </div>
  )
}
