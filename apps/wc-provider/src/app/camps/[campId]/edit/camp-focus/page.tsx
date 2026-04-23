'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Radio, RadioGroup } from '@heroui/react'
import { Textarea, useConfirmDialog } from '@world-schools/ui-web'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useAutosave } from '../../../../../hooks/useAutosave'
import { SingleSelectActivityGrid } from '../../../../../components/camp-editor/SingleSelectActivityGrid'
import { CampFocusDisplayCard } from '../../../../../components/camp-editor/CampFocusDisplayCard'
import { CAMP_PHILOSOPHY, LEARNING_APPROACH } from '../../../../../constants/camp-focus-activities'
import {
  type ActivityWithCategory,
  getActivitiesByCategory,
} from '../../../../../utils/camp-focus-activities'
import type { PrimaryFocus } from '../../../../../types/camps'

const MAX_DESCRIPTION_LENGTH = 1200

interface CampFocusData {
  primaryFocus: PrimaryFocus | null
  description: string
  philosophy: string
  learningApproach: string
}

export default function CampFocusEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection } = useCampsStore()
  const { confirm } = useConfirmDialog()

  const [focusData, setFocusData] = useState<CampFocusData>({
    primaryFocus: null,
    description: '',
    philosophy: 'holistic',
    learningApproach: 'experiential',
  })
  const [isLoaded, setIsLoaded] = useState(false)

  const activityCategories = getActivitiesByCategory(currentCamp)

  useEffect(() => {
    if (currentCamp?.campFocus) {
      setFocusData({
        primaryFocus: (currentCamp.campFocus as any).primaryFocus || null,
        description: currentCamp.campFocus.description || '',
        philosophy: (currentCamp.campFocus as any).philosophy || 'holistic',
        learningApproach: (currentCamp.campFocus as any).learningApproach || 'experiential',
      })
      setIsLoaded(true)
    } else if (currentCamp) {
      setIsLoaded(true)
    }
  }, [currentCamp])

  useAutosave(focusData, {
    enabled: isLoaded,
    save: async data => {
      await updateSection(campId, 'camp-focus', { campFocus: data })
    },
  })

  const handleRemoveFocus = async () => {
    if (!focusData.primaryFocus) return

    const confirmed = await confirm({
      title: 'Remove Camp Focus?',
      message: `Are you sure you want to remove ${focusData.primaryFocus.activityName} as your camp's primary focus? Your camp will no longer appear as a specialized camp in this activity.`,
      confirmText: 'Remove Focus',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (confirmed) {
      setFocusData({ ...focusData, primaryFocus: null })
    }
  }

  const handleActivitySelect = (activity: ActivityWithCategory) => {
    setFocusData({
      ...focusData,
      primaryFocus: {
        activityId: activity.id,
        activityName: activity.name,
        categoryId: activity.categoryId,
        categoryName: activity.categoryName,
        icon: activity.icon,
      },
    })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Camp Focus</h1>
        <p className="text-base leading-normal text-default-500">
          Does your camp specialize in a specific activity? Select your primary focus to
          differentiate your camp (e.g., "Soccer Camp" vs a camp that offers soccer). This will be
          prominently displayed in your camp profile. Not all camps need a focus - only select one
          if your camp truly specializes.
        </p>
      </div>

      <div className="space-y-8">
        <CampFocusDisplayCard primaryFocus={focusData.primaryFocus} onRemove={handleRemoveFocus} />

        {activityCategories.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-default-300 bg-default-50 p-8 text-center">
            <p className="text-default-600">
              No program activities selected yet. Please select program categories in the{' '}
              <strong>Programs</strong> section first to choose a camp focus.
            </p>
          </div>
        ) : (
          activityCategories.map(category => (
            <div key={category.id} className="form-group">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{category.name}</h3>
                  <p className="text-sm text-default-500">{category.activities.length} available</p>
                </div>
              </div>
              <SingleSelectActivityGrid
                activities={category.activities}
                selectedActivityId={focusData.primaryFocus?.activityId || null}
                onSelect={handleActivitySelect}
              />
            </div>
          ))
        )}

        <div className="form-group">
          <Textarea
            label="Camp Focus Description (Optional)"
            placeholder="Describe why this activity is your camp's focus and what makes your program special..."
            value={focusData.description}
            onChange={e => setFocusData({ ...focusData, description: e.target.value })}
            minRows={4}
            maxLength={MAX_DESCRIPTION_LENGTH}
            showCharacterCount
            description="Explain your camp's approach to this activity and what campers will learn"
          />
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Camp Philosophy</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            What is the overall philosophy of your camp?
          </p>
          <RadioGroup
            value={focusData.philosophy}
            onValueChange={value => setFocusData({ ...focusData, philosophy: value })}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {CAMP_PHILOSOPHY.map(phil => (
              <Radio
                key={phil.value}
                value={phil.value}
                classNames={{
                  base: 'flex-1 min-w-[calc(50%-6px)] m-0 bg-transparent hover:bg-transparent items-start',
                  wrapper: 'group-data-[selected=true]:border-primary',
                  labelWrapper: 'ml-2',
                  label: 'text-sm',
                }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-foreground">{phil.label}</div>
                  <div className="text-xs text-default-500">{phil.description}</div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div className="form-group">
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Learning Approach</label>
          </div>
          <p className="mb-2.5 text-sm leading-normal text-default-500">
            How do campers learn and develop at your camp?
          </p>
          <RadioGroup
            value={focusData.learningApproach}
            onValueChange={value => setFocusData({ ...focusData, learningApproach: value })}
            classNames={{
              wrapper: 'flex flex-row flex-wrap gap-3',
            }}
          >
            {LEARNING_APPROACH.map(approach => (
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
      </div>
    </div>
  )
}
