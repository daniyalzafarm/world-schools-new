'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Radio, RadioGroup } from '@heroui/react'
import { Textarea } from '@world-schools/ui-web'
import {
  CAMPUS_SETTING,
  CAMPUS_SIZE,
  PREDEFINED_FACILITIES,
} from '@world-schools/wc-frontend-utils'
import { useCampsStore } from '../../../../../stores/camps-store'
import { ActivityGrid } from '../../../../../components/camp-editor/ActivityGrid'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'

const MAX_DESCRIPTION_LENGTH = 1200

interface LocationCampusData {
  description: string
  campusSize: string
  campusSetting: string
  selectedFacilities: string[]
}

export default function LocationCampusEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [locationData, setLocationData] = useState<LocationCampusData>({
    description: '',
    campusSize: 'medium',
    campusSetting: 'suburban',
    selectedFacilities: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (currentCamp?.campusFacilities) {
      setLocationData({
        description: currentCamp.campusFacilities.description || '',
        campusSize: (currentCamp.campusFacilities as any).campusSize || 'medium',
        campusSetting: (currentCamp.campusFacilities as any).campusSetting || 'suburban',
        selectedFacilities: (currentCamp.campusFacilities as any).selectedFacilities || [],
      })
    }
  }, [currentCamp])

  // Cleanup on unmount - clear pending auto-save state
  useEffect(() => {
    return () => {
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  const triggerAutoSave = (updatedData: LocationCampusData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    // Update store to indicate pending auto-save (debounce period)
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'location-campus', { campusFacilities: updatedData })
        setAutoSaveStatus('saved')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })
        setHasUnsavedChanges(false)
        setTimeout(() => {
          setAutoSaveStatus('idle')
          useCampsStore.setState({ autoSaveStatus: 'idle' })
        }, 2000)
      } catch (error) {
        console.error('Failed to save location data:', error)
        setAutoSaveStatus('error')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...locationData, description: value }
    setLocationData(updated)
    triggerAutoSave(updated)
  }

  const handleCampusSizeChange = (value: string) => {
    const updated = { ...locationData, campusSize: value }
    setLocationData(updated)
    triggerAutoSave(updated)
  }

  const handleCampusSettingChange = (value: string) => {
    const updated = { ...locationData, campusSetting: value }
    setLocationData(updated)
    triggerAutoSave(updated)
  }

  const toggleFacility = (facilityId: string) => {
    const updated = {
      ...locationData,
      selectedFacilities: locationData.selectedFacilities.includes(facilityId)
        ? locationData.selectedFacilities.filter(id => id !== facilityId)
        : [...locationData.selectedFacilities, facilityId],
    }
    setLocationData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Location & Campus</h1>
          <p className="text-base leading-normal text-default-500">
            Describe your camp location and campus facilities
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        <div className="form-group">
          <Textarea
            label="Location & Campus Description"
            placeholder="Describe your camp location, setting, and campus facilities..."
            value={locationData.description}
            onChange={e => handleDescriptionChange(e.target.value)}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            showCharacterCount
            description="Include details about the setting, nearby attractions, and campus grounds"
          />
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Campus Size</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            How large is your camp campus?
          </p>
          <RadioGroup
            value={locationData.campusSize}
            onValueChange={handleCampusSizeChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {CAMPUS_SIZE.map(size => (
              <Radio
                key={size.value}
                value={size.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{size.label}</div>
                  <div className="text-xs text-default-500">{size.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Campus Setting</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What type of setting is your camp located in?
          </p>
          <RadioGroup
            value={locationData.campusSetting}
            onValueChange={handleCampusSettingChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {CAMPUS_SETTING.map(setting => (
              <Radio
                key={setting.value}
                value={setting.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{setting.label}</div>
                  <div className="text-xs text-default-500">{setting.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Campus Facilities</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all facilities available on your campus
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {locationData.selectedFacilities.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_FACILITIES}
            selectedActivities={locationData.selectedFacilities}
            onToggle={toggleFacility}
          />
        </div>
      </div>
    </div>
  )
}
