'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Checkbox, CheckboxGroup, Radio, RadioGroup } from '@heroui/react'
import { Textarea } from '@world-schools/ui-web'
import {
  MEAL_STYLE,
  MEAL_TYPES,
  PREDEFINED_DIETARY_OPTIONS,
} from '@world-schools/wc-frontend-utils'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useAutosave } from '../../../../../hooks/useAutosave'
import { ActivityGrid } from '../../../../../components/camp-editor/ActivityGrid'

const MAX_DESCRIPTION_LENGTH = 1200

interface MealsData {
  description: string
  mealTypes: string[]
  mealStyle: string
  dietaryOptions: string[]
}

export default function MealsEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection } = useCampsStore()

  const [mealsData, setMealsData] = useState<MealsData>({
    description: '',
    mealTypes: [],
    mealStyle: '',
    dietaryOptions: [],
  })
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (currentCamp?.meals) {
      setMealsData({
        description: (currentCamp.meals as any).description || '',
        mealTypes: (currentCamp.meals as any).mealTypes || [],
        mealStyle: (currentCamp.meals as any).mealStyle || '',
        dietaryOptions: (currentCamp.meals as any).dietaryOptions || [],
      })
      setIsLoaded(true)
    } else if (currentCamp) {
      setIsLoaded(true)
    }
  }, [currentCamp])

  useAutosave(mealsData, {
    enabled: isLoaded,
    save: async data => {
      await updateSection(campId, 'meals', { meals: data })
    },
  })

  const handleDescriptionChange = (value: string) => {
    const updated = { ...mealsData, description: value }
    setMealsData(updated)
  }

  const handleMealTypesChange = (values: string[]) => {
    const updated = { ...mealsData, mealTypes: values }
    setMealsData(updated)
  }

  const handleMealStyleChange = (value: string) => {
    const updated = { ...mealsData, mealStyle: value }
    setMealsData(updated)
  }

  const toggleDietaryOption = (optionId: string) => {
    const updated = {
      ...mealsData,
      dietaryOptions: mealsData.dietaryOptions.includes(optionId)
        ? mealsData.dietaryOptions.filter(id => id !== optionId)
        : [...mealsData.dietaryOptions, optionId],
    }
    setMealsData(updated)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Meals</h1>
        <p className="text-base leading-normal text-default-500">
          Describe the meals and dietary options at your camp
        </p>
      </div>

      <div className="space-y-8">
        <div className="form-group">
          <Textarea
            label="Meals Description"
            placeholder="Describe your meal program, food quality, and dining experience..."
            value={mealsData.description}
            onChange={e => handleDescriptionChange(e.target.value)}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            showCharacterCount
            description="Include details about meal types, dietary accommodations, and dining facilities"
          />
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Meals Included</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            Select all meals that are included in the camp fee
          </p>
          <CheckboxGroup
            value={mealsData.mealTypes}
            onValueChange={handleMealTypesChange}
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
          <RadioGroup
            value={mealsData.mealStyle}
            onValueChange={handleMealStyleChange}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {MEAL_STYLE.map(style => (
              <Radio
                key={style.value}
                value={style.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{style.label}</div>
                  <div className="text-xs text-default-500">{style.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
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
        </div>
      </div>
    </div>
  )
}
