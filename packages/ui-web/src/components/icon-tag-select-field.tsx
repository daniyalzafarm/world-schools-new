'use client'

import React from 'react'
import { Avatar, Chip, cn, Select, type Selection, SelectItem } from '@heroui/react'
import { X } from 'lucide-react'

export interface IconTagItem {
  id: string
  label: string
  icon?: string
  [key: string]: any // Allow additional properties
}

export interface IconTagSelectFieldProps {
  value: string[]
  onChange: (value: string[]) => void
  items: IconTagItem[]
  placeholder?: string
  disabled?: boolean
  /** Optional function to customize how icons are rendered. Receives the item and should return a React node */
  renderIcon?: (item: IconTagItem) => React.ReactNode
  [key: string]: any
}

/**
 * IconTagSelectField Component
 *
 * A tag select field component with icon/avatar support using HeroUI's native Select with multi-select functionality.
 * Features:
 * - Tag pills with icons/avatars and closeable X buttons
 * - Multi-select dropdown with icon display
 * - Flexible icon rendering (emoji, avatar URL, or custom React component)
 * - Keyboard navigation
 * - Dark mode support
 *
 * Uses HeroUI v2 Select component with selectionMode="multiple"
 */
export const IconTagSelectField: React.FC<IconTagSelectFieldProps> = ({
  value,
  onChange,
  items,
  placeholder = 'Select items',
  disabled = false,
  renderIcon,
  ...props
}) => {
  // Deduplicate the value array to prevent duplicate chips
  const uniqueValue = React.useMemo(() => Array.from(new Set(value)), [value])

  // Convert string array to Set for HeroUI Select
  const selectedKeys = new Set(uniqueValue)

  // Get item by ID
  const getItemById = React.useCallback((id: string) => items.find(item => item.id === id), [items])

  const handleSelectionChange = (keys: Selection) => {
    // Convert Selection (Set or "all") back to string array
    if (keys === 'all') {
      onChange(items.map(item => item.id))
    } else {
      onChange(Array.from(keys) as string[])
    }
  }

  const handleRemoveTag = (idToRemove: string) => {
    onChange(value.filter(id => id !== idToRemove))
  }

  // Default icon renderer - supports emoji strings and avatar URLs
  const defaultRenderIcon = React.useCallback((item: IconTagItem) => {
    if (!item.icon) return null

    // Check if icon is a URL (avatar image)
    if (item.icon.startsWith('http://') || item.icon.startsWith('https://')) {
      return <Avatar src={item.icon} alt={item.label} className="shrink-0" size="sm" />
    }

    // Otherwise treat as emoji or text
    return <span className="text-base shrink-0">{item.icon}</span>
  }, [])

  const iconRenderer = renderIcon ?? defaultRenderIcon

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
      items={items}
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
      renderValue={renderItems => {
        if (renderItems.length === 0) {
          return <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
        }

        return (
          <div className="flex flex-wrap gap-2">
            {uniqueValue.map(id => {
              const item = getItemById(id)
              if (!item) return null

              return (
                <Chip
                  key={id}
                  variant="flat"
                  classNames={{
                    base: 'bg-slate-100 dark:bg-slate-700',
                    content: 'text-slate-700 dark:text-slate-300 font-medium',
                  }}
                  startContent={iconRenderer(item)}
                  endContent={
                    <span
                      role="button"
                      tabIndex={disabled ? -1 : 0}
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!disabled) {
                          handleRemoveTag(id)
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
                          handleRemoveTag(id)
                        }
                      }}
                      className={cn(
                        'cursor-pointer ml-1 hover:text-slate-900 dark:hover:text-white transition-colors',
                        disabled && 'cursor-not-allowed opacity-50'
                      )}
                      aria-label={`Remove ${item.label}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  }
                >
                  {item.label}
                </Chip>
              )
            })}
          </div>
        )
      }}
      {...props}
    >
      {item => (
        <SelectItem key={item.id} textValue={item.label}>
          <div className="flex gap-2 items-center">
            {iconRenderer(item)}
            <span className="text-small">{item.label}</span>
          </div>
        </SelectItem>
      )}
    </Select>
  )
}
