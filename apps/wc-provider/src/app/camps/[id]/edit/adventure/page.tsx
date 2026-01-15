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
  DIFFICULTY_LEVELS,
  PREDEFINED_ADVENTURE,
  SAFETY_CERTIFICATIONS,
  SUPERVISION_RATIOS,
} from '../../../../../constants/adventure-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface AdventureData {
  description: string
  difficultyLevel: string
  supervisionRatio: string
  selectedActivities: string[]
  customActivities: string[]
  certifications: string[]
}

export default function AdventureEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [adventureData, setAdventureData] = useState<AdventureData>({
    description: '',
    difficultyLevel: 'mixed',
    supervisionRatio: '1:8',
    selectedActivities: [],
    customActivities: [],
    certifications: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (currentCamp?.adventureActivities) {
      setAdventureData({
        description: currentCamp.adventureActivities.description || '',
        difficultyLevel: (currentCamp.adventureActivities as any).difficultyLevel || 'mixed',
        supervisionRatio: (currentCamp.adventureActivities as any).supervisionRatio || '1:8',
        selectedActivities: (currentCamp.adventureActivities as any).selectedActivities || [],
        customActivities: (currentCamp.adventureActivities as any).customActivities || [],
        certifications: (currentCamp.adventureActivities as any).certifications || [],
      })
    }
  }, [currentCamp])

  // Cleanup on unmount - clear pending auto-save state
  useEffect(() => {
    return () => {
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  const triggerAutoSave = (updatedData: AdventureData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    // Update store to indicate pending auto-save (debounce period)
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'adventure', { adventureActivities: updatedData })
        setAutoSaveStatus('saved')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })
        setHasUnsavedChanges(false)
        setTimeout(() => {
          setAutoSaveStatus('idle')
          useCampsStore.setState({ autoSaveStatus: 'idle' })
        }, 2000)
      } catch (error) {
        console.error('Failed to save adventure data:', error)
        setAutoSaveStatus('error')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...adventureData, description: value }
    setAdventureData(updated)
    triggerAutoSave(updated)
  }

  const handleDifficultyLevelChange = (value: string) => {
    const updated = { ...adventureData, difficultyLevel: value }
    setAdventureData(updated)
    triggerAutoSave(updated)
  }

  const handleSupervisionRatioChange = (value: string) => {
    const updated = { ...adventureData, supervisionRatio: value }
    setAdventureData(updated)
    triggerAutoSave(updated)
  }

  const toggleActivity = (activityId: string) => {
    const updated = {
      ...adventureData,
      selectedActivities: adventureData.selectedActivities.includes(activityId)
        ? adventureData.selectedActivities.filter(id => id !== activityId)
        : [...adventureData.selectedActivities, activityId],
    }
    setAdventureData(updated)
    triggerAutoSave(updated)
  }

  const addCustomActivity = (activityName: string) => {
    const updated = {
      ...adventureData,
      customActivities: [...adventureData.customActivities, activityName],
    }
    setAdventureData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomActivity = (index: number) => {
    const updated = {
      ...adventureData,
      customActivities: adventureData.customActivities.filter((_, i) => i !== index),
    }
    setAdventureData(updated)
    triggerAutoSave(updated)
  }

  const toggleCertification = (certId: string) => {
    const updated = {
      ...adventureData,
      certifications: adventureData.certifications.includes(certId)
        ? adventureData.certifications.filter(id => id !== certId)
        : [...adventureData.certifications, certId],
    }
    setAdventureData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Adventure Activities</h1>
          <p className="text-base leading-normal text-default-500">
            Describe the adventure and outdoor activities at your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        {/* Description */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <label className="text-sm font-medium text-foreground">
              Adventure Program Description
            </label>
            <CharacterCounter
              current={adventureData.description.length}
              max={MAX_DESCRIPTION_LENGTH}
            />
          </div>
          <Textarea
            placeholder="Describe your adventure program, safety protocols, and what makes it exciting..."
            value={adventureData.description}
            onValueChange={handleDescriptionChange}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            classNames={{
              input: 'resize-none',
            }}
          />
          <p className="mt-2.5 text-sm leading-normal text-default-500">
            Include details about safety equipment, instructor qualifications, and risk management
          </p>
        </div>

        {/* Difficulty Level */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Difficulty Level</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What difficulty levels are your adventure activities suitable for?
          </p>
          <RadioGroup
            value={adventureData.difficultyLevel}
            onValueChange={handleDifficultyLevelChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {DIFFICULTY_LEVELS.map(level => (
              <Radio
                key={level.value}
                value={level.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{level.label}</div>
                  <div className="text-xs text-default-500">{level.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        {/* Supervision Ratio */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Supervision Ratio</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What is your staff-to-camper ratio for adventure activities?
          </p>
          <RadioGroup
            value={adventureData.supervisionRatio}
            onValueChange={handleSupervisionRatioChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {SUPERVISION_RATIOS.map(ratio => (
              <Radio
                key={ratio.value}
                value={ratio.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{ratio.label}</div>
                  <div className="text-xs text-default-500">{ratio.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        {/* Activities */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                Adventure Activities Offered
              </label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all adventure activities available at your camp
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {adventureData.selectedActivities.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_ADVENTURE}
            selectedActivities={adventureData.selectedActivities}
            onToggle={toggleActivity}
          />

          {adventureData.customActivities.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {adventureData.customActivities.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border-2 border-primary bg-primary/5 px-3 py-2"
                >
                  <span className="text-sm font-medium">{activity}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomActivity(index)}
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
              placeholder="e.g., Caving, Paragliding..."
              onAdd={addCustomActivity}
              buttonText="Add Activity"
            />
          </div>
        </div>

        {/* Safety Certifications */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Safety Certifications</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select the safety certifications your staff holds
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {adventureData.certifications.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={SAFETY_CERTIFICATIONS}
            selectedActivities={adventureData.certifications}
            onToggle={toggleCertification}
          />
        </div>
      </div>
    </div>
  )
}
