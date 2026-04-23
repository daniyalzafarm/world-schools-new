'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Checkbox, Radio, RadioGroup } from '@heroui/react'
import { Textarea } from '@world-schools/ui-web'
import { useCampsStore } from '../../../../../stores/camps-store'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import {
  PICKUP_LOCATIONS,
  PREDEFINED_TRANSPORT,
  TRANSPORT_INCLUDED,
} from '../../../../../constants/getting-there-activities'

const MAX_DESCRIPTION_LENGTH = 1200
const MAX_TRANSPORT_DESC_LENGTH = 300

interface TransportDetail {
  description?: string
}

interface GettingThereData {
  description: string
  transportIncluded: string
  pickupLocations: string
  selectedTransport: string[]
  transportDetails: Record<string, TransportDetail>
}

export default function GettingThereEditorPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [gettingThereData, setGettingThereData] = useState<GettingThereData>({
    description: '',
    transportIncluded: 'some',
    pickupLocations: 'single',
    selectedTransport: [],
    transportDetails: {},
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (currentCamp && currentCamp.type !== 'residential') {
      router.push(`/camps/${campId}/edit/basic-info`)
      return
    }

    if (currentCamp?.gettingThere) {
      const gt = currentCamp.gettingThere as any
      setGettingThereData({
        description: gt.description || '',
        transportIncluded: gt.transportIncluded || 'some',
        pickupLocations: gt.pickupLocations || 'single',
        selectedTransport: gt.selectedTransport || [],
        transportDetails: gt.transportDetails || {},
      })
    }
  }, [currentCamp, campId, router])

  useEffect(() => {
    return () => {
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  const triggerAutoSave = (updatedData: GettingThereData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) clearTimeout(saveTimeout)

    setAutoSaveStatus('saving')
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      await updateSection(campId, 'getting-there', { gettingThere: updatedData })
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
    const isSelected = gettingThereData.selectedTransport.includes(transportId)
    const nextSelected = isSelected
      ? gettingThereData.selectedTransport.filter(id => id !== transportId)
      : [...gettingThereData.selectedTransport, transportId]

    // Remove details when deselecting
    const nextDetails = { ...gettingThereData.transportDetails }
    if (isSelected) delete nextDetails[transportId]

    const updated = {
      ...gettingThereData,
      selectedTransport: nextSelected,
      transportDetails: nextDetails,
    }
    setGettingThereData(updated)
    triggerAutoSave(updated)
  }

  const handleTransportDetailChange = (
    transportId: string,
    field: keyof TransportDetail,
    value: string
  ) => {
    const updated = {
      ...gettingThereData,
      transportDetails: {
        ...gettingThereData.transportDetails,
        [transportId]: {
          ...gettingThereData.transportDetails[transportId],
          [field]: value,
        },
      },
    }
    setGettingThereData(updated)
    triggerAutoSave(updated)
  }

  if (currentCamp && currentCamp.type !== 'residential') return null

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
          <Textarea
            label="Transportation Description"
            placeholder="Describe transportation options, pickup/drop-off details, and directions..."
            value={gettingThereData.description}
            onChange={e => handleDescriptionChange(e.target.value)}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            showCharacterCount
            description="Include details about transportation services, meeting points, and travel arrangements"
          />
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
            classNames={{ wrapper: 'flex flex-row flex-wrap gap-3' }}
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
            classNames={{ wrapper: 'flex flex-row flex-wrap gap-3' }}
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

        {/* Transportation Options — vertical list */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Transportation Options</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all transportation options available and add details for each
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {gettingThereData.selectedTransport.length} selected
            </span>
          </div>

          <div className="divide-y divide-default-100 rounded-xl border border-default-200">
            {PREDEFINED_TRANSPORT.map(transport => {
              const isSelected = gettingThereData.selectedTransport.includes(transport.id)
              const detail = gettingThereData.transportDetails[transport.id] ?? {}

              return (
                <div key={transport.id}>
                  {/* Row toggle */}
                  <div
                    onClick={() => toggleTransport(transport.id)}
                    className={[
                      'flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors',
                      isSelected ? 'bg-primary/5' : 'hover:bg-default-50',
                    ].join(' ')}
                  >
                    <Checkbox
                      isSelected={isSelected}
                      onValueChange={() => toggleTransport(transport.id)}
                      classNames={{ wrapper: 'group-data-[selected=true]:border-primary' }}
                      onClick={e => e.stopPropagation()}
                    />

                    <span className="text-xl shrink-0">{transport.icon}</span>

                    <span className="flex-1 text-sm font-medium text-foreground">
                      {transport.name}
                    </span>
                  </div>

                  {/* Expanded inputs */}
                  {isSelected && (
                    <div className="border-t border-default-100 bg-default-50 px-4 pb-4 pt-3 space-y-3">
                      <Textarea
                        label="Description"
                        placeholder={`Describe ${transport.name.toLowerCase()} details, timings, meeting points...`}
                        value={detail.description ?? ''}
                        onChange={e =>
                          handleTransportDetailChange(transport.id, 'description', e.target.value)
                        }
                        minRows={2}
                        maxLength={MAX_TRANSPORT_DESC_LENGTH}
                        showCharacterCount
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
