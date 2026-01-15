'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Checkbox, CheckboxGroup, Textarea } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { ActivityGrid } from '../../../../../components/camp-editor/ActivityGrid'
import { CharacterCounter } from '../../../../../components/camp-editor/CharacterCounter'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { CustomActivityInput } from '../../../../../components/camp-editor/CustomActivityInput'
import {
  MEAL_STYLE,
  MEAL_TYPES,
  PREDEFINED_DIETARY_OPTIONS,
} from '../../../../../constants/meals-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface MealsData {
  description: string
  mealsIncluded: string[]
  mealStyle: string[]
  dietaryOptions: string[]
  customDietaryOptions: string[]
}

export default function MealsEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [mealsData, setMealsData] = useState<MealsData>({
    description: '',
    mealsIncluded: [],
    mealStyle: [],
    dietaryOptions: [],
    customDietaryOptions: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (currentCamp?.meals) {
      setMealsData({
        description: (currentCamp.meals as any).description || '',
        mealsIncluded: (currentCamp.meals as any).mealsIncluded || [],
        mealStyle: (currentCamp.meals as any).mealStyle || [],
        dietaryOptions: (currentCamp.meals as any).dietaryOptions || [],
        customDietaryOptions: (currentCamp.meals as any).customDietaryOptions || [],
      })
    }
  }, [currentCamp])

  // Cleanup on unmount - clear pending auto-save state
  useEffect(() => {
    return () => {
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  const triggerAutoSave = (updatedData: MealsData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')
    // Update store to indicate pending auto-save (debounce period)
    useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'meals', { meals: updatedData })
        setAutoSaveStatus('saved')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })
        setHasUnsavedChanges(false)
        setTimeout(() => {
          setAutoSaveStatus('idle')
          useCampsStore.setState({ autoSaveStatus: 'idle' })
        }, 2000)
      } catch (error) {
        console.error('Failed to save meals data:', error)
        setAutoSaveStatus('error')
        useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...mealsData, description: value }
    setMealsData(updated)
    triggerAutoSave(updated)
  }

  const handleMealsIncludedChange = (values: string[]) => {
    const updated = { ...mealsData, mealsIncluded: values }
    setMealsData(updated)
    triggerAutoSave(updated)
  }

  const handleMealStyleChange = (values: string[]) => {
    const updated = { ...mealsData, mealStyle: values }
    setMealsData(updated)
    triggerAutoSave(updated)
  }

  const toggleDietaryOption = (optionId: string) => {
    const updated = {
      ...mealsData,
      dietaryOptions: mealsData.dietaryOptions.includes(optionId)
        ? mealsData.dietaryOptions.filter(id => id !== optionId)
        : [...mealsData.dietaryOptions, optionId],
    }
    setMealsData(updated)
    triggerAutoSave(updated)
  }

  const addCustomDietaryOption = (optionName: string) => {
    const updated = {
      ...mealsData,
      customDietaryOptions: [...mealsData.customDietaryOptions, optionName],
    }
    setMealsData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomDietaryOption = (index: number) => {
    const updated = {
      ...mealsData,
      customDietaryOptions: mealsData.customDietaryOptions.filter((_, i) => i !== index),
    }
    setMealsData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Meals</h1>
          <p className="text-base leading-normal text-default-500">
            Describe the meals and dietary options at your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-8">
        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <label className="text-sm font-medium text-foreground">Meals Description</label>
            <CharacterCounter current={mealsData.description.length} max={MAX_DESCRIPTION_LENGTH} />
          </div>
          <Textarea
            placeholder="Describe your meal program, food quality, and dining experience..."
            value={mealsData.description}
            onValueChange={handleDescriptionChange}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            classNames={{
              input: 'resize-none',
            }}
          />
          <p className="mt-2.5 text-sm leading-normal text-default-500">
            Include details about meal types, dietary accommodations, and dining facilities
          </p>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Meals Included</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            Select all meals that are included in the camp fee
          </p>
          <CheckboxGroup
            value={mealsData.mealsIncluded}
            onValueChange={handleMealsIncludedChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {MEAL_TYPES.map(meal => (
              <Checkbox
                key={meal.value}
                value={meal.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary after:bg-primary',
                  label: 'ml-2 text-sm w-full',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{meal.label}</div>
                  <div className="text-xs text-default-500">{meal.description}</div>
                </div>
              </Checkbox>
            ))}
          </CheckboxGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Meal Style</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            How are meals served at your camp?
          </p>
          <CheckboxGroup
            value={mealsData.mealStyle}
            onValueChange={handleMealStyleChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {MEAL_STYLE.map(style => (
              <Checkbox
                key={style.value}
                value={style.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary after:bg-primary',
                  label: 'ml-2 text-sm w-full',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{style.label}</div>
                  <div className="text-xs text-default-500">{style.description}</div>
                </div>
              </Checkbox>
            ))}
          </CheckboxGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-start justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">Dietary Options</label>
              <p className="mt-1 text-sm leading-normal text-default-500">
                Select all dietary accommodations you can provide
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {mealsData.dietaryOptions.length} selected
            </span>
          </div>

          <ActivityGrid
            activities={PREDEFINED_DIETARY_OPTIONS}
            selectedActivities={mealsData.dietaryOptions}
            onToggle={toggleDietaryOption}
          />

          {mealsData.customDietaryOptions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {mealsData.customDietaryOptions.map((option, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border-2 border-primary bg-primary/5 px-3 py-2"
                >
                  <span className="text-sm font-medium">{option}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomDietaryOption(index)}
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
              placeholder="e.g., Keto, Paleo..."
              onAdd={addCustomDietaryOption}
              buttonText="Add Dietary Option"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
