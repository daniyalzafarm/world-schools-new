'use client'

import React, { useMemo } from 'react'
import { Button } from '@heroui/react'
import { getLanguageCode, Input, LanguageSelect, RadioButton } from '@world-schools/ui-web'
import { Trash2 } from 'lucide-react'
import type { AgeGroup, Gender } from '../../types/camps'

export interface AudienceFormData {
  ageGroups: AgeGroup[]
  languages: string[]
  gender: Gender
}

export interface AudienceFormProps {
  formData: AudienceFormData
  onChange: (data: Partial<AudienceFormData>) => void
  onValidationChange?: (hasErrors: boolean) => void
  /**
   * When true (camp editor, not the create wizard), shows an impact warning:
   * age groups feed per-age-group session pricing/availability and the
   * eligibility gate, so changing them affects existing sessions and bookings.
   */
  editContext?: boolean
}

interface AgeGroupError {
  min?: string
  max?: string
  overlap?: string
}

export const AudienceForm: React.FC<AudienceFormProps> = ({
  formData,
  onChange,
  onValidationChange,
  editContext = false,
}) => {
  // Validate individual age group
  const validateAgeGroup = (ageGroup: AgeGroup): AgeGroupError => {
    const errors: AgeGroupError = {}

    // Check for empty values (0 is used as sentinel for empty)
    if (ageGroup.min === 0) {
      errors.min = 'Min age is required'
    } else if (ageGroup.min < 4) {
      errors.min = 'Min age must be at least 4'
    } else if (ageGroup.min > 18) {
      errors.min = 'Min age cannot exceed 18'
    }

    if (ageGroup.max === 0) {
      errors.max = 'Max age is required'
    } else if (ageGroup.max < 4) {
      errors.max = 'Max age must be at least 4'
    } else if (ageGroup.max > 18) {
      errors.max = 'Max age cannot exceed 18'
    }

    // Check if max > min (only if both are non-zero)
    if (ageGroup.min > 0 && ageGroup.max > 0 && ageGroup.max <= ageGroup.min) {
      errors.max = 'Max age must be greater than min age'
    }

    return errors
  }

  // Check for overlapping age ranges
  const checkOverlap = (index: number): string | undefined => {
    const currentGroup = formData.ageGroups[index]

    // Skip overlap check if current group has empty values
    if (currentGroup.min === 0 || currentGroup.max === 0) {
      return undefined
    }

    for (let i = 0; i < formData.ageGroups.length; i++) {
      if (i === index) continue

      const otherGroup = formData.ageGroups[i]

      // Skip overlap check if other group has empty values
      if (otherGroup.min === 0 || otherGroup.max === 0) {
        continue
      }

      // Check if ranges overlap
      // Overlap occurs if: (start1 <= end2) AND (end1 >= start2)
      if (currentGroup.min <= otherGroup.max && currentGroup.max >= otherGroup.min) {
        return `Age range overlaps with group ${i + 1} (${otherGroup.min}-${otherGroup.max})`
      }
    }

    return undefined
  }

  // Compute all validation errors
  const ageGroupErrors = useMemo(() => {
    return formData.ageGroups.map((group, index) => {
      const errors = validateAgeGroup(group)
      const overlapError = checkOverlap(index)

      if (overlapError) {
        errors.overlap = overlapError
      }

      return errors
    })
  }, [formData.ageGroups])

  // Check if form has any errors
  const hasErrors = useMemo(() => {
    return ageGroupErrors.some(errors => errors.min || errors.max || errors.overlap)
  }, [ageGroupErrors])

  // Notify parent component of validation state changes
  React.useEffect(() => {
    if (onValidationChange) {
      onValidationChange(hasErrors)
    }
  }, [hasErrors, onValidationChange])

  const handleAddAgeGroup = () => {
    // Get the last age group to calculate smart defaults
    const lastGroup = formData.ageGroups[formData.ageGroups.length - 1]

    // Calculate the range difference of the previous group
    const difference = lastGroup.max - lastGroup.min

    // Set new minimum to previous max + 1
    const newMin = lastGroup.max + 1

    // Set new maximum to newMin + difference
    let newMax = newMin + difference

    // Apply the 18-year cap
    if (newMax > 18) {
      newMax = 18
    }

    // Validate the result - if newMax <= newMin, set to empty values (0)
    const newAgeGroup = newMax <= newMin ? { min: 0, max: 0 } : { min: newMin, max: newMax }

    onChange({
      ageGroups: [...formData.ageGroups, newAgeGroup],
    })
  }

  const handleRemoveAgeGroup = (index: number) => {
    if (formData.ageGroups.length > 1) {
      onChange({
        ageGroups: formData.ageGroups.filter((_, i) => i !== index),
      })
    }
  }

  const handleAgeGroupChange = (index: number, field: 'min' | 'max', value: string) => {
    const numValue = parseInt(value) || 0
    const newAgeGroups = [...formData.ageGroups]
    newAgeGroups[index] = { ...newAgeGroups[index], [field]: numValue }
    onChange({ ageGroups: newAgeGroups })
  }

  return (
    <div className="flex flex-col gap-4">
      {editContext ? (
        <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          Changing age groups affects this camp&apos;s sessions (per-age-group pricing and
          availability) and which children are eligible to book. Review your sessions after saving.
        </div>
      ) : null}
      {/* Age Groups */}
      <div className="form-group">
        <label className="text-base font-medium text-foreground">
          Age Groups <span className="text-danger">*</span>
        </label>
        <div className="mb-2 text-sm leading-normal text-default-500">
          Add one group if all ages are together, or multiple groups if you separate by age
        </div>
        <div className="flex flex-col gap-3">
          {formData.ageGroups.map((ageGroup, index) => {
            const errors = ageGroupErrors[index]
            const hasError = errors && (errors.min || errors.max || errors.overlap)

            return (
              <div key={index} className="flex flex-col gap-1.5">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="Min age"
                      min={4}
                      max={18}
                      value={ageGroup.min === 0 ? '' : ageGroup.min.toString()}
                      onChange={e => handleAgeGroupChange(index, 'min', e.target.value)}
                      isInvalid={!!errors?.min}
                      classNames={{
                        inputWrapper: errors?.min
                          ? 'border-danger hover:border-danger focus-within:border-danger'
                          : '',
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="Max age"
                      min={4}
                      max={18}
                      value={ageGroup.max === 0 ? '' : ageGroup.max.toString()}
                      onChange={e => handleAgeGroupChange(index, 'max', e.target.value)}
                      isInvalid={!!errors?.max}
                      classNames={{
                        inputWrapper: errors?.max
                          ? 'border-danger hover:border-danger focus-within:border-danger'
                          : '',
                      }}
                    />
                  </div>
                  {formData.ageGroups.length != 1 && (
                    <Button
                      onPress={() => handleRemoveAgeGroup(index)}
                      isIconOnly
                      variant="light"
                      color="danger"
                      className="mt-0.5"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
                {/* Error Messages */}
                {hasError && (
                  <div className="flex flex-col gap-1 px-1">
                    {errors.min && <p className="text-xs text-danger">{errors.min}</p>}
                    {errors.max && !errors.min && (
                      <p className="text-xs text-danger">{errors.max}</p>
                    )}
                    {errors.overlap && <p className="text-xs text-danger">{errors.overlap}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <Button
          onPress={handleAddAgeGroup}
          size="md"
          variant="bordered"
          className="mt-3 w-full border-dashed"
        >
          + Add age group
        </Button>
      </div>

      {/* Languages */}
      <div className="form-group">
        <label className="text-base font-medium text-foreground">
          Main Languages <span className="text-danger">*</span>
        </label>
        <div className="mb-2 text-sm leading-normal text-default-500">
          Select all languages used for activities and communication
        </div>
        <LanguageSelect
          value={formData.languages.map(lang => getLanguageCode(lang) || lang)}
          onChange={languages => onChange({ languages })}
          placeholder="Add language"
        />
      </div>

      {/* Gender */}
      <div className="form-group">
        <label className="text-base font-medium text-foreground">
          Gender <span className="text-danger">*</span>
        </label>
        <div className="mt-2 flex gap-3">
          <RadioButton
            id="genderCoed"
            name="gender"
            value="coed"
            label="Coed"
            checked={formData.gender === 'coed'}
            onChange={value => onChange({ gender: value as Gender })}
          />
          <RadioButton
            id="genderBoys"
            name="gender"
            value="boys"
            label="Boys Only"
            checked={formData.gender === 'boys'}
            onChange={value => onChange({ gender: value as Gender })}
          />
          <RadioButton
            id="genderGirls"
            name="gender"
            value="girls"
            label="Girls Only"
            checked={formData.gender === 'girls'}
            onChange={value => onChange({ gender: value as Gender })}
          />
        </div>
      </div>
    </div>
  )
}
