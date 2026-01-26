'use client'

import React from 'react'
import { CheckboxButton } from '@world-schools/ui-web'

const ACTIVITY_OPTIONS = [
  { value: 'sports', label: 'Sports' },
  { value: 'languages', label: 'Languages' },
  { value: 'arts', label: 'Arts & Crafts' },
  { value: 'adventure', label: 'Adventure Activities' },
  { value: 'water', label: 'Water Activities' },
  { value: 'environment', label: 'Environmental Activities' },
  { value: 'academics', label: 'Academics' },
  { value: 'religion', label: 'Religion Programs' },
  { value: 'excursions', label: 'Excursions & Trips' },
]

export interface ProgramsFormData {
  activities: string[]
}

export interface ProgramsFormProps {
  formData: ProgramsFormData
  onChange: (data: Partial<ProgramsFormData>) => void
}

export const ProgramsForm: React.FC<ProgramsFormProps> = ({ formData, onChange }) => {
  const toggleActivity = (value: string) => {
    const newActivities = formData.activities.includes(value)
      ? formData.activities.filter(act => act !== value)
      : [...formData.activities, value]
    onChange({ activities: newActivities })
  }

  return (
    <div className="form-group">
      <label className="text-base font-medium text-foreground">
        Activity Categories <span className="text-danger">*</span>
      </label>
      <div className="mb-2 text-sm leading-normal text-default-500">
        Only editors for selected activities will appear in your dashboard
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {ACTIVITY_OPTIONS.map(activity => (
          <CheckboxButton
            key={activity.value}
            id={`act${activity.value}`}
            value={activity.value}
            label={activity.label}
            checked={formData.activities.includes(activity.value)}
            onChange={() => toggleActivity(activity.value)}
          />
        ))}
      </div>
    </div>
  )
}
