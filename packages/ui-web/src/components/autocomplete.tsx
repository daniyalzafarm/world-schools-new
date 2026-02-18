'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Card, CardBody } from '@heroui/react'
import { Input } from './input'
import { Search } from 'lucide-react'
import { cn } from '../utils/cn'

interface AutocompleteProps {
  value: string
  onChangeText: (text: string) => void
  onSelect: (item: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
}

export function Autocomplete({
  value,
  onChangeText,
  onSelect,
  suggestions,
  placeholder = 'Search...',
  className,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.toLowerCase().includes(value.toLowerCase())
  )

  useEffect(() => {
    setTimeout(() => {
      setIsOpen(value.length > 0 && filteredSuggestions.length > 0)
      setFocusedIndex(-1)
    }, 0)
  }, [value, filteredSuggestions.length])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0) {
          handleSelect(filteredSuggestions[focusedIndex])
        } else if (value.trim()) {
          handleSelect(value.trim())
        }
        break
      case 'Escape':
        setIsOpen(false)
        setFocusedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const handleSelect = (item: string) => {
    onSelect(item)
    setIsOpen(false)
    setFocusedIndex(-1)
  }

  const handleInputChange = (newValue: string) => {
    onChangeText(newValue)
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        value={value}
        onValueChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        startContent={<Search size={16} className="text-gray-400" />}
        className="w-full"
        classNames={{
          input: 'text-sm',
          inputWrapper:
            'border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
        }}
      />

      {isOpen && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto shadow-lg">
          <CardBody className="p-0">
            <div ref={listRef}>
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  onClick={() => handleSelect(suggestion)}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                    'focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700',
                    index === focusedIndex && 'bg-gray-100 dark:bg-gray-700'
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
