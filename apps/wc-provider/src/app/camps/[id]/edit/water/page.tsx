'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Checkbox, CheckboxGroup, Radio, RadioGroup, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { ActivityGrid } from '../../../../../components/camp-editor/ActivityGrid'
import { CharacterCounter } from '../../../../../components/camp-editor/CharacterCounter'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { CustomActivityInput } from '../../../../../components/camp-editor/CustomActivityInput'
import {
  LIFEGUARD_CERTIFICATIONS,
  PREDEFINED_WATER_ACTIVITIES,
  SWIM_LEVELS,
  WATER_FACILITIES,
} from '../../../../../constants/water-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface WaterData {
  description: string
  swimLevel: string
  selectedActivities: string[]
  customActivities: string[]
  facilities: string[]
  lifeguardCerts: string[]
}

export default function WaterEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [waterData, setWaterData] = useState<WaterData>({
    description: '',
    swimLevel: 'all',
    selectedActivities: [],
    customActivities: [],
    facilities: [],
    lifeguardCerts: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (currentCamp?.waterActivities) {
      setWaterData({
        description: currentCamp.waterActivities.description || '',
        swimLevel: (currentCamp.waterActivities as any).swimLevel || 'all',
        selectedActivities: (currentCamp.waterActivities as any).selectedActivities || [],
        customActivities: (currentCamp.waterActivities as any).customActivities || [],
        facilities: (currentCamp.waterActivities as any).facilities || [],
        lifeguardCerts: (currentCamp.waterActivities as any).lifeguardCerts || [],
      })
    }
  }, [currentCamp])

  const triggerAutoSave = (updatedData: WaterData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'water', { waterActivities: updatedData })
        setAutoSaveStatus('saved')
        setHasUnsavedChanges(false)
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (error) {
        console.error('Failed to save water data:', error)
        setAutoSaveStatus('error')
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...waterData, description: value }
    setWaterData(updated)
    triggerAutoSave(updated)
  }

  const handleSwimLevelChange = (value: string) => {
    const updated = { ...waterData, swimLevel: value }
    setWaterData(updated)
    triggerAutoSave(updated)
  }

  const toggleActivity = (activityId: string) => {
    const updated = {
      ...waterData,
      selectedActivities: waterData.selectedActivities.includes(activityId)
        ? waterData.selectedActivities.filter(id => id !== activityId)
        : [...waterData.selectedActivities, activityId],
    }
    setWaterData(updated)
    triggerAutoSave(updated)
  }

  const addCustomActivity = (activityName: string) => {
    const updated = {
      ...waterData,
      customActivities: [...waterData.customActivities, activityName],
    }
    setWaterData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomActivity = (index: number) => {
    const updated = {
      ...waterData,
      customActivities: waterData.customActivities.filter((_, i) => i !== index),
    }
    setWaterData(updated)
    triggerAutoSave(updated)
  }

  const toggleFacility = (facilityId: string) => {
    const updated = {
      ...waterData,
      facilities: waterData.facilities.includes(facilityId)
        ? waterData.facilities.filter(id => id !== facilityId)
        : [...waterData.facilities, facilityId],
    }
    setWaterData(updated)
    triggerAutoSave(updated)
  }

  const handleLifeguardCertsChange = (values: string[]) => {
    const updated = { ...waterData, lifeguardCerts: values }
    setWaterData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Water Activities</h1>
          <p className="text-base leading-normal text-default-500">
            Describe the water-based activities at your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        {/* Description */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <label className="text-sm font-medium text-foreground">
              Water Activities Description
            </label>
            <CharacterCounter
              current={waterData.description.length}
              max={MAX_DESCRIPTION_LENGTH}
            />
          </div>
          <Textarea
            placeholder="Describe your water activities program, safety measures, and facilities..."
            value={waterData.description}
            onValueChange={handleDescriptionChange}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            classNames={{
              input: 'resize-none',
            }}
          />
          <p className="mt-2.5 text-sm leading-normal text-default-500">
            Include details about lifeguard supervision, swimming requirements, and water safety
          </p>
        </div>

        {/* Swim Level */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Swimming Ability Required
            </label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What swimming ability is required for participation?
          </p>
          <RadioGroup
            value={waterData.swimLevel}
            onValueChange={handleSwimLevelChange}
            classNames={{
              wrapper: "flex flex-row flex-wrap gap-3"
            }}
          >
            {SWIM_LEVELS.map(level => (
              <Radio
                key={level.value}
                value={level.value}
                classNames={{
                  base: "flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start",
                  wrapper: "group-data-[selected=true]:border-primary",
                  labelWrapper: "ml-2",
                  label: "text-sm"
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

        {/* Lifeguard Certifications */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Lifeguard & Safety Certifications
            </label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            Select all that apply to your water safety program
          </p>
          <CheckboxGroup
            value={waterData.lifeguardCerts}
            onValueChange={handleLifeguardCertsChange}
            classNames={{
              wrapper: "flex flex-row flex-wrap gap-3"
            }}
          >
            {LIFEGUARD_CERTIFICATIONS.map(cert => (
              <Checkbox
                key={cert.value}
                value={cert.value}
                classNames={{
                  base: "flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start",
                  wrapper: "group-data-[selected=true]:border-primary after:bg-primary",
                  label: "ml-2 text-sm w-full"
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{cert.label}</div>
                  <div className="text-xs text-default-500">{cert.description}</div>
                </div>
              </Checkbox>
            ))}
          </CheckboxGroup>
        </div>

        {/* Water Activities */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                Water Activities Offered
              </label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all water activities available at your camp
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {waterData.selectedActivities.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_WATER_ACTIVITIES}
            selectedActivities={waterData.selectedActivities}
            onToggle={toggleActivity}
          />

          {waterData.customActivities.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {waterData.customActivities.map((activity, index) => (
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
              placeholder="e.g., Scuba Diving, Jet Skiing..."
              onAdd={addCustomActivity}
              buttonText="Add Activity"
            />
          </div>
        </div>

        {/* Water Facilities */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Water Facilities</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select the water facilities available at your camp
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {waterData.facilities.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={WATER_FACILITIES}
            selectedActivities={waterData.facilities}
            onToggle={toggleFacility}
          />
        </div>
      </div>
    </div>
  )
}
