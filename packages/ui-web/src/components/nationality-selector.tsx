'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'
import { Input } from './input'
import { Search, X } from 'lucide-react'
import { COUNTRIES, getCountryFlag } from '../constants/countries'
import { cn } from '../utils/cn'

interface NationalitySelectorProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  label?: string
}

export function NationalitySelector({
  value,
  onChange,
  placeholder = 'Select nationality',
  className,
  label,
}: NationalitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter countries based on search query
  const filteredCountries = useMemo(() => {
    if (searchQuery.trim() === '') {
      return COUNTRIES
    }
    return COUNTRIES.filter(country => country.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [searchQuery])

  // Handle nationality selection
  const handleSelectNationality = useCallback(
    (selectedNationality: string) => {
      onChange(selectedNationality)
      setIsOpen(false)
      setSearchQuery('')
    },
    [onChange]
  )

  // Handle search query change
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text)
  }, [])

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      searchInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [isOpen])

  // Clear search when modal closes
  const handleClose = useCallback(() => {
    setIsOpen(false)
    setSearchQuery('')
  }, [])

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="bordered"
        onPress={() => setIsOpen(true)}
        className={cn(
          'rounded-lg bg-white',
          'border border-gray-200',
          'hover:border-gray-300',
          'focus-within:border-primary!',
          'focus-within:bg-white!',
          'focus-within:outline-none',
          'dark:border-gray-600',
          'w-full',
          className
        )}
        aria-label={label}
      >
        <div className="flex items-center justify-between w-full">
          <span
            className={cn(
              'text-left',
              value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {value ? (
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getCountryFlag(value)}</span>
                <span>{value}</span>
              </div>
            ) : (
              placeholder
            )}
          </span>
          <Search size={16} className="text-gray-400" />
        </div>
      </Button>

      {/* Modal */}
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: 'max-h-[80vh]',
          body: 'p-0',
          header: 'pb-2',
        }}
      >
        <ModalContent>
          <ModalHeader className="flex items-center justify-between px-6 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Select Nationality
            </h3>
          </ModalHeader>
          <ModalBody>
            {/* Search Input */}
            <div className="px-6 pb-4">
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onValueChange={handleSearchChange}
                placeholder="Search for a country"
                startContent={<Search size={16} className="text-gray-400" />}
                endContent={
                  searchQuery && (
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={() => handleSearchChange('')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </Button>
                  )
                }
                classNames={{
                  inputWrapper:
                    'border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
                }}
              />
            </div>

            {/* Countries List */}
            <div className="max-h-96 overflow-y-auto">
              {filteredCountries.length === 0 && searchQuery.trim() !== '' ? (
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <Search size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    No results found
                  </h4>
                  <p className="text-gray-500 dark:text-gray-400 text-center">
                    Try searching with different keywords
                  </p>
                </div>
              ) : (
                <div className="pb-4">
                  {filteredCountries.map(country => (
                    <Button
                      key={country}
                      variant="light"
                      onPress={() => handleSelectNationality(country)}
                      className="w-full justify-start h-auto py-3 px-6 rounded-none hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getCountryFlag(country)}</span>
                        <span className="text-left font-medium text-gray-900 dark:text-gray-100">
                          {country}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
}
