'use client'

import { Select, SelectItem, type SelectProps, SelectSection } from '@heroui/react'
import { cn } from '../utils/cn'

export interface SelectFieldSection {
  title: string
  items: readonly string[] | string[]
}

export interface SelectFieldProps
  extends Omit<SelectProps, 'children' | 'selectedKeys' | 'onSelectionChange' | 'onChange'> {
  value?: string
  onChange: (value: string) => void
  /** Flat array of options (for backward compatibility) */
  options?: readonly string[] | string[]
  /** Grouped sections of options */
  sections?: readonly SelectFieldSection[] | SelectFieldSection[]
}

export function SelectField({
  value,
  onChange,
  options,
  sections,
  placeholder = 'Select option',
  className,
  ...props
}: SelectFieldProps) {
  // Validate that either options or sections is provided, but not both
  if (!options && !sections) {
    throw new Error('SelectField: Either "options" or "sections" prop must be provided')
  }
  if (options && sections) {
    throw new Error('SelectField: Cannot use both "options" and "sections" props simultaneously')
  }

  return (
    <Select
      selectedKeys={value ? [value] : []}
      onSelectionChange={keys => {
        const selectedValue = Array.from(keys)[0] as string
        onChange(selectedValue)
      }}
      placeholder={placeholder}
      labelPlacement="outside"
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
      {...props}
    >
      {options
        ? // Render flat options (backward compatible)
          options.map(option => <SelectItem key={option}>{option}</SelectItem>)
        : // Render grouped sections
          sections!.map(section => (
            <SelectSection key={section.title} title={section.title} showDivider>
              {section.items.map(item => (
                <SelectItem key={item}>{item}</SelectItem>
              ))}
            </SelectSection>
          ))}
    </Select>
  )
}
