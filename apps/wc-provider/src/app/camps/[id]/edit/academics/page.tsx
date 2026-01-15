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
  ACADEMIC_LEVELS,
  PREDEFINED_ACADEMICS,
  TEACHING_APPROACH,
} from '../../../../../constants/academics-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface AcademicsData {
  description: string
  academicLevel: string
  teachingApproach: string
  selectedSubjects: string[]
  customSubjects: string[]
}

export default function AcademicsEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [academicsData, setAcademicsData] = useState<AcademicsData>({
    description: '',
    academicLevel: 'mixed',
    teachingApproach: 'hands-on',
    selectedSubjects: [],
    customSubjects: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (currentCamp?.academics) {
      setAcademicsData({
        description: currentCamp.academics.description || '',
        academicLevel: (currentCamp.academics as any).academicLevel || 'mixed',
        teachingApproach: (currentCamp.academics as any).teachingApproach || 'hands-on',
        selectedSubjects: (currentCamp.academics as any).selectedSubjects || [],
        customSubjects: (currentCamp.academics as any).customSubjects || [],
      })
    }
  }, [currentCamp])

  // Cleanup on unmount - clear pending auto-save state
  useEffect(() => {
    return () => {
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  const triggerAutoSave = (updatedData: AcademicsData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    // Update store to indicate pending auto-save (debounce period)
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'academics', { academics: updatedData })
        setAutoSaveStatus('saved')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })
        setHasUnsavedChanges(false)
        setTimeout(() => {
          setAutoSaveStatus('idle')
          useCampsStore.setState({ autoSaveStatus: 'idle' })
        }, 2000)
      } catch (error) {
        console.error('Failed to save academics data:', error)
        setAutoSaveStatus('error')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...academicsData, description: value }
    setAcademicsData(updated)
    triggerAutoSave(updated)
  }

  const handleAcademicLevelChange = (value: string) => {
    const updated = { ...academicsData, academicLevel: value }
    setAcademicsData(updated)
    triggerAutoSave(updated)
  }

  const handleTeachingApproachChange = (value: string) => {
    const updated = { ...academicsData, teachingApproach: value }
    setAcademicsData(updated)
    triggerAutoSave(updated)
  }

  const toggleSubject = (subjectId: string) => {
    const updated = {
      ...academicsData,
      selectedSubjects: academicsData.selectedSubjects.includes(subjectId)
        ? academicsData.selectedSubjects.filter(id => id !== subjectId)
        : [...academicsData.selectedSubjects, subjectId],
    }
    setAcademicsData(updated)
    triggerAutoSave(updated)
  }

  const addCustomSubject = (subjectName: string) => {
    const updated = {
      ...academicsData,
      customSubjects: [...academicsData.customSubjects, subjectName],
    }
    setAcademicsData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomSubject = (index: number) => {
    const updated = {
      ...academicsData,
      customSubjects: academicsData.customSubjects.filter((_, i) => i !== index),
    }
    setAcademicsData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Academic Programs</h1>
          <p className="text-base leading-normal text-default-500">
            Describe the academic and educational programs at your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <label className="text-sm font-medium text-foreground">
              Academic Program Description
            </label>
            <CharacterCounter
              current={academicsData.description.length}
              max={MAX_DESCRIPTION_LENGTH}
            />
          </div>
          <Textarea
            placeholder="Describe your academic program, subjects taught, and learning outcomes..."
            value={academicsData.description}
            onValueChange={handleDescriptionChange}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            classNames={{
              input: 'resize-none',
            }}
          />
          <p className="mt-2.5 text-sm leading-normal text-default-500">
            Include details about curriculum, teacher qualifications, and educational goals
          </p>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Academic Level</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What age groups or grade levels does your academic program serve?
          </p>
          <RadioGroup
            value={academicsData.academicLevel}
            onValueChange={handleAcademicLevelChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {ACADEMIC_LEVELS.map(level => (
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

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Teaching Approach</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What teaching methodology do you use for academic instruction?
          </p>
          <RadioGroup
            value={academicsData.teachingApproach}
            onValueChange={handleTeachingApproachChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {TEACHING_APPROACH.map(approach => (
              <Radio
                key={approach.value}
                value={approach.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{approach.label}</div>
                  <div className="text-xs text-default-500">{approach.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Subjects Offered</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all academic subjects taught at your camp
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {academicsData.selectedSubjects.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_ACADEMICS}
            selectedActivities={academicsData.selectedSubjects}
            onToggle={toggleSubject}
          />

          {academicsData.customSubjects.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {academicsData.customSubjects.map((subject, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border-2 border-primary bg-primary/5 px-3 py-2"
                >
                  <span className="text-sm font-medium">{subject}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomSubject(index)}
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
              placeholder="e.g., Philosophy, Economics..."
              onAdd={addCustomSubject}
              buttonText="Add Subject"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
