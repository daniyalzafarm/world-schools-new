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
  lifeguardCertification: string
}

export default function WaterEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection } = useCampsStore()

  const [waterData, setWaterData] = useState<WaterData>({
    description: '',
    swimLevel: 'all',
    selectedActivities: [],
    customActivities: [],
    facilities: [],
    lifeguardCertification: 'certified',
  })
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (currentCamp?.waterActivities) {
      setWaterData({
        description: currentCamp.waterActivities.description || '',
        swimLevel: (currentCamp.waterActivities as any).swimLevel || 'all',
        selectedActivities: (currentCamp.waterActivities as any).selectedActivities || [],
        customActivities: (currentCamp.waterActivities as any).customActivities || [],
        facilities: (currentCamp.waterActivities as any).facilities || [],
        lifeguardCertification:
          (currentCamp.waterActivities as any).lifeguardCertification || 'certified',
      })
      setIsLoaded(true)
    } else if (currentCamp) {
      setIsLoaded(true)
    }
  }, [currentCamp])

  useAutosave(waterData, {
    enabled: isLoaded,
    save: async data => {
      await updateSection(campId, 'water', { waterActivities: data })
    },
  })

  const handleDescriptionChange = (value: string) => {
    const updated = { ...waterData, description: value }
    setWaterData(updated)
  }

  const handleSwimLevelChange = (value: string) => {
    const updated = { ...waterData, swimLevel: value }
    setWaterData(updated)
  }

  const toggleActivity = (activityId: string) => {
    const updated = {
      ...waterData,
      selectedActivities: waterData.selectedActivities.includes(activityId)
        ? waterData.selectedActivities.filter(id => id !== activityId)
        : [...waterData.selectedActivities, activityId],
    }
    setWaterData(updated)
  }

  const addCustomActivity = (activityName: string) => {
    const updated = {
      ...waterData,
      customActivities: [...waterData.customActivities, activityName],
    }
    setWaterData(updated)
  }

  const removeCustomActivity = (index: number) => {
    const updated = {
      ...waterData,
      customActivities: waterData.customActivities.filter((_, i) => i !== index),
    }
    setWaterData(updated)
  }

  const toggleFacility = (facilityId: string) => {
    const updated = {
      ...waterData,
      facilities: waterData.facilities.includes(facilityId)
        ? waterData.facilities.filter(id => id !== facilityId)
        : [...waterData.facilities, facilityId],
    }
    setWaterData(updated)
  }

  const handleLifeguardCertificationChange = (value: string) => {
    const updated = { ...waterData, lifeguardCertification: value }
    setWaterData(updated)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Water Activities</h1>
        <p className="text-base leading-normal text-default-500">
          Describe the water-based activities at your camp
        </p>
      </div>

      <div className="space-y-8">
        {/* Description */}
        <div className="form-group">
          <Textarea
            label="Water Activities Description"
            placeholder="Describe your water activities program, safety measures, and facilities..."
            value={waterData.description}
            onChange={e => handleDescriptionChange(e.target.value)}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            showCharacterCount
            description="Include details about lifeguard supervision, swimming requirements, and water safety"
          />
        </div>

        {/* Swim Level */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Swimming Ability Required</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What swimming ability is required for participation?
          </p>
          <RadioGroup
            value={waterData.swimLevel}
            onValueChange={handleSwimLevelChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {SWIM_LEVELS.map(level => (
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

        {/* Lifeguard Certifications */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Lifeguard & Safety Certifications
            </label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What level of water safety supervision do you provide?
          </p>
          <RadioGroup
            value={waterData.lifeguardCertification}
            onValueChange={handleLifeguardCertificationChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {LIFEGUARD_CERTIFICATIONS.map(cert => (
              <Radio
                key={cert.value}
                value={cert.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{cert.label}</div>
                  <div className="text-xs text-default-500">{cert.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
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
