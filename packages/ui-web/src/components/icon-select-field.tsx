'use client'

import React from 'react'
import { Avatar, Select, SelectItem, type SelectProps } from '@heroui/react'
import { cn } from '../utils/cn'

export interface IconSelectOption {
  label: string
  value: string
  icon?: string // Optional emoji or icon string
}

export interface IconSelectFieldProps extends Omit<
  SelectProps,
  'children' | 'selectedKeys' | 'onSelectionChange' | 'onChange' | 'items'
> {
  value?: string
  onChange: (value: string) => void
  options?: readonly IconSelectOption[] | IconSelectOption[]
  placeholder?: string
  /** Optional function to customize how icons are rendered. Receives the option and should return a React node */
  renderIcon?: (option: IconSelectOption) => React.ReactNode
}

/**
 * IconSelectField Component
 *
 * A single-select field component with icon support using HeroUI's native Select.
 * Features:
 * - Icon display in dropdown items and selected value
 * - Flexible icon rendering (emoji, avatar URL, or custom React component)
 * - Matches SelectField styling and behavior
 * - Keyboard navigation
 * - Dark mode support
 *
 * Uses HeroUI v2 Select component with single selection mode
 */
export function IconSelectField({
  value,
  onChange,
  options = [],
  placeholder = 'Select option',
  className,
  renderIcon,
  ...props
}: IconSelectFieldProps) {
  // Get option by value
  const getOptionByValue = React.useCallback(
    (val: string) => options.find(option => option.value === val),
    [options]
  )

  // Default icon renderer - supports emoji strings and avatar URLs
  const defaultRenderIcon = React.useCallback((option: IconSelectOption) => {
    if (!option.icon) return null

    // Check if icon is a URL (avatar image)
    if (option.icon.startsWith('http://') || option.icon.startsWith('https://')) {
      return <Avatar src={option.icon} alt={option.label} className="shrink-0" size="sm" />
    }

    // Otherwise treat as emoji or text
    return <span className="text-base shrink-0">{option.icon}</span>
  }, [])

  const iconRenderer = renderIcon ?? defaultRenderIcon

  return (
    <Select
      selectedKeys={value ? [value] : []}
      onSelectionChange={keys => {
        const selectedValue = Array.from(keys)[0] as string
        onChange(selectedValue)
      }}
      placeholder={placeholder}
      labelPlacement="outside"
      items={options}
      classNames={{
        trigger: cn(
          'rounded-lg bg-white',
          'border border-gray-200',
          'hover:border-gray-300',
          'aria-expanded:border-primary!',
          'aria-expanded:bg-white!',
          'data-focus:outline-none',
          'data-focus:border-primary!',
          'dark:border-gray-600',
          className
        ),
      }}
      renderValue={renderItems => {
        if (renderItems.length === 0 || !value) {
          return <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
        }

        const selectedOption = getOptionByValue(value)
        if (!selectedOption) {
          return <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
        }

        return (
          <div className="flex gap-2 items-center">
            {iconRenderer(selectedOption)}
            <span className="text-small">{selectedOption.label}</span>
          </div>
        )
      }}
      {...props}
    >
      {(option: IconSelectOption) => (
        <SelectItem key={option.value} textValue={option.label}>
          <div className="flex gap-2 items-center">
            {iconRenderer(option)}
            <span className="text-small">{option.label}</span>
          </div>
        </SelectItem>
      )}
    </Select>
  )
}
