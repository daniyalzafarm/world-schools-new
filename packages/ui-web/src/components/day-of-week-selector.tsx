'use client'

import React from 'react'
import { cn } from '../utils/cn'

export interface DayOfWeekSelectorProps {
  value?: number[] // Array of day indices (0 = Sunday, 1 = Monday, etc.)
  onChange?: (value: number[]) => void
  label?: string
  isRequired?: boolean
  isInvalid?: boolean
  errorMessage?: string
  className?: string
  startOnMonday?: boolean
}

const DAYS_SUNDAY_START = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_MONDAY_START = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const DayOfWeekSelector: React.FC<DayOfWeekSelectorProps> = ({
  value = [],
  onChange,
  label,
  isRequired,
  isInvalid,
  errorMessage,
  className,
  startOnMonday = false,
}) => {
  const days = startOnMonday ? DAYS_MONDAY_START : DAYS_SUNDAY_START

  const getDayIndex = (displayIndex: number): number => {
    if (startOnMonday) {
      // Convert Monday-start index to Sunday-start index
      return displayIndex === 6 ? 0 : displayIndex + 1
    }
    return displayIndex
  }

  const isSelected = (displayIndex: number): boolean => {
    const dayIndex = getDayIndex(displayIndex)
    return value.includes(dayIndex)
  }

  const toggleDay = (displayIndex: number) => {
    const dayIndex = getDayIndex(displayIndex)
    const newValue = value.includes(dayIndex)
      ? value.filter(d => d !== dayIndex)
      : [...value, dayIndex].sort((a, b) => a - b)
    onChange?.(newValue)
  }

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-semibold text-foreground">
          {label}
          {isRequired && <span className="ml-1 text-danger">*</span>}
        </label>
      )}
      <div className="flex gap-2">
        {days.map((day, index) => (
          <button
            key={day}
            type="button"
            onClick={() => toggleDay(index)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg border-2 text-sm font-medium transition-all',
              isSelected(index)
                ? 'border-primary bg-primary text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
              isInvalid && 'border-danger'
            )}
          >
            {day}
          </button>
        ))}
      </div>
      {isInvalid && errorMessage && (
        <p className="mt-1.5 text-sm text-danger">{errorMessage}</p>
      )}
    </div>
  )
}

