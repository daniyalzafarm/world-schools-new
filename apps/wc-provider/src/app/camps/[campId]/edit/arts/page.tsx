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
  ART_SUPPLIES,
  INSTRUCTION_TYPES,
  PREDEFINED_ARTS,
  SKILL_LEVELS,
} from '../../../../../constants/arts-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface ArtsData {
  description: string
  skillLevel: string
  instructionType: string
  selectedArts: string[]
  customArts: string[]
  supplies: string[]
}

export default function ArtsEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [artsData, setArtsData] = useState<ArtsData>({
    description: '',
    skillLevel: 'all',
    instructionType: 'mixed',
    selectedArts: [],
    customArts: [],
    supplies: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Load existing data
  useEffect(() => {
    if (currentCamp?.artsAndCrafts) {
      setArtsData({
        description: currentCamp.artsAndCrafts.description || '',
        skillLevel: (currentCamp.artsAndCrafts as any).skillLevel || 'all',
        instructionType: (currentCamp.artsAndCrafts as any).instructionType || 'mixed',
        selectedArts: (currentCamp.artsAndCrafts as any).selectedArts || [],
        customArts: (currentCamp.artsAndCrafts as any).customArts || [],
        supplies: (currentCamp.artsAndCrafts as any).supplies || [],
      })
    }
  }, [currentCamp])

  // Cleanup on unmount - clear pending auto-save state
  useEffect(() => {
    return () => {
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  // Auto-save handler
  const triggerAutoSave = (updatedData: ArtsData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    // Update store to indicate pending auto-save (debounce period)
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      await updateSection(campId, 'arts', { artsAndCrafts: updatedData })
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
    const updated = { ...artsData, description: value }
    setArtsData(updated)
    triggerAutoSave(updated)
  }

  const handleSkillLevelChange = (value: string) => {
    const updated = { ...artsData, skillLevel: value }
    setArtsData(updated)
    triggerAutoSave(updated)
  }

  const handleInstructionTypeChange = (value: string) => {
    const updated = { ...artsData, instructionType: value }
    setArtsData(updated)
    triggerAutoSave(updated)
  }

  const toggleArt = (artId: string) => {
    const updated = {
      ...artsData,
      selectedArts: artsData.selectedArts.includes(artId)
        ? artsData.selectedArts.filter(id => id !== artId)
        : [...artsData.selectedArts, artId],
    }
    setArtsData(updated)
    triggerAutoSave(updated)
  }

  const addCustomArt = (artName: string) => {
    const updated = {
      ...artsData,
      customArts: [...artsData.customArts, artName],
    }
    setArtsData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomArt = (index: number) => {
    const updated = {
      ...artsData,
      customArts: artsData.customArts.filter((_, i) => i !== index),
    }
    setArtsData(updated)
    triggerAutoSave(updated)
  }

  const toggleSupply = (supplyId: string) => {
    const updated = {
      ...artsData,
      supplies: artsData.supplies.includes(supplyId)
        ? artsData.supplies.filter(id => id !== supplyId)
        : [...artsData.supplies, supplyId],
    }
    setArtsData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Arts & Crafts</h1>
          <p className="text-base leading-normal text-default-500">
            Describe the arts and creative programs at your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        {/* Description */}
        <div className="form-group">
          <Textarea
            label="Arts Program Description"
            placeholder="Describe your arts program, creative opportunities, and what makes it special..."
            value={artsData.description}
            onChange={e => handleDescriptionChange(e.target.value)}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            showCharacterCount
            description="Include details about instructors, projects, and creative freedom"
          />
        </div>

        {/* Skill Level */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Skill Level</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What skill levels can participate in your arts program?
          </p>
          <RadioGroup
            value={artsData.skillLevel}
            onValueChange={handleSkillLevelChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {SKILL_LEVELS.map(level => (
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

        {/* Instruction Type */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Instruction Type</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What teaching approach do you use for arts instruction?
          </p>
          <RadioGroup
            value={artsData.instructionType}
            onValueChange={handleInstructionTypeChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {INSTRUCTION_TYPES.map(type => (
              <Radio
                key={type.value}
                value={type.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{type.label}</div>
                  <div className="text-xs text-default-500">{type.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        {/* Arts Offered */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                Arts & Creative Activities
              </label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all arts and creative activities available at your camp
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {artsData.selectedArts.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_ARTS}
            selectedActivities={artsData.selectedArts}
            onToggle={toggleArt}
          />

          {/* Custom Arts */}
          {artsData.customArts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {artsData.customArts.map((art, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border-2 border-primary bg-primary/5 px-3 py-2"
                >
                  <span className="text-sm font-medium">{art}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomArt(index)}
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
              placeholder="e.g., Glass Blowing, Origami..."
              onAdd={addCustomArt}
              buttonText="Add Activity"
            />
          </div>
        </div>

        {/* Supplies */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                Art Supplies & Equipment
              </label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select the art supplies and equipment available
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {artsData.supplies.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={ART_SUPPLIES}
            selectedActivities={artsData.supplies}
            onToggle={toggleSupply}
          />
        </div>
      </div>
    </div>
  )
}
