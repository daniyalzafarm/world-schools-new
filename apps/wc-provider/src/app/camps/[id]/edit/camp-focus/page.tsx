'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Radio, RadioGroup, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { ActivityGrid } from '../../../../../components/camp-editor/ActivityGrid'
import { CharacterCounter } from '../../../../../components/camp-editor/CharacterCounter'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { CustomActivityInput } from '../../../../../components/camp-editor/CustomActivityInput'
import {
  CAMP_PHILOSOPHY,
  LEARNING_APPROACH,
  PREDEFINED_FOCUS_AREAS,
} from '../../../../../constants/camp-focus-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface CampFocusData {
  description: string
  philosophy: string
  learningApproach: string
  selectedFocusAreas: string[]
  customFocusAreas: string[]
}

export default function CampFocusEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [focusData, setFocusData] = useState<CampFocusData>({
    description: '',
    philosophy: 'holistic',
    learningApproach: 'experiential',
    selectedFocusAreas: [],
    customFocusAreas: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (currentCamp?.campFocus) {
      setFocusData({
        description: currentCamp.campFocus.description || '',
        philosophy: (currentCamp.campFocus as any).philosophy || 'holistic',
        learningApproach: (currentCamp.campFocus as any).learningApproach || 'experiential',
        selectedFocusAreas: (currentCamp.campFocus as any).selectedFocusAreas || [],
        customFocusAreas: (currentCamp.campFocus as any).customFocusAreas || [],
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

  const toggleFocusArea = (areaId: string) => {
    const updated = {
      ...focusData,
      selectedFocusAreas: focusData.selectedFocusAreas.includes(areaId)
        ? focusData.selectedFocusAreas.filter(id => id !== areaId)
        : [...focusData.selectedFocusAreas, areaId],
    }
    setFocusData(updated)
    triggerAutoSave(updated)
  }

  const addCustomFocusArea = (areaName: string) => {
    const updated = {
      ...focusData,
      customFocusAreas: [...focusData.customFocusAreas, areaName],
    }
    setFocusData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomFocusArea = (index: number) => {
    const updated = {
      ...focusData,
      customFocusAreas: focusData.customFocusAreas.filter((_, i) => i !== index),
    }
    setFocusData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Camp Focus</h1>
          <p className="text-base leading-normal text-default-500">
            Describe the overall focus and philosophy of your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        {/* Camp Focus Description */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <label className="text-sm font-medium text-foreground">
              Camp Focus Description
            </label>
            <CharacterCounter
              current={focusData.description.length}
              max={MAX_DESCRIPTION_LENGTH}
            />
          </div>
          <Textarea
            placeholder="Describe your camp's mission, values, and educational philosophy..."
            value={focusData.description}
            onValueChange={handleDescriptionChange}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            classNames={{
              input: 'resize-none',
            }}
          />
          <p className="mt-2.5 text-sm leading-normal text-default-500">
            Include details about your camp's approach, goals, and what makes it unique
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
              wrapper: "flex flex-row flex-wrap gap-3"
            }}
          >
            {CAMP_PHILOSOPHY.map(phil => (
              <Radio
                key={phil.value}
                value={phil.value}
                classNames={{
                  base: "flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start",
                  wrapper: "group-data-[selected=true]:border-primary",
                  labelWrapper: "ml-2",
                  label: "text-sm"
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
              wrapper: "flex flex-row flex-wrap gap-3"
            }}
          >
            {LEARNING_APPROACH.map(approach => (
              <Radio
                key={approach.value}
                value={approach.value}
                classNames={{
                  base: "flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start",
                  wrapper: "group-data-[selected=true]:border-primary",
                  labelWrapper: "ml-2",
                  label: "text-sm"
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

        {/* Focus Areas */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Focus Areas</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all areas your camp focuses on
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {focusData.selectedFocusAreas.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_FOCUS_AREAS}
            selectedActivities={focusData.selectedFocusAreas}
            onToggle={toggleFocusArea}
          />

          {focusData.customFocusAreas.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {focusData.customFocusAreas.map((area, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border-2 border-primary bg-primary/5 px-3 py-2"
                >
                  <span className="text-sm font-medium">{area}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomFocusArea(index)}
                    className="text-default-500 hover:text-danger"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3">
            <CustomActivityInput
              placeholder="e.g., STEM, Leadership..."
              onAdd={addCustomFocusArea}
              buttonText="Add Focus Area"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
