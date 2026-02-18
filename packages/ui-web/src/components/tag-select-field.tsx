'use client'

import React from 'react'
import { Chip, cn, Select, type Selection, SelectItem } from '@heroui/react'
import { X } from 'lucide-react'

export interface TagSelectFieldProps {
  value: string[]
  onChange: (value: string[]) => void
  suggestions?: string[]
  placeholder?: string
  disabled?: boolean
  /** Optional function to customize how each item is rendered */
  itemTemplate?: (value: string) => React.ReactNode
  [key: string]: any
}

/**
 * TagSelectField Component
 *
 * A tag select field component using HeroUI's native Select with multi-select functionality.
 * Features:
 * - Tag pills with closeable X buttons
 * - Multi-select dropdown with suggestions
 * - Keyboard navigation
 * - Dark mode support
 *
 * Uses HeroUI v2 Select component with selectionMode="multiple"
 */
export const TagSelectField: React.FC<TagSelectFieldProps> = ({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add location',
  disabled = false,
  itemTemplate,
  ...props
}) => {
  // Deduplicate the value array to prevent duplicate chips
  const uniqueValue = React.useMemo(() => Array.from(new Set(value)), [value])

  // Convert string array to Set for HeroUI Select
  const selectedKeys = new Set(uniqueValue)

  const handleSelectionChange = (keys: Selection) => {
    // Convert Selection (Set or "all") back to string array
    if (keys === 'all') {
      onChange(suggestions)
    } else {
      onChange(Array.from(keys) as string[])
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove))
  }

  return (
    <Select
      className="w-full"
      placeholder={placeholder}
      labelPlacement="outside"
      selectionMode="multiple"
      selectedKeys={selectedKeys}
      onSelectionChange={handleSelectionChange}
      isDisabled={disabled}
      isMultiline={true}
      classNames={{
        trigger: cn(
          'rounded-lg bg-white',
          'border border-gray-200',
          'hover:border-gray-300',
          'aria-expanded:border-primary!',
          'aria-expanded:bg-white!',
          'data-focus:outline-none',
          'data-focus:border-primary!',
          'dark:border-gray-600'
        ),
      }}
      renderValue={items => {
        if (items.length === 0) {
          return <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
        }

        return (
          <div className="flex flex-wrap gap-2">
            {uniqueValue.map(tag => (
              <Chip
                key={tag}
                variant="flat"
                classNames={{
                  base: 'bg-slate-100 dark:bg-slate-700',
                  content: 'text-slate-700 dark:text-slate-300 font-medium',
                }}
                endContent={
                  <span
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (!disabled) {
                        handleRemoveTag(tag)
                      }
                    }}
                    onMouseDown={e => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onPointerDown={e => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onTouchStart={e => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onKeyDown={e => {
                      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        e.stopPropagation()
                        handleRemoveTag(tag)
                      }
                    }}
                    className={cn(
                      'cursor-pointer ml-1 hover:text-slate-900 dark:hover:text-white transition-colors',
                      disabled && 'cursor-not-allowed opacity-50'
                    )}
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                }
              >
                {itemTemplate ? itemTemplate(tag) : tag}
              </Chip>
            ))}
          </div>
        )
      }}
      {...props}
    >
      {suggestions.map(suggestion => (
        <SelectItem key={suggestion}>
          {itemTemplate ? itemTemplate(suggestion) : suggestion}
        </SelectItem>
      ))}
    </Select>
  )
}

