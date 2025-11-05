'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalHeader, ScrollShadow } from '@heroui/react'
import { Input } from '../../../../packages/ui-web/src/components/input'
import { X } from 'lucide-react'
import { cn } from '../../../../packages/ui-web/src/utils/cn'
import type { CityData } from '@/data/cities'

export interface CitySuggestion {
  name: string
  country: string
}

interface CityModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectCity: (city: CitySuggestion) => void
  cities: CityData[]
  placeholder?: string
}

export function CityModal({
  isOpen,
  onClose,
  onSelectCity,
  cities,
  placeholder = 'Search for a city...',
}: CityModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter cities based on search query
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return cities

    return cities.filter(
      city =>
        city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        city.country.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [cities, searchQuery])

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setFocusedIndex(0) // Reset focus to first item
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Update focus when search results change
  useEffect(() => {
    setFocusedIndex(0) // Always focus on first available item
  }, [searchQuery, filteredCities.length])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(prev => Math.min(prev + 1, filteredCities.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredCities[focusedIndex]) {
        handleCityClick(filteredCities[focusedIndex])
      }
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
      e.preventDefault()
      // Let the modal handle these keys
      handleKeyDown(e)
    }
  }

  const handleCityClick = (city: CityData) => {
    const citySuggestion: CitySuggestion = {
      name: city.name,
      country: city.country,
    }
    onSelectCity(citySuggestion)
    onClose()
  }

  const handleClose = () => {
    setSearchQuery('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      hideCloseButton
      size="2xl"
      scrollBehavior="inside"
      onClose={handleClose}
      onKeyDown={handleKeyDown}
      classNames={{
        base: 'max-h-[440px] z-50',
        body: 'p-0',
        header: 'pb-4',
      }}
    >
      <ModalContent>
        <ModalHeader className="mt-3 pt-0 px-0">
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onValueChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder={placeholder}
            endContent={
              <Button isIconOnly variant="light" radius="full" size="sm" onPress={handleClose}>
                <X size={20} />
              </Button>
            }
            classNames={{
              base: 'w-full',
              input: 'text-[16px]',
              inputWrapper: cn(
                'px-6 pb-7 focus-within:bg-transparent focus-within:border-gray-200 border-0 border-b shadow-none border-gray-200 dark:border-gray-700 rounded-none',
                'data-[hover=true]:bg-transparent'
              ),
            }}
          />
        </ModalHeader>

        <ModalBody className="gap-1">
          {/* Cities List */}
          <ScrollShadow className="max-h-[50vh]">
            <div className="px-6 pb-6">
              {filteredCities.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {searchQuery ? 'No cities found' : 'No cities available'}
                  </h3>
                  <p className="mb-4">
                    {searchQuery
                      ? 'Try adjusting your search terms'
                      : 'No cities are currently available.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredCities.map((city, index) => (
                    <div
                      key={`${city.name}-${index}`}
                      onClick={() => handleCityClick(city)}
                      className={cn(
                        'group p-2 rounded-lg cursor-pointer',
                        'hover:bg-gray-200 dark:hover:bg-gray-800/50',
                        'transition-all duration-200',
                        focusedIndex === index && 'bg-gray-200 dark:bg-gray-800/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate flex-1 min-w-0">{city.name}</h4>
                              {city.country && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                  {city.country}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollShadow>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
