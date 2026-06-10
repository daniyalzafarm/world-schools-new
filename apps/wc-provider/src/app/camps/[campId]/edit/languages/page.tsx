'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Radio, RadioGroup } from '@heroui/react'
import { getLanguageCode, LanguageSelect, Textarea } from '@world-schools/ui-web'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useAutosave } from '../../../../../hooks/useAutosave'
import {
  LANGUAGE_PROFICIENCY_LEVELS,
  TEACHING_METHODS,
} from '../../../../../constants/languages-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface LanguagesData {
  description: string
  proficiency: string
  methodology: string
  selectedLanguages: string[]
  customLanguages: string[]
}

export default function LanguagesEditorPage() {
  const params = useParams()
  const campId = params.campId as string

  const { currentCamp, updateSection } = useCampsStore()

  const [languagesData, setLanguagesData] = useState<LanguagesData>({
    description: '',
    proficiency: 'all',
    methodology: 'mixed',
    selectedLanguages: [],
    customLanguages: [],
  })
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (currentCamp?.languagePrograms) {
      setLanguagesData({
        description: currentCamp.languagePrograms.description || '',
        proficiency: (currentCamp.languagePrograms as any).proficiency || 'all',
        methodology: (currentCamp.languagePrograms as any).methodology || 'mixed',
        selectedLanguages: (currentCamp.languagePrograms as any).selectedLanguages || [],
        customLanguages: (currentCamp.languagePrograms as any).customLanguages || [],
      })
      setIsLoaded(true)
    } else if (currentCamp) {
      setIsLoaded(true)
    }
  }, [currentCamp])

  useAutosave(languagesData, {
    enabled: isLoaded,
    save: async data => {
      await updateSection(campId, 'languages', { languagePrograms: data })
    },
  })

  const handleDescriptionChange = (value: string) => {
    const updated = { ...languagesData, description: value }
    setLanguagesData(updated)
  }

  const handleProficiencyLevelChange = (value: string) => {
    const updated = { ...languagesData, proficiency: value }
    setLanguagesData(updated)
  }

  const handleTeachingMethodChange = (value: string) => {
    const updated = { ...languagesData, methodology: value }
    setLanguagesData(updated)
  }

  // Known languages resolve to canonical ISO codes; anything unresolvable is a
  // custom free-text language. Keep the two stored arrays so the data shape and
  // downstream consumers are unchanged.
  const selectedLanguageValues = [
    ...languagesData.selectedLanguages.map(lang => getLanguageCode(lang) || lang),
    ...languagesData.customLanguages,
  ]

  const handleLanguagesChange = (values: string[]) => {
    setLanguagesData({
      ...languagesData,
      selectedLanguages: values
        .filter(value => getLanguageCode(value))
        .map(value => getLanguageCode(value)),
      customLanguages: values.filter(value => !getLanguageCode(value)),
    })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Language Programs</h1>
        <p className="text-base leading-normal text-default-500">
          Describe the language learning programs at your camp
        </p>
      </div>

      <div className="space-y-8">
        {/* Description */}
        <div className="form-group">
          <Textarea
            label="Language Program Description"
            placeholder="Describe your language program, teaching approach, and what makes it effective..."
            value={languagesData.description}
            onChange={e => handleDescriptionChange(e.target.value)}
            minRows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            showCharacterCount
            description="Include details about class structure, teacher qualifications, and learning outcomes"
          />
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
            value={languagesData.proficiency}
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
            value={languagesData.methodology}
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
                Select all languages taught at your camp — type to add a custom language
              </p>
            </div>
            <span className="rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-700">
              {selectedLanguageValues.length} selected
            </span>
          </div>

          <LanguageSelect
            allowCustom
            value={selectedLanguageValues}
            onChange={handleLanguagesChange}
            placeholder="Add language (or type a custom one)"
          />
        </div>
      </div>
    </div>
  )
}
