'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Radio, RadioGroup, Textarea } from '@heroui/react'
import { useConfirmDialog } from '@world-schools/ui-web'
import { useCampsStore } from '../../../../../stores/camps-store'
import { CharacterCounter } from '../../../../../components/camp-editor/CharacterCounter'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { SingleSelectActivityGrid } from '../../../../../components/camp-editor/SingleSelectActivityGrid'
import { CampFocusDisplayCard } from '../../../../../components/camp-editor/CampFocusDisplayCard'
import { CAMP_PHILOSOPHY, LEARNING_APPROACH } from '../../../../../constants/camp-focus-activities'
import {
  type ActivityWithCategory,
  getActivitiesByCategory,
} from '../../../../../utils/camp-focus-activities'
import type { PrimaryFocus } from '../../../../../types/camps'

const MAX_DESCRIPTION_LENGTH = 1200

interface CampFocusData {
  primaryFocus: PrimaryFocus | null
  description: string
  philosophy: string
  learningApproach: string
}

export default function CampFocusEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()
  const { confirm } = useConfirmDialog()

  const [focusData, setFocusData] = useState<CampFocusData>({
    primaryFocus: null,
    description: '',
    philosophy: 'holistic',
    learningApproach: 'experiential',
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Get activities organized by category based on camp's programs
  const activityCategories = getActivitiesByCategory(currentCamp)

  useEffect(() => {
    if (currentCamp?.campFocus) {
      setFocusData({
        primaryFocus: (currentCamp.campFocus as any).primaryFocus || null,
        description: currentCamp.campFocus.description || '',
        philosophy: (currentCamp.campFocus as any).philosophy || 'holistic',
        learningApproach: (currentCamp.campFocus as any).learningApproach || 'experiential',
      })
    }
  }, [currentCamp])

  const triggerAutoSave = (updatedData: CampFocusData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'camp-focus', { campFocus: updatedData })
        setAutoSaveStatus('saved')
        setHasUnsavedChanges(false)
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (error) {
        console.error('Failed to save camp focus data:', error)
        setAutoSaveStatus('error')
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...focusData, description: value }
    setFocusData(updated)
    triggerAutoSave(updated)
  }

  const handlePhilosophyChange = (value: string) => {
    const updated = { ...focusData, philosophy: value }
    setFocusData(updated)
    triggerAutoSave(updated)
  }

  const handleLearningApproachChange = (value: string) => {
    const updated = { ...focusData, learningApproach: value }
    setFocusData(updated)
    triggerAutoSave(updated)
  }

  const handleActivitySelect = (activity: ActivityWithCategory) => {
    const updated = {
      ...focusData,
      primaryFocus: {
        activityId: activity.id,
        activityName: activity.name,
        categoryId: activity.categoryId,
        categoryName: activity.categoryName,
        icon: activity.icon,
      },
    }
    setFocusData(updated)
    triggerAutoSave(updated)
  }

  const handleRemoveFocus = async () => {
    if (!focusData.primaryFocus) return

    const confirmed = await confirm({
      title: 'Remove Camp Focus?',
      message: `Are you sure you want to remove ${focusData.primaryFocus.activityName} as your camp's primary focus? Your camp will no longer appear as a specialized camp in this activity.`,
      confirmText: 'Remove Focus',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (confirmed) {
      const updated = {
        ...focusData,
        primaryFocus: null,
      }
      setFocusData(updated)
      triggerAutoSave(updated)
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Camp Focus</h1>
          <p className="text-base leading-normal text-default-500">
            Does your camp specialize in a specific activity? Select your primary focus to
            differentiate your camp (e.g., "Soccer Camp" vs a camp that offers soccer). This will be
            prominently displayed in your camp profile. Not all camps need a focus - only select one
            if your camp truly specializes.
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        {/* Current Focus Display */}
        <CampFocusDisplayCard
          primaryFocus={focusData.primaryFocus}
          onRemove={handleRemoveFocus}
        />

        {/* Activity Selection by Category */}
        {activityCategories.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-default-300 bg-default-50 p-8 text-center">
            <p className="text-default-600">
              No program activities selected yet. Please select program categories in the{' '}
              <strong>Programs</strong> section first to choose a camp focus.
            </p>
          </div>
        ) : (
          activityCategories.map(category => (
            <div key={category.id} className="form-group">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{category.name}</h3>
                  <p className="text-sm text-default-500">{category.activities.length} available</p>
                </div>
              </div>
              <SingleSelectActivityGrid
                activities={category.activities}
                selectedActivityId={focusData.primaryFocus?.activityId || null}
                onSelect={handleActivitySelect}
              />
            </div>
          ))
        )}

        {/* Camp Focus Description */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <label className="text-sm font-medium text-foreground">
              Camp Focus Description (Optional)
            </label>
            <CharacterCounter current={focusData.description.length} max={MAX_DESCRIPTION_LENGTH} />
          </div>
          <Textarea
            placeholder="Describe why this activity is your camp's focus and what makes your program special..."
            value={focusData.description}
            onValueChange={handleDescriptionChange}
            minRows={4}
            maxLength={MAX_DESCRIPTION_LENGTH}
            classNames={{
              input: 'resize-none',
            }}
          />
          <p className="mt-2.5 text-sm leading-normal text-default-500">
            Explain your camp's approach to this activity and what campers will learn
          </p>
        </div>

        {/* Camp Philosophy */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Camp Philosophy</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What is the overall philosophy of your camp?
          </p>
          <RadioGroup
            value={focusData.philosophy}
            onValueChange={handlePhilosophyChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {CAMP_PHILOSOPHY.map(phil => (
              <Radio
                key={phil.value}
                value={phil.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{phil.label}</div>
                  <div className="text-xs text-default-500">{phil.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        {/* Learning Approach */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Learning Approach</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            How do campers learn and develop at your camp?
          </p>
          <RadioGroup
            value={focusData.learningApproach}
            onValueChange={handleLearningApproachChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {LEARNING_APPROACH.map(approach => (
              <Radio
                key={approach.value}
                value={approach.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{approach.label}</div>
                  <div className="text-xs text-default-500">{approach.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>
      </div>
    </div>
  )
}
