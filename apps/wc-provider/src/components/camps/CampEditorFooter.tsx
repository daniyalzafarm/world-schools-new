'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { useConfirmDialog } from '@world-schools/ui-web'
import { useCampsStore } from '../../stores/camps-store'

interface CampEditorFooterProps {
  campId: string
}

const editorSections = [
  'basic-info',
  'audience',
  'programs',
  'photos',
  'whats-included',
  'addons',
  'camp-focus',
  'sports',
  'languages',
  'arts',
  'adventure',
  'water',
  'environmental',
  'academics',
  'religion',
  'excursions',
  'accommodation',
  'meals',
  'daily-schedule',
  'location-campus',
  'getting-there',
]

export function CampEditorFooter({ campId }: CampEditorFooterProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { hasUnsavedChanges, isLoading, wizardFormValid, wizardFormSubmit } = useCampsStore()
  const { confirm } = useConfirmDialog()

  // Get current section from pathname
  const currentSection = editorSections.find(section => pathname.includes(section))
  const currentIndex = currentSection ? editorSections.indexOf(currentSection) : -1

  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < editorSections.length - 1
  const previousSection = hasPrevious ? editorSections[currentIndex - 1] : null
  const nextSection = hasNext ? editorSections[currentIndex + 1] : null

  const handlePrevious = () => {
    if (previousSection) {
      router.push(`/camps/${campId}/edit/${previousSection}`)
    }
  }

  const handleNext = async () => {
    if (!nextSection) return

    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      // Show confirmation dialog
      const shouldSave = await confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. What would you like to do?',
        confirmText: 'Save & Continue',
        cancelText: 'Continue without Saving',
        variant: 'warning',
      })

      if (shouldSave) {
        // User chose "Save & Continue"
        try {
          if (wizardFormSubmit) {
            await wizardFormSubmit()
          }
          router.push(`/camps/${campId}/edit/${nextSection}`)
        } catch (error) {
          console.error('Failed to save:', error)
          // Don't navigate if save failed
        }
      } else {
        // User chose "Continue without Saving"
        router.push(`/camps/${campId}/edit/${nextSection}`)
      }
    } else {
      // No unsaved changes, navigate directly
      router.push(`/camps/${campId}/edit/${nextSection}`)
    }
  }

  const handleSaveAndNext = async () => {
    if (!nextSection) return

    // Trigger save if there's a submit handler
    if (wizardFormSubmit) {
      try {
        await wizardFormSubmit()
        // Navigate to next section after successful save
        router.push(`/camps/${campId}/edit/${nextSection}`)
      } catch (error) {
        console.error('Failed to save:', error)
      }
    } else {
      // No submit handler, just navigate
      router.push(`/camps/${campId}/edit/${nextSection}`)
    }
  }

  const handleSave = async () => {
    // Trigger save if there's a submit handler
    if (wizardFormSubmit) {
      try {
        await wizardFormSubmit()
      } catch (error) {
        console.error('Failed to save:', error)
      }
    }
  }

  // Determine if save button should be disabled
  const isSaveDisabled = !hasUnsavedChanges || !wizardFormValid || isLoading

  return (
    <div className="border-t border-default-100 bg-white px-12 py-4">
      <div className="flex items-center justify-between">
        {/* Section Navigation Buttons */}
        <div className="flex items-center gap-3">
          <Button variant="bordered" onPress={handlePrevious} isDisabled={!hasPrevious}>
            Back
          </Button>
          <Button color="secondary" onPress={handleNext} isDisabled={!hasNext}>
            Next
          </Button>
        </div>

        {/* Save Action Buttons - Always visible */}
        <div className="flex items-center gap-3">
          {hasNext ? (
            <Button
              color="primary"
              size="lg"
              onPress={handleSaveAndNext}
              isDisabled={isSaveDisabled}
              isLoading={isLoading}
            >
              Save & Continue →
            </Button>
          ) : (
            <Button
              color="primary"
              size="lg"
              onPress={handleSave}
              isDisabled={isSaveDisabled}
              isLoading={isLoading}
            >
              Save Changes
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
