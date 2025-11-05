'use client'

import React from 'react'
import { Button } from '@heroui/react'
import { cn } from "@world-schools/ui-web"

// Shared base classes to keep visual parity across usages
const BASE_BUTTON_CLASSES = [
  'bg-[#F9F9F9] dark:bg-gray-800/80 backdrop-blur-sm',
  'border-gray-300 dark:border-gray-600',
  'text-gray-700 dark:text-gray-300',
  'hover:bg-primary-100 dark:hover:bg-gray-700',
  'hover:border-primary-100 dark:hover:border-gray-500',
  'text-sm font-medium rounded-full border-[0.8px]',
  'hover:text-primary-dark dark:hover:text-primary-dark',
]

interface SuggestionChipsProps {
  suggestions: string[]
  onSuggestionClick: (suggestion: string) => void
  disabled?: boolean
  className?: string
}

export function SuggestionChips({
  suggestions,
  onSuggestionClick,
  disabled = false,
  className,
}: SuggestionChipsProps) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className={cn('px-6 pb-4', className)}>
      <div className="max-w-4xl ml-5 mr-auto">
        <div className="flex flex-wrap gap-2 justify-start">
          {suggestions.map((suggestion, index) => (
            <Button
              key={`${suggestion}-${index}`}
              variant="bordered"
              size="sm"
              onPress={() => onSuggestionClick(suggestion)}
              disabled={disabled}
              className={cn(BASE_BUTTON_CLASSES, disabled && 'opacity-50 cursor-not-allowed')}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface InitialSuggestionsProps {
  suggestions: string[]
  onSuggestionClick: (suggestion: string) => void
  disabled?: boolean
  className?: string
}

export function InitialSuggestions({
  suggestions,
  onSuggestionClick,
  disabled = false,
  className,
}: InitialSuggestionsProps) {
  return (
    <div className={cn('flex flex-col items-center gap-8', className)}>
      {/* Suggestion Buttons */}
      <div className="flex gap-3 flex-wrap justify-center max-w-2xl">
        {suggestions.map((suggestion, index) => (
          <Button
            key={`${suggestion}-${index}`}
            variant="bordered"
            onPress={() => onSuggestionClick(suggestion)}
            disabled={disabled}
            className={cn(BASE_BUTTON_CLASSES, disabled && 'opacity-50 cursor-not-allowed')}
            style={{
              animationDelay: `${index * 150}ms`,
              animationDuration: '600ms',
            }}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  )
}
