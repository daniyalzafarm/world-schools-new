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
  EXCURSION_FREQUENCY,
  PREDEFINED_EXCURSIONS,
  TRANSPORTATION_INCLUDED,
} from '../../../../../constants/excursions-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface ExcursionsData {
  description: string
  transportationIncluded: string
  frequency: string
  selectedExcursions: string[]
  customExcursions: string[]
}

export default function ExcursionsEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [excursionsData, setExcursionsData] = useState<ExcursionsData>({
    description: '',
    transportationIncluded: 'some',
    frequency: 'weekly',
    selectedExcursions: [],
    customExcursions: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (currentCamp?.excursionsTrips) {
      setExcursionsData({
        description: currentCamp.excursionsTrips.description || '',
        transportationIncluded:
          (currentCamp.excursionsTrips as any).transportationIncluded || 'some',
        frequency: (currentCamp.excursionsTrips as any).frequency || 'weekly',
        selectedExcursions: (currentCamp.excursionsTrips as any).selectedExcursions || [],
        customExcursions: (currentCamp.excursionsTrips as any).customExcursions || [],
      })
    }
  }, [currentCamp])

  const triggerAutoSave = (updatedData: ExcursionsData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'excursions', { excursionsTrips: updatedData })
        setAutoSaveStatus('saved')
        setHasUnsavedChanges(false)
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (error) {
        console.error('Failed to save excursions data:', error)
        setAutoSaveStatus('error')
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...excursionsData, description: value }
    setExcursionsData(updated)
    triggerAutoSave(updated)
  }

  const handleTransportationChange = (value: string) => {
    const updated = { ...excursionsData, transportationIncluded: value }
    setExcursionsData(updated)
    triggerAutoSave(updated)
  }

  const handleFrequencyChange = (value: string) => {
    const updated = { ...excursionsData, frequency: value }
    setExcursionsData(updated)
    triggerAutoSave(updated)
  }

  const toggleExcursion = (excursionId: string) => {
    const updated = {
      ...excursionsData,
      selectedExcursions: excursionsData.selectedExcursions.includes(excursionId)
        ? excursionsData.selectedExcursions.filter(id => id !== excursionId)
        : [...excursionsData.selectedExcursions, excursionId],
    }
    setExcursionsData(updated)
    triggerAutoSave(updated)
  }

  const addCustomExcursion = (excursionName: string) => {
    const updated = {
      ...excursionsData,
      customExcursions: [...excursionsData.customExcursions, excursionName],
    }
    setExcursionsData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomExcursion = (index: number) => {
    const updated = {
      ...excursionsData,
      customExcursions: excursionsData.customExcursions.filter((_, i) => i !== index),
    }
    setExcursionsData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Excursions & Trips</h1>
          <p className="text-base leading-normal text-default-500">
            Describe the excursions and trips included in your camp program
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <label className="text-sm font-medium text-foreground">
              Excursions Description
            </label>
            <CharacterCounter
              current={excursionsData.description.length}
              max={MAX_DESCRIPTION_LENGTH}
            />
          </div>
          <Textarea
            placeholder="Describe your excursions program, destinations, and activities..."
            value={excursionsData.description}
            onValueChange={handleDescriptionChange}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            classNames={{
              input: 'resize-none',
            }}
          />
          <p className="mt-2.5 text-sm leading-normal text-default-500">
            Include details about destinations, what's included, and supervision
          </p>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Transportation Included
            </label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            Is transportation to excursions included in the camp fee?
          </p>
          <RadioGroup
            value={excursionsData.transportationIncluded}
            onValueChange={handleTransportationChange}
            classNames={{
              wrapper: "flex flex-row flex-wrap gap-3"
            }}
          >
            {TRANSPORTATION_INCLUDED.map(option => (
              <Radio
                key={option.value}
                value={option.value}
                classNames={{
                  base: "flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start",
                  wrapper: "group-data-[selected=true]:border-primary",
                  labelWrapper: "ml-2",
                  label: "text-sm"
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{option.label}</div>
                  <div className="text-xs text-default-500">{option.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Excursion Frequency</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">How often do excursions take place?</p>
          <RadioGroup
            value={excursionsData.frequency}
            onValueChange={handleFrequencyChange}
            classNames={{
              wrapper: "flex flex-row flex-wrap gap-3"
            }}
          >
            {EXCURSION_FREQUENCY.map(freq => (
              <Radio
                key={freq.value}
                value={freq.value}
                classNames={{
                  base: "flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start",
                  wrapper: "group-data-[selected=true]:border-primary",
                  labelWrapper: "ml-2",
                  label: "text-sm"
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{freq.label}</div>
                  <div className="text-xs text-default-500">{freq.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                Types of Excursions
              </label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all types of excursions offered at your camp
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {excursionsData.selectedExcursions.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_EXCURSIONS}
            selectedActivities={excursionsData.selectedExcursions}
            onToggle={toggleExcursion}
          />

          {excursionsData.customExcursions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {excursionsData.customExcursions.map((excursion, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border-2 border-primary bg-primary/5 px-3 py-2"
                >
                  <span className="text-sm font-medium">{excursion}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomExcursion(index)}
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
              placeholder="e.g., Vineyard Tour, Cooking Class..."
              onAdd={addCustomExcursion}
              buttonText="Add Excursion"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
