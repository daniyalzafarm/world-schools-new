'use client'

import { Select, SelectItem, type SelectProps, SelectSection } from '@heroui/react'
import { cn } from '../utils/cn'
import { mergeClassNames } from '../utils/merge-class-names'

export interface SelectFieldSection {
  title: string
  items: readonly string[] | string[]
}

export interface SelectFieldOptionObject {
  value: string
  label: string
}

export type SelectFieldOption = string | SelectFieldOptionObject

export interface SelectFieldProps
  extends Omit<
    SelectProps,
    'children' | 'selectedKeys' | 'onSelectionChange' | 'onChange' | 'classNames'
  > {
  value?: string
  onChange: (value: string) => void
  /** Flat array of options (for backward compatibility) */
  options?: readonly SelectFieldOption[] | SelectFieldOption[]
  /** Grouped sections of options */
  sections?: readonly SelectFieldSection[] | SelectFieldSection[]
  classNames?: SelectProps['classNames']
}

export function SelectField({
  value,
  onChange,
  options,
  sections,
  placeholder = 'Select option',
  className,
  classNames: customClassNames,
  fullWidth = true,
  ...props
}: SelectFieldProps) {
  // Validate that either options or sections is provided, but not both
  if (!options && !sections) {
    throw new Error('SelectField: Either "options" or "sections" prop must be provided')
  }
  if (options && sections) {
    throw new Error('SelectField: Cannot use both "options" and "sections" props simultaneously')
  }

  const mergedClassNames = mergeClassNames(
    {
      base: cn(
        !fullWidth && 'w-fit min-w-0 shrink-0 max-w-[min(100%,24rem)]',
        'data-[invalid=true]:mt-0'
      ),
      mainWrapper: !fullWidth ? 'w-fit' : undefined,
      // w-full inside padded trigger so label does not run under the absolute chevron.
      innerWrapper: !fullWidth ? 'w-full min-w-0 max-w-full' : undefined,
      value: !fullWidth ? 'min-w-0 max-w-full' : undefined,
      // pr-10 keeps label from sitting under the absolute selector icon when trigger is w-fit.
      trigger: cn(
        !fullWidth && 'w-fit min-w-0 ps-3 pe-10',
        'rounded-lg bg-white capitalize',
        'border border-gray-200',
        'hover:border-gray-300',
        'aria-expanded:border-primary!',
        'aria-expanded:bg-white!',
        'data-focus:outline-none',
        'data-focus:border-primary!',
        'dark:border-gray-600'
      ),
      // HeroUI sets popover width to the trigger width; min-w-max lets the list match long options.
      popoverContent: !fullWidth ? 'min-w-max max-w-[min(100vw,24rem)]' : undefined,
    },
    customClassNames
  ) satisfies SelectProps['classNames']

  return (
    <Select
      fullWidth={fullWidth}
      selectedKeys={value ? [value] : []}
      onSelectionChange={keys => {
        const selectedValue = Array.from(keys)[0] as string
        onChange(selectedValue)
      }}
      placeholder={placeholder}
      labelPlacement="outside"
      classNames={mergedClassNames}
      className={className}
      {...props}
    >
      {options
        ? // Render flat options (supports strings and { value, label } objects)
          options.map(option => {
            if (typeof option === 'string') {
              return (
                <SelectItem key={option} className="capitalize">
                  {option}
                </SelectItem>
              )
            }

            return (
              <SelectItem key={option.value} className="capitalize">
                {option.label}
              </SelectItem>
            )
          })
        : // Render grouped sections
          (sections ?? []).map(section => (
            <SelectSection key={section.title} title={section.title} showDivider>
              {section.items.map(item => (
                <SelectItem key={item}>{item}</SelectItem>
              ))}
            </SelectSection>
          ))}
    </Select>
  )
}
