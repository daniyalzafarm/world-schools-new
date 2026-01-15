'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Radio, RadioGroup, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { ActivityGrid } from '../../../../../components/camp-editor/ActivityGrid'
import { CharacterCounter } from '../../../../../components/camp-editor/CharacterCounter'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import {
  PICKUP_LOCATIONS,
  PREDEFINED_TRANSPORT,
  TRANSPORT_INCLUDED,
} from '../../../../../constants/getting-there-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface GettingThereData {
  description: string
  transportIncluded: string
  pickupLocations: string
  selectedTransport: string[]
}

export default function GettingThereEditorPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [gettingThereData, setGettingThereData] = useState<GettingThereData>({
    description: '',
    transportIncluded: 'some',
    pickupLocations: 'single',
    selectedTransport: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Redirect if not a residential camp
    if (currentCamp && currentCamp.type !== 'residential') {
      router.push(`/camps/${campId}/edit/basic-info`)
      return
    }

    if (currentCamp?.gettingThere) {
      setGettingThereData({
        description: currentCamp.gettingThere.description || '',
        transportIncluded: (currentCamp.gettingThere as any).transportIncluded || 'some',
        pickupLocations: (currentCamp.gettingThere as any).pickupLocations || 'single',
        selectedTransport: (currentCamp.gettingThere as any).selectedTransport || [],
      })
    }
  }, [currentCamp, campId, router])

  // Cleanup on unmount - clear pending auto-save state
  useEffect(() => {
    return () => {
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  const triggerAutoSave = (updatedData: GettingThereData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    // Update store to indicate pending auto-save (debounce period)
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'getting-there', { gettingThere: updatedData })
        setAutoSaveStatus('saved')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })
        setHasUnsavedChanges(false)
        setTimeout(() => {
          setAutoSaveStatus('idle')
          useCampsStore.setState({ autoSaveStatus: 'idle' })
        }, 2000)
      } catch (error) {
        console.error('Failed to save getting there data:', error)
        setAutoSaveStatus('error')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...gettingThereData, description: value }
    setGettingThereData(updated)
    triggerAutoSave(updated)
  }

  const handleTransportIncludedChange = (value: string) => {
    const updated = { ...gettingThereData, transportIncluded: value }
    setGettingThereData(updated)
    triggerAutoSave(updated)
  }

  const handlePickupLocationsChange = (value: string) => {
    const updated = { ...gettingThereData, pickupLocations: value }
    setGettingThereData(updated)
    triggerAutoSave(updated)
  }

  const toggleTransport = (transportId: string) => {
    const updated = {
      ...gettingThereData,
      selectedTransport: gettingThereData.selectedTransport.includes(transportId)
        ? gettingThereData.selectedTransport.filter(id => id !== transportId)
        : [...gettingThereData.selectedTransport, transportId],
    }
    setGettingThereData(updated)
    triggerAutoSave(updated)
  }

  // Don't render if not residential
  if (currentCamp && currentCamp.type !== 'residential') {
    return null
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Getting There</h1>
          <p className="text-base leading-normal text-default-500">
            Provide transportation and arrival information
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <label className="text-sm font-medium text-foreground">
              Transportation Description
            </label>
            <CharacterCounter
              current={gettingThereData.description.length}
              max={MAX_DESCRIPTION_LENGTH}
            />
          </div>
          <Textarea
            placeholder="Describe transportation options, pickup/drop-off details, and directions..."
            value={gettingThereData.description}
            onValueChange={handleDescriptionChange}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            classNames={{
              input: 'resize-none',
            }}
          />
          <p className="mt-2.5 text-sm leading-normal text-default-500">
            Include details about transportation services, meeting points, and travel arrangements
          </p>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Transportation Included</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            Is transportation to/from camp included in the fee?
          </p>
          <RadioGroup
            value={gettingThereData.transportIncluded}
            onValueChange={handleTransportIncludedChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {TRANSPORT_INCLUDED.map(option => (
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
            <label className="text-sm font-medium text-foreground">Pickup Locations</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            How many pickup/drop-off locations do you offer?
          </p>
          <RadioGroup
            value={gettingThereData.pickupLocations}
            onValueChange={handlePickupLocationsChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {PICKUP_LOCATIONS.map(location => (
              <Radio
                key={location.value}
                value={location.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{location.label}</div>
                  <div className="text-xs text-default-500">{location.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Transportation Options</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all transportation options available
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {gettingThereData.selectedTransport.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_TRANSPORT}
            selectedActivities={gettingThereData.selectedTransport}
            onToggle={toggleTransport}
          />
        </div>
      </div>
    </div>
  )
}
