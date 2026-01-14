'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Radio, RadioGroup, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { ActivityGrid } from '../../../../../components/camp-editor/ActivityGrid'
import { CharacterCounter } from '../../../../../components/camp-editor/CharacterCounter'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import {
  PREDEFINED_ACCOMMODATION,
  ROOM_AMENITIES,
  ROOM_CAPACITY,
  SUPERVISION,
} from '../../../../../constants/accommodation-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface AccommodationData {
  description: string
  roomCapacity: string
  supervision: string
  selectedTypes: string[]
  amenities: string[]
}

export default function AccommodationEditorPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [accommodationData, setAccommodationData] = useState<AccommodationData>({
    description: '',
    roomCapacity: '5-8',
    supervision: '24-7',
    selectedTypes: [],
    amenities: [],
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

    if (currentCamp?.accommodation) {
      setAccommodationData({
        description: currentCamp.accommodation.description || '',
        roomCapacity: (currentCamp.accommodation as any).roomCapacity || '5-8',
        supervision: (currentCamp.accommodation as any).supervision || '24-7',
        selectedTypes: (currentCamp.accommodation as any).selectedTypes || [],
        amenities: (currentCamp.accommodation as any).amenities || [],
      })
    }
  }, [currentCamp, campId, router])

  const triggerAutoSave = (updatedData: AccommodationData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'accommodation', { accommodation: updatedData })
        setAutoSaveStatus('saved')
        setHasUnsavedChanges(false)
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (error) {
        console.error('Failed to save accommodation data:', error)
        setAutoSaveStatus('error')
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...accommodationData, description: value }
    setAccommodationData(updated)
    triggerAutoSave(updated)
  }

  const handleRoomCapacityChange = (value: string) => {
    const updated = { ...accommodationData, roomCapacity: value }
    setAccommodationData(updated)
    triggerAutoSave(updated)
  }

  const handleSupervisionChange = (value: string) => {
    const updated = { ...accommodationData, supervision: value }
    setAccommodationData(updated)
    triggerAutoSave(updated)
  }

  const toggleType = (typeId: string) => {
    const updated = {
      ...accommodationData,
      selectedTypes: accommodationData.selectedTypes.includes(typeId)
        ? accommodationData.selectedTypes.filter(id => id !== typeId)
        : [...accommodationData.selectedTypes, typeId],
    }
    setAccommodationData(updated)
    triggerAutoSave(updated)
  }

  const toggleAmenity = (amenityId: string) => {
    const updated = {
      ...accommodationData,
      amenities: accommodationData.amenities.includes(amenityId)
        ? accommodationData.amenities.filter(id => id !== amenityId)
        : [...accommodationData.amenities, amenityId],
    }
    setAccommodationData(updated)
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
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Accommodation</h1>
          <p className="text-base leading-normal text-default-500">
            Describe the accommodation facilities for residential campers
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <label className="text-sm font-medium text-foreground">Accommodation Description</label>
            <CharacterCounter
              current={accommodationData.description.length}
              max={MAX_DESCRIPTION_LENGTH}
            />
          </div>
          <Textarea
            placeholder="Describe your accommodation facilities, sleeping arrangements, and amenities..."
            value={accommodationData.description}
            onValueChange={handleDescriptionChange}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            classNames={{
              input: 'resize-none',
            }}
          />
          <p className="mt-2.5 text-sm leading-normal text-default-500">
            Include details about cabins/dorms, bedding, bathrooms, and supervision
          </p>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Sleeping Arrangements</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select the types of accommodation available
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {accommodationData.selectedTypes.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_ACCOMMODATION}
            selectedActivities={accommodationData.selectedTypes}
            onToggle={toggleType}
          />
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Room Capacity</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            How many campers typically share a room?
          </p>
          <RadioGroup
            value={accommodationData.roomCapacity}
            onValueChange={handleRoomCapacityChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {ROOM_CAPACITY.map(capacity => (
              <Radio
                key={capacity.value}
                value={capacity.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{capacity.label}</div>
                  <div className="text-xs text-default-500">{capacity.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Supervision</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What level of supervision is provided?
          </p>
          <RadioGroup
            value={accommodationData.supervision}
            onValueChange={handleSupervisionChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {SUPERVISION.map(sup => (
              <Radio
                key={sup.value}
                value={sup.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{sup.label}</div>
                  <div className="text-xs text-default-500">{sup.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Room Amenities</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all amenities available in rooms
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {accommodationData.amenities.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={ROOM_AMENITIES}
            selectedActivities={accommodationData.amenities}
            onToggle={toggleAmenity}
          />
        </div>
      </div>
    </div>
  )
}
