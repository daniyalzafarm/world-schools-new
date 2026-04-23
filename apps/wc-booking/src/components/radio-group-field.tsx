'use client'

import React from 'react'

interface RadioOption {
  id: string
  label: string
  description: string
}

interface RadioGroupFieldProps {
  options: readonly RadioOption[] | RadioOption[]
  value: string
  onChange: (value: string) => void
  name: string
  disabled?: boolean
}

/**
 * RadioGroupField Component
 *
 * A radio group component matching the reference design pattern with:
 * - Radio circles with selected state
 * - Label and description for each option
 * - Hover and selected states
 * - Dark mode support
 *
 * Based on the .radio-group and .radio-item pattern from the reference design
 */
export const RadioGroupField: React.FC<RadioGroupFieldProps> = ({
  options,
  value,
  onChange,
  name,
  disabled = false,
}) => {
  return (
    <div className="space-y-2">
      {options.map(option => {
        const isSelected = value === option.id
        return (
          <label
            key={option.id}
            className={`
              flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all
              ${
                isSelected
                  ? 'border-secondary bg-secondary/5 dark:bg-secondary/10'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={() => !disabled && onChange(option.id)}
          >
            {/* Hidden native radio input for accessibility */}
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={isSelected}
              onChange={() => onChange(option.id)}
              disabled={disabled}
              className="sr-only"
            />

            {/* Custom radio circle */}
            <div className="shrink-0 mt-0.5">
              <div
                className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                  ${
                    isSelected
                      ? 'border-secondary bg-secondary'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                  }
                `}
              >
                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>

            {/* Label and description */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                {option.label}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {option.description}
              </div>
            </div>
          </label>
        )
      })}
    </div>
  )
}
