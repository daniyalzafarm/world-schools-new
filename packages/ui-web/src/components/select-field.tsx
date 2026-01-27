'use client'

import { Select, SelectItem, type SelectProps } from '@heroui/react'
import { cn } from '../utils/cn'

export interface SelectFieldProps
  extends Omit<SelectProps, 'children' | 'selectedKeys' | 'onSelectionChange' | 'onChange'> {
  value?: string
  onChange: (value: string) => void
  options: readonly string[] | string[]
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder = 'Select option',
  className,
  ...props
}: SelectFieldProps) {
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
      {options.map(option => (
        <SelectItem key={option}>{option}</SelectItem>
      ))}
    </Select>
  )
}
