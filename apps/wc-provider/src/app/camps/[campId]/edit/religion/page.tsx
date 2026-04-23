'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Radio, RadioGroup } from '@heroui/react'
import { Textarea } from '@world-schools/ui-web'
import { useCampsStore } from '../../../../../stores/camps-store'
import { ActivityGrid } from '../../../../../components/camp-editor/ActivityGrid'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { CustomActivityInput } from '../../../../../components/camp-editor/CustomActivityInput'
import {
  DENOMINATIONS,
  PREDEFINED_RELIGION,
  RELIGIOUS_OBSERVANCE,
} from '../../../../../constants/religion-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface ReligionData {
  description: string
  denomination: string
  observance: string
  selectedPrograms: string[]
  customPrograms: string[]
}

export default function ReligionEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [religionData, setReligionData] = useState<ReligionData>({
    description: '',
    denomination: 'secular',
    observance: 'optional',
    selectedPrograms: [],
    customPrograms: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (currentCamp?.religionPrograms) {
      setReligionData({
        description: currentCamp.religionPrograms.description || '',
        denomination: (currentCamp.religionPrograms as any).denomination || 'secular',
        observance: (currentCamp.religionPrograms as any).observance || 'optional',
        selectedPrograms: (currentCamp.religionPrograms as any).selectedPrograms || [],
        customPrograms: (currentCamp.religionPrograms as any).customPrograms || [],
      })
    }
  }, [currentCamp])

  // Cleanup on unmount - clear pending auto-save state
  useEffect(() => {
    return () => {
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  const triggerAutoSave = (updatedData: ReligionData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    // Update store to indicate pending auto-save (debounce period)
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      await updateSection(campId, 'religion', { religionPrograms: updatedData })
      if (useCampsStore.getState().error) {
        setAutoSaveStatus('error')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
        return
      }
      setAutoSaveStatus('saved')
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })
      setHasUnsavedChanges(false)
      setTimeout(() => {
        setAutoSaveStatus('idle')
        useCampsStore.setState({ autoSaveStatus: 'idle' })
      }, 2000)
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...religionData, description: value }
    setReligionData(updated)
    triggerAutoSave(updated)
  }

  const handleDenominationChange = (value: string) => {
    const updated = { ...religionData, denomination: value }
    setReligionData(updated)
    triggerAutoSave(updated)
  }

  const handleObservanceChange = (value: string) => {
    const updated = { ...religionData, observance: value }
    setReligionData(updated)
    triggerAutoSave(updated)
  }

  const toggleActivity = (activityId: string) => {
    const updated = {
      ...religionData,
      selectedPrograms: religionData.selectedPrograms.includes(activityId)
        ? religionData.selectedPrograms.filter(id => id !== activityId)
        : [...religionData.selectedPrograms, activityId],
    }
    setReligionData(updated)
    triggerAutoSave(updated)
  }

  const addCustomActivity = (activityName: string) => {
    const updated = {
      ...religionData,
      customPrograms: [...religionData.customPrograms, activityName],
    }
    setReligionData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomActivity = (index: number) => {
    const updated = {
      ...religionData,
      customPrograms: religionData.customPrograms.filter((_, i) => i !== index),
    }
    setReligionData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Religious Programs</h1>
          <p className="text-base leading-normal text-default-500">
            Describe any religious or spiritual programs at your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        <div className="form-group">
          <Textarea
            label="Religious Program Description"
            placeholder="Describe your religious or spiritual programs (if applicable)..."
            value={religionData.description}
            onChange={e => handleDescriptionChange(e.target.value)}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            showCharacterCount
            description="Include details about religious observances, spiritual development, or interfaith activities"
          />
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Religious Affiliation</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What is the religious affiliation of your camp?
          </p>
          <RadioGroup
            value={religionData.denomination}
            onValueChange={handleDenominationChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {DENOMINATIONS.map(denom => (
              <Radio
                key={denom.value}
                value={denom.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{denom.label}</div>
                  <div className="text-xs text-default-500">{denom.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Religious Observance</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            How are religious activities incorporated into camp life?
          </p>
          <RadioGroup
            value={religionData.observance}
            onValueChange={handleObservanceChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {RELIGIOUS_OBSERVANCE.map(obs => (
              <Radio
                key={obs.value}
                value={obs.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{obs.label}</div>
                  <div className="text-xs text-default-500">{obs.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                Religious Activities Offered
              </label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all religious activities available at your camp
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {religionData.selectedPrograms.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_RELIGION}
            selectedActivities={religionData.selectedPrograms}
            onToggle={toggleActivity}
          />

          {religionData.customPrograms.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {religionData.customPrograms.map((activity, index) => (
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
              placeholder="e.g., Yoga, Mindfulness..."
              onAdd={addCustomActivity}
              buttonText="Add Activity"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
