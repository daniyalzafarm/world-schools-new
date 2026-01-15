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
  ECO_CERTIFICATIONS,
  PREDEFINED_ENVIRONMENTAL,
  SUSTAINABILITY_FOCUS,
} from '../../../../../constants/environmental-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface EnvironmentalData {
  description: string
  sustainabilityFocus: string
  selectedActivities: string[]
  customActivities: string[]
  certifications: string[]
}

export default function EnvironmentalEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalData>({
    description: '',
    sustainabilityFocus: 'moderate',
    selectedActivities: [],
    customActivities: [],
    certifications: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (currentCamp?.environmentalActivities) {
      setEnvironmentalData({
        description: currentCamp.environmentalActivities.description || '',
        sustainabilityFocus:
          (currentCamp.environmentalActivities as any).sustainabilityFocus || 'moderate',
        selectedActivities: (currentCamp.environmentalActivities as any).selectedActivities || [],
        customActivities: (currentCamp.environmentalActivities as any).customActivities || [],
        certifications: (currentCamp.environmentalActivities as any).certifications || [],
      })
    }
  }, [currentCamp])

  // Cleanup on unmount - clear pending auto-save state
  useEffect(() => {
    return () => {
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  const triggerAutoSave = (updatedData: EnvironmentalData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    // Update store to indicate pending auto-save (debounce period)
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'environmental', { environmentalActivities: updatedData })
        setAutoSaveStatus('saved')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })
        setHasUnsavedChanges(false)
        setTimeout(() => {
          setAutoSaveStatus('idle')
          useCampsStore.setState({ autoSaveStatus: 'idle' })
        }, 2000)
      } catch (error) {
        console.error('Failed to save environmental data:', error)
        setAutoSaveStatus('error')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...environmentalData, description: value }
    setEnvironmentalData(updated)
    triggerAutoSave(updated)
  }

  const handleSustainabilityFocusChange = (value: string) => {
    const updated = { ...environmentalData, sustainabilityFocus: value }
    setEnvironmentalData(updated)
    triggerAutoSave(updated)
  }

  const toggleActivity = (activityId: string) => {
    const updated = {
      ...environmentalData,
      selectedActivities: environmentalData.selectedActivities.includes(activityId)
        ? environmentalData.selectedActivities.filter(id => id !== activityId)
        : [...environmentalData.selectedActivities, activityId],
    }
    setEnvironmentalData(updated)
    triggerAutoSave(updated)
  }

  const addCustomActivity = (activityName: string) => {
    const updated = {
      ...environmentalData,
      customActivities: [...environmentalData.customActivities, activityName],
    }
    setEnvironmentalData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomActivity = (index: number) => {
    const updated = {
      ...environmentalData,
      customActivities: environmentalData.customActivities.filter((_, i) => i !== index),
    }
    setEnvironmentalData(updated)
    triggerAutoSave(updated)
  }

  const toggleCertification = (certId: string) => {
    const updated = {
      ...environmentalData,
      certifications: environmentalData.certifications.includes(certId)
        ? environmentalData.certifications.filter(id => id !== certId)
        : [...environmentalData.certifications, certId],
    }
    setEnvironmentalData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">
            Environmental Activities
          </h1>
          <p className="text-base leading-normal text-default-500">
            Describe the environmental and sustainability programs at your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        {/* Description */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <label className="text-sm font-medium text-foreground">
              Environmental Program Description
            </label>
            <CharacterCounter
              current={environmentalData.description.length}
              max={MAX_DESCRIPTION_LENGTH}
            />
          </div>
          <Textarea
            placeholder="Describe your environmental program, sustainability initiatives, and nature education..."
            value={environmentalData.description}
            onValueChange={handleDescriptionChange}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            classNames={{
              input: 'resize-none',
            }}
          />
          <p className="mt-2.5 text-sm leading-normal text-default-500">
            Include details about conservation projects, eco-friendly practices, and outdoor
            learning
          </p>
        </div>

        {/* Sustainability Focus */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Sustainability Focus</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            How central is sustainability to your camp's mission?
          </p>
          <RadioGroup
            value={environmentalData.sustainabilityFocus}
            onValueChange={handleSustainabilityFocusChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {SUSTAINABILITY_FOCUS.map(focus => (
              <Radio
                key={focus.value}
                value={focus.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{focus.label}</div>
                  <div className="text-xs text-default-500">{focus.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        {/* Environmental Activities */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                Environmental Activities Offered
              </label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all environmental activities available at your camp
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {environmentalData.selectedActivities.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_ENVIRONMENTAL}
            selectedActivities={environmentalData.selectedActivities}
            onToggle={toggleActivity}
          />

          {environmentalData.customActivities.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {environmentalData.customActivities.map((activity, index) => (
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
              placeholder="e.g., Beekeeping, Solar Energy Projects..."
              onAdd={addCustomActivity}
              buttonText="Add Activity"
            />
          </div>
        </div>

        {/* Eco Certifications */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                Eco Certifications & Awards
              </label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select any environmental certifications your camp holds
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {environmentalData.certifications.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={ECO_CERTIFICATIONS}
            selectedActivities={environmentalData.certifications}
            onToggle={toggleCertification}
          />
        </div>
      </div>
    </div>
  )
}
