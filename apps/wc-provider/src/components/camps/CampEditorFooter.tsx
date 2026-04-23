'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { useCampsStore } from '../../stores/camps-store'
import { AutoSaveIndicator } from '../camp-editor/AutoSaveIndicator'

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

const navigationOnlySections = ['sessions']

export function CampEditorFooter({ campId }: CampEditorFooterProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { autoSaveStatus, currentCamp } = useCampsStore()
  const [waitingButton, setWaitingButton] = useState<'previous' | 'next' | null>(null)

  const shouldShowSection = (section: string) => {
    if (section === 'accommodation' || section === 'getting-there') {
      if (currentCamp?.type !== 'residential') return false
    }

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

  const filteredSections = editorSections.filter(shouldShowSection)
  const currentSection = filteredSections.find(section => pathname.includes(section))
  const currentIndex = currentSection ? filteredSections.indexOf(currentSection) : -1

  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < filteredSections.length - 1
  const previousSection = hasPrevious ? filteredSections[currentIndex - 1] : null
  const nextSection = hasNext ? filteredSections[currentIndex + 1] : null
  const isNavigationOnly = currentSection ? navigationOnlySections.includes(currentSection) : false

  const waitForPendingSave = (): Promise<void> =>
    new Promise(resolve => {
      if (!useCampsStore.getState().hasPendingAutoSave) {
        resolve()
        return
      }
      const interval = setInterval(() => {
        if (!useCampsStore.getState().hasPendingAutoSave) {
          clearInterval(interval)
          resolve()
        }
      }, 100)
      setTimeout(() => {
        clearInterval(interval)
        resolve()
      }, 10000)
    })

  const flushAndNavigate = async (target: string, button: 'previous' | 'next') => {
    const flush = useCampsStore.getState().autoSaveFlush
    const hasWork = !!flush || useCampsStore.getState().hasPendingAutoSave
    if (hasWork) {
      setWaitingButton(button)
      try {
        if (flush) await flush()
        await waitForPendingSave()
      } finally {
        setWaitingButton(null)
      }
    }
    router.push(`/camps/${campId}/edit/${target}`)
  }

  const handlePrevious = () => {
    if (!previousSection) return
    void flushAndNavigate(previousSection, 'previous')
  }

  const handleNext = () => {
    if (!nextSection) return
    void flushAndNavigate(nextSection, 'next')
  }

  const isWaiting = waitingButton !== null

  return (
    <div className="border-t border-default-100 bg-white px-12 py-4">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-12">
        <div className="flex-1">
          <Button
            variant="bordered"
            onPress={handlePrevious}
            isDisabled={!hasPrevious || isWaiting}
            isLoading={waitingButton === 'previous'}
          >
            Back
          </Button>
        </div>

        <div className="flex flex-1 justify-center">
          {!isNavigationOnly && <AutoSaveIndicator status={autoSaveStatus} />}
        </div>

        <div className="flex flex-1 justify-end">
          <Button
            color="secondary"
            onPress={handleNext}
            isDisabled={!hasNext || isWaiting}
            isLoading={waitingButton === 'next'}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
