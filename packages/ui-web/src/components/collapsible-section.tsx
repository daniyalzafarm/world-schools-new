'use client'

import React, { useState } from 'react'
import { Button } from '@heroui/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../utils/cn'

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  isExpanded?: boolean
  onToggle?: () => void
  hasError?: boolean
  errorMessage?: string
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  className,
  isExpanded,
  onToggle,
  hasError = false,
  errorMessage,
}: CollapsibleSectionProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen)

  // Use external control if provided, otherwise use internal state
  const isOpen = isExpanded ?? internalIsOpen
  const setIsOpen = onToggle ?? (() => setInternalIsOpen(!internalIsOpen))

  return (
    <div
      className={cn(
        'border rounded-lg',
        hasError
          ? 'border-danger-500 dark:border-danger-400'
          : 'border-gray-200 dark:border-gray-700',
        className
      )}
    >
      <Button
        variant="light"
        onPress={() => setIsOpen()}
        className={cn(
          'w-full justify-between p-4 h-auto rounded-none rounded-t-lg hover:bg-gray-50 dark:hover:bg-gray-800',
          hasError && 'bg-danger-50 dark:bg-danger-900/20'
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-medium',
              hasError ? 'text-danger-600 dark:text-danger-400' : 'text-gray-900 dark:text-gray-100'
            )}
          >
            {title}
          </span>
          {hasError && errorMessage && (
            <span className="text-xs text-danger-600 dark:text-danger-400">({errorMessage})</span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp size={20} className={hasError ? 'text-danger-500' : 'text-gray-500'} />
        ) : (
          <ChevronDown size={20} className={hasError ? 'text-danger-500' : 'text-gray-500'} />
        )}
      </Button>

      {isOpen && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
          {children}
        </div>
      )}
    </div>
  )
}
