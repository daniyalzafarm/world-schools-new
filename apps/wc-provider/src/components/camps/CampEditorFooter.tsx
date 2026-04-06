'use client'

import { useState } from 'react'
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
  'photos',
  'camp-focus',
  'programs',
  'sports',
  'languages',
  'arts',
  'adventure',
  'water',
  'environmental',
  'academics',
  'religion',
  'excursions',
  'sessions',
  'whats-included',
  'addons',
  'skill-requirements',
  'accommodation',
  'meals',
  'daily-schedule',
  'safety-policies',
  'location-campus',
  'getting-there',
]

// Sections that use auto-save only (no manual save button)
const autoSaveOnlySections = [
  'whats-included',
  'addons',
  'camp-focus',
  'skill-requirements',
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
  'safety-policies',
  'location-campus',
  'getting-there',
]

// Sections that are navigation/listing pages only (no save functionality at all)
const navigationOnlySections = ['sessions']

// Sections that show only "Save Changes" button (no "Save & Continue")
const saveOnlySections = ['daily-schedule']

export function CampEditorFooter({ campId }: CampEditorFooterProps) {
  const pathname = usePathname()
  const router = useRouter()
  const {
    hasUnsavedChanges,
    isLoading,
    wizardFormValid,
    wizardFormSubmit,
    hasPendingAutoSave,
    autoSaveStatus,
    currentCamp,
  } = useCampsStore()
  const { confirm } = useConfirmDialog()
  const [waitingButton, setWaitingButton] = useState<'previous' | 'next' | null>(null)

  // Filter sections based on camp configuration (same logic as sidebar)
  const shouldShowSection = (section: string) => {
    // Filter residential-only sections
    if (section === 'accommodation' || section === 'getting-there') {
      if (currentCamp?.type !== 'residential') return false
    }

    // Filter activity sections based on selected activities
    const activitySections: Record<string, string> = {
      sports: 'sports',
      languages: 'languages',
      arts: 'arts',
      adventure: 'adventure',
      water: 'water',
      environmental: 'environment',
      academics: 'academics',
      religion: 'religion',
      excursions: 'excursions',
    }

    if (activitySections[section]) {
      const selectedActivities = currentCamp?.activities ?? []
      return selectedActivities.includes(activitySections[section])
    }

    return true
  }

  // Get filtered sections
  const filteredSections = editorSections.filter(shouldShowSection)

  // Get current section from pathname
  const currentSection = filteredSections.find(section => pathname.includes(section))
  const currentIndex = currentSection ? filteredSections.indexOf(currentSection) : -1

  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < filteredSections.length - 1
  const previousSection = hasPrevious ? filteredSections[currentIndex - 1] : null
  const nextSection = hasNext ? filteredSections[currentIndex + 1] : null

  // Check if current section uses auto-save only
  const isAutoSaveOnly = currentSection ? autoSaveOnlySections.includes(currentSection) : false

  // Check if current section is navigation-only (no save functionality)
  const isNavigationOnly = currentSection ? navigationOnlySections.includes(currentSection) : false

  // Check if current section shows only "Save Changes" button (no "Save & Continue")
  const isSaveOnly = currentSection ? saveOnlySections.includes(currentSection) : false

  // Helper to wait for auto-save completion
  const waitForAutoSave = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      // If no pending auto-save, resolve immediately
      if (!hasPendingAutoSave && autoSaveStatus !== 'saving') {
        resolve()
        return
      }

      // Set up a polling interval to check auto-save status
      const checkInterval = setInterval(() => {
        const currentStatus = useCampsStore.getState().autoSaveStatus
        const currentPending = useCampsStore.getState().hasPendingAutoSave

        if (!currentPending && currentStatus !== 'saving') {
          clearInterval(checkInterval)

          // Check if save was successful
          if (currentStatus === 'error') {
            reject(new Error('Auto-save failed'))
          } else {
            resolve()
          }
        }
      }, 100) // Check every 100ms

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('Auto-save timeout'))
      }, 10000)
    })
  }

  const handlePrevious = async () => {
    if (!previousSection) return

    // For auto-save only sections, wait for pending auto-save
    if (isAutoSaveOnly && (hasPendingAutoSave || autoSaveStatus === 'saving')) {
      setWaitingButton('previous')
      try {
        await waitForAutoSave()
        router.push(`/camps/${campId}/edit/${previousSection}`)
      } catch (error) {
        console.error('Failed to complete auto-save before navigation:', error)
        // Still navigate even if auto-save failed (user can see error indicator)
        router.push(`/camps/${campId}/edit/${previousSection}`)
      } finally {
        setWaitingButton(null)
      }
    } else {
      router.push(`/camps/${campId}/edit/${previousSection}`)
    }
  }

  const handleNext = async () => {
    if (!nextSection) return

    // For auto-save only sections, wait for pending auto-save
    if (isAutoSaveOnly && (hasPendingAutoSave || autoSaveStatus === 'saving')) {
      setWaitingButton('next')
      try {
        await waitForAutoSave()
        router.push(`/camps/${campId}/edit/${nextSection}`)
      } catch (error) {
        console.error('Failed to complete auto-save before navigation:', error)
        // Still navigate even if auto-save failed (user can see error indicator)
        router.push(`/camps/${campId}/edit/${nextSection}`)
      } finally {
        setWaitingButton(null)
      }
      return
    }

    // For non-auto-save sections, check if there are unsaved changes
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

  // Check if we're waiting for auto-save
  const isWaitingForAutoSave = waitingButton !== null

  return (
    <div className="border-t border-default-100 bg-white px-12 py-4">
      <div className="mx-auto max-w-4xl px-12 flex items-center justify-between">
        {/* Section Navigation Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="bordered"
            onPress={handlePrevious}
            isDisabled={!hasPrevious || isWaitingForAutoSave}
            isLoading={waitingButton === 'previous'}
          >
            Back
          </Button>
          <Button
            color="secondary"
            onPress={handleNext}
            isDisabled={!hasNext || isWaitingForAutoSave}
            isLoading={waitingButton === 'next'}
          >
            Next
          </Button>
        </div>

        {/* Save Action Buttons or Auto-Save Message */}
        <div className="flex items-center gap-3">
          {isNavigationOnly ? (
            // For navigation-only sections (like sessions list), show nothing
            // These pages don't have any save functionality
            <div />
          ) : isAutoSaveOnly ? (
            // For auto-save only sections, show a message instead of save button
            <div className="flex items-center gap-2 text-sm text-default-500">
              <div className="h-2 w-2 animate-pulse rounded-full bg-success-500" />
              {isWaitingForAutoSave ? 'Saving changes...' : 'Changes are saved automatically'}
            </div>
          ) : isSaveOnly ? (
            // For save-only sections, always show "Save Changes" button (no "Save & Continue")
            <Button
              color="primary"
              size="lg"
              onPress={handleSave}
              isDisabled={isSaveDisabled}
              isLoading={isLoading}
            >
              Save Changes
            </Button>
          ) : (
            // For other sections, show save buttons based on navigation
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
