'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Radio, RadioGroup } from '@heroui/react'
import { Textarea } from '@world-schools/ui-web'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useAutosave } from '../../../../../hooks/useAutosave'
import { ActivityGrid } from '../../../../../components/camp-editor/ActivityGrid'
import { CustomActivityInput } from '../../../../../components/camp-editor/CustomActivityInput'
import {
  EXCURSION_FREQUENCY,
  PREDEFINED_EXCURSIONS,
  TRANSPORTATION_INCLUDED,
} from '../../../../../constants/excursions-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface ExcursionsData {
  description: string
  transportIncluded: string
  frequency: string
  selectedTrips: string[]
  customTrips: string[]
}

export default function ExcursionsEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection } = useCampsStore()

  const [excursionsData, setExcursionsData] = useState<ExcursionsData>({
    description: '',
    transportIncluded: 'some',
    frequency: 'weekly',
    selectedTrips: [],
    customTrips: [],
  })
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (currentCamp?.excursionsTrips) {
      setExcursionsData({
        description: currentCamp.excursionsTrips.description || '',
        transportIncluded: (currentCamp.excursionsTrips as any).transportIncluded || 'some',
        frequency: (currentCamp.excursionsTrips as any).frequency || 'weekly',
        selectedTrips: (currentCamp.excursionsTrips as any).selectedTrips || [],
        customTrips: (currentCamp.excursionsTrips as any).customTrips || [],
      })
      setIsLoaded(true)
    } else if (currentCamp) {
      setIsLoaded(true)
    }
  }, [currentCamp])

  useAutosave(excursionsData, {
    enabled: isLoaded,
    save: async data => {
      await updateSection(campId, 'excursions', { excursionsTrips: data })
    },
  })

  const handleDescriptionChange = (value: string) => {
    const updated = { ...excursionsData, description: value }
    setExcursionsData(updated)
  }

  const handleTransportationChange = (value: string) => {
    const updated = { ...excursionsData, transportIncluded: value }
    setExcursionsData(updated)
  }

  const handleFrequencyChange = (value: string) => {
    const updated = { ...excursionsData, frequency: value }
    setExcursionsData(updated)
  }

  const toggleExcursion = (excursionId: string) => {
    const updated = {
      ...excursionsData,
      selectedTrips: excursionsData.selectedTrips.includes(excursionId)
        ? excursionsData.selectedTrips.filter(id => id !== excursionId)
        : [...excursionsData.selectedTrips, excursionId],
    }
    setExcursionsData(updated)
  }

  const addCustomExcursion = (excursionName: string) => {
    const updated = {
      ...excursionsData,
      customTrips: [...excursionsData.customTrips, excursionName],
    }
    setExcursionsData(updated)
  }

  const removeCustomExcursion = (index: number) => {
    const updated = {
      ...excursionsData,
      customTrips: excursionsData.customTrips.filter((_, i) => i !== index),
    }
    setExcursionsData(updated)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Excursions & Trips</h1>
        <p className="text-base leading-normal text-default-500">
          Describe the excursions and trips included in your camp program
        </p>
      </div>

      <div className="space-y-8">
        <div className="form-group">
          <Textarea
            label="Excursions Description"
            placeholder="Describe your excursions program, destinations, and activities..."
            value={excursionsData.description}
            onChange={e => handleDescriptionChange(e.target.value)}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            showCharacterCount
            description="Include details about destinations, what's included, and supervision"
          />
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Transportation Included</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            Is transportation to excursions included in the camp fee?
          </p>
          <RadioGroup
            value={excursionsData.transportIncluded}
            onValueChange={handleTransportationChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {TRANSPORTATION_INCLUDED.map(option => (
              <Radio
                key={option.value}
                value={option.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
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
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            How often do excursions take place?
          </p>
          <RadioGroup
            value={excursionsData.frequency}
            onValueChange={handleFrequencyChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {EXCURSION_FREQUENCY.map(freq => (
              <Radio
                key={freq.value}
                value={freq.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
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
              <label className="text-sm font-medium text-foreground">Types of Excursions</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all types of excursions offered at your camp
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {excursionsData.selectedTrips.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_EXCURSIONS}
            selectedActivities={excursionsData.selectedTrips}
            onToggle={toggleExcursion}
          />

          {excursionsData.customTrips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {excursionsData.customTrips.map((excursion, index) => (
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
