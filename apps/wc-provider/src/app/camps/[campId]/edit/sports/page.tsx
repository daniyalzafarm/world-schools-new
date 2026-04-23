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
  COACHING_TYPES,
  PREDEFINED_SPORTS,
  SKILL_LEVELS,
  SPORTS_FACILITIES,
} from '../../../../../constants/sports-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface SportsData {
  description: string
  skillLevel: string
  coachingType: string
  selectedSports: string[]
  customSports: string[]
  facilities: string[]
}

export default function SportsEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [sportsData, setSportsData] = useState<SportsData>({
    description: '',
    skillLevel: 'all',
    coachingType: 'both',
    selectedSports: [],
    customSports: [],
    facilities: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Load existing data
  useEffect(() => {
    if (currentCamp?.sportsActivities) {
      setSportsData({
        description: currentCamp.sportsActivities.description || '',
        skillLevel: (currentCamp.sportsActivities as any).skillLevel || 'all',
        coachingType: (currentCamp.sportsActivities as any).coachingType || 'both',
        selectedSports: (currentCamp.sportsActivities as any).selectedSports || [],
        customSports: (currentCamp.sportsActivities as any).customSports || [],
        facilities: (currentCamp.sportsActivities as any).facilities || [],
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
  const triggerAutoSave = (updatedData: SportsData) => {
    setHasUnsavedChanges(true)

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    // Update store to indicate pending auto-save (debounce period)
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    // Set new timeout
    const timeout = setTimeout(async () => {
      await updateSection(campId, 'sports', { sportsActivities: updatedData })
      if (useCampsStore.getState().error) {
        setAutoSaveStatus('error')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
        return
      }
      setAutoSaveStatus('saved')
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })
      setHasUnsavedChanges(false)

      // Hide indicator after 2 seconds
      setTimeout(() => {
        setAutoSaveStatus('idle')
        useCampsStore.setState({ autoSaveStatus: 'idle' })
      }, 2000)
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...sportsData, description: value }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const handleSkillLevelChange = (value: string) => {
    const updated = { ...sportsData, skillLevel: value }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const handleCoachingTypeChange = (value: string) => {
    const updated = { ...sportsData, coachingType: value }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const toggleSport = (sportId: string) => {
    const updated = {
      ...sportsData,
      selectedSports: sportsData.selectedSports.includes(sportId)
        ? sportsData.selectedSports.filter(id => id !== sportId)
        : [...sportsData.selectedSports, sportId],
    }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const addCustomSport = (sportName: string) => {
    const updated = {
      ...sportsData,
      customSports: [...sportsData.customSports, sportName],
    }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomSport = (index: number) => {
    const updated = {
      ...sportsData,
      customSports: sportsData.customSports.filter((_, i) => i !== index),
    }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const toggleFacility = (facilityId: string) => {
    const updated = {
      ...sportsData,
      facilities: sportsData.facilities.includes(facilityId)
        ? sportsData.facilities.filter(id => id !== facilityId)
        : [...sportsData.facilities, facilityId],
    }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Sports Activities</h1>
          <p className="text-base leading-normal text-default-500">
            Describe the sports programs and facilities at your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        {/* Description */}
        <div className="form-group">
          <Textarea
            label="Sports Program Description"
            placeholder="Describe your sports program, coaching approach, equipment provided, and what makes it special..."
            value={sportsData.description}
            onChange={e => handleDescriptionChange(e.target.value)}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            showCharacterCount
            description="Include details about coaching staff, skill development, and competitive opportunities"
          />
        </div>

        {/* Skill Level */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Skill Level</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What skill levels can participate? This helps parents know if the program is right for
            their child.
          </p>
          <RadioGroup
            value={sportsData.skillLevel}
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

        {/* Coaching Type */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Coaching Type</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            Is your program recreational fun or competitive training focused?
          </p>
          <RadioGroup
            value={sportsData.coachingType}
            onValueChange={handleCoachingTypeChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {COACHING_TYPES.map(type => (
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

        {/* Sports Offered */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                Sports & Activities Offered
              </label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all sports available at your camp. This makes your camp searchable by
                specific sports.
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {sportsData.selectedSports.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_SPORTS}
            selectedActivities={sportsData.selectedSports}
            onToggle={toggleSport}
          />

          {/* Custom Sports */}
          {sportsData.customSports.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {sportsData.customSports.map((sport, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border-2 border-primary bg-primary/5 px-3 py-2"
                >
                  <span className="text-sm font-medium">{sport}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomSport(index)}
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
              placeholder="e.g., Rock Climbing, Horseback Riding..."
              onAdd={addCustomSport}
              buttonText="Add Sport"
            />
          </div>
        </div>

        {/* Facilities */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Sports Facilities</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select the sports facilities available at your camp
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {sportsData.facilities.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={SPORTS_FACILITIES}
            selectedActivities={sportsData.facilities}
            onToggle={toggleFacility}
          />
        </div>
      </div>
    </div>
  )
}
