'use client'

import { Select, SelectItem } from '@heroui/react'
import { cn } from '../utils/cn'

interface SelectFieldProps {
  value?: string
  onChange: (value: string) => void
  options: readonly string[] | string[]
  placeholder?: string
  className?: string
  label?: string
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder = 'Select option',
  className,
  label,
}: SelectFieldProps) {
  return (
    <Select
      selectedKeys={value ? [value] : []}
      onSelectionChange={keys => {
        const selectedValue = Array.from(keys)[0] as string
        onChange(selectedValue)
      }}
      placeholder={placeholder}
      className={cn('w-full', className)}
      classNames={{
        trigger: cn(
          'rounded-lg bg-white',
          'border border-gray-200',
          'hover:border-gray-300',
          'focus-within:border-primary',
          'focus-within:!bg-white',
          'dark:border-gray-600'
        ),
        value: 'text-md text-gray-900 dark:text-gray-100',
        popoverContent: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
      }}
      aria-label={label}
    >
      {options.map(option => (
        <SelectItem key={option}>{option}</SelectItem>
      ))}
    </Select>
  )
}
