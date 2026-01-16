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
  LANGUAGE_PROFICIENCY_LEVELS,
  PREDEFINED_LANGUAGES,
  TEACHING_METHODS,
} from '../../../../../constants/languages-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface LanguagesData {
  description: string
  proficiencyLevel: string
  teachingMethod: string
  selectedLanguages: string[]
  customLanguages: string[]
}

export default function LanguagesEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [languagesData, setLanguagesData] = useState<LanguagesData>({
    description: '',
    proficiencyLevel: 'all',
    teachingMethod: 'mixed',
    selectedLanguages: [],
    customLanguages: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Load existing data
  useEffect(() => {
    if (currentCamp?.languagePrograms) {
      setLanguagesData({
        description: currentCamp.languagePrograms.description || '',
        proficiencyLevel: (currentCamp.languagePrograms as any).proficiencyLevel || 'all',
        teachingMethod: (currentCamp.languagePrograms as any).teachingMethod || 'mixed',
        selectedLanguages: (currentCamp.languagePrograms as any).selectedLanguages || [],
        customLanguages: (currentCamp.languagePrograms as any).customLanguages || [],
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
  const triggerAutoSave = (updatedData: LanguagesData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    // Update store to indicate pending auto-save (debounce period)
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'languages', { languagePrograms: updatedData })
        setAutoSaveStatus('saved')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })
        setHasUnsavedChanges(false)
        setTimeout(() => {
          setAutoSaveStatus('idle')
          useCampsStore.setState({ autoSaveStatus: 'idle' })
        }, 2000)
      } catch (error) {
        console.error('Failed to save languages data:', error)
        setAutoSaveStatus('error')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...languagesData, description: value }
    setLanguagesData(updated)
    triggerAutoSave(updated)
  }

  const handleProficiencyLevelChange = (value: string) => {
    const updated = { ...languagesData, proficiencyLevel: value }
    setLanguagesData(updated)
    triggerAutoSave(updated)
  }

  const handleTeachingMethodChange = (value: string) => {
    const updated = { ...languagesData, teachingMethod: value }
    setLanguagesData(updated)
    triggerAutoSave(updated)
  }

  const toggleLanguage = (languageId: string) => {
    const updated = {
      ...languagesData,
      selectedLanguages: languagesData.selectedLanguages.includes(languageId)
        ? languagesData.selectedLanguages.filter(id => id !== languageId)
        : [...languagesData.selectedLanguages, languageId],
    }
    setLanguagesData(updated)
    triggerAutoSave(updated)
  }

  const addCustomLanguage = (languageName: string) => {
    const updated = {
      ...languagesData,
      customLanguages: [...languagesData.customLanguages, languageName],
    }
    setLanguagesData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomLanguage = (index: number) => {
    const updated = {
      ...languagesData,
      customLanguages: languagesData.customLanguages.filter((_, i) => i !== index),
    }
    setLanguagesData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Language Programs</h1>
          <p className="text-base leading-normal text-default-500">
            Describe the language learning programs at your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        {/* Description */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <label className="text-sm font-medium text-foreground">
              Language Program Description
            </label>
            <CharacterCounter
              current={languagesData.description.length}
              max={MAX_DESCRIPTION_LENGTH}
            />
          </div>
          <Textarea
            placeholder="Describe your language program, teaching approach, and what makes it effective..."
            value={languagesData.description}
            onValueChange={handleDescriptionChange}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            classNames={{
              input: 'resize-none',
            }}
          />
          <p className="mt-2.5 text-sm leading-normal text-default-500">
            Include details about class structure, teacher qualifications, and learning outcomes
          </p>
        </div>

        {/* Proficiency Level */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Proficiency Level</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What language proficiency levels can participate?
          </p>
          <RadioGroup
            value={languagesData.proficiencyLevel}
            onValueChange={handleProficiencyLevelChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {LANGUAGE_PROFICIENCY_LEVELS.map(level => (
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

        {/* Teaching Method */}
        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Teaching Method</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What teaching approach do you use for language instruction?
          </p>
          <RadioGroup
            value={languagesData.teachingMethod}
            onValueChange={handleTeachingMethodChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {TEACHING_METHODS.map(method => (
              <Radio
                key={method.value}
                value={method.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{method.label}</div>
                  <div className="text-xs text-default-500">{method.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        {/* Languages Offered */}
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Languages Offered</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all languages taught at your camp
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {languagesData.selectedLanguages.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_LANGUAGES}
            selectedActivities={languagesData.selectedLanguages}
            onToggle={toggleLanguage}
          />

          {/* Custom Languages */}
          {languagesData.customLanguages.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {languagesData.customLanguages.map((language, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border-2 border-primary bg-primary/5 px-3 py-2"
                >
                  <span className="text-sm font-medium">{language}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomLanguage(index)}
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
              placeholder="e.g., Hindi, Turkish..."
              onAdd={addCustomLanguage}
              buttonText="Add Language"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
