'use client'

import React, { useEffect, useRef } from 'react'
import { Button } from '@heroui/react'
import { Input, Textarea } from '@world-schools/ui-web'
import { Search } from 'lucide-react'
import type { CampType, LocationType } from '../../types/camps'
import { GoogleMapWithSearch } from '../onboarding/GoogleMapWithSearch'

/* eslint-disable no-undef */
// Google Maps API types are loaded via script tag

export interface BasicInfoFormData {
  name: string
  slug: string
  type: CampType
  description: string
  locationType: LocationType
  locationPlaceId: string
  locationName: string
  locationAddress: string
  locationLat?: number
  locationLng?: number
}

export interface BasicInfoFormProps {
  formData: BasicInfoFormData
  onChange: (data: Partial<BasicInfoFormData>) => void
  onSlugChange?: (slug: string) => void
  onSlugBlur?: () => void
  slugError?: string
  isCheckingSlug?: boolean
  googleBusinessProfile?: {
    businessName: string
    formattedAddress: string
  } | null
  onNameChange?: (name: string) => void
}

export const BasicInfoForm: React.FC<BasicInfoFormProps> = ({
  formData,
  onChange,
  onSlugChange,
  onSlugBlur,
  slugError = '',
  isCheckingSlug = false,
  googleBusinessProfile,
  onNameChange,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const mobileSearchInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const mobileAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const [searchQuery, setSearchQuery] = React.useState('')
  const [mapLocation, setMapLocation] = React.useState<{
    lat: number
    lng: number
    name: string
  } | null>(null)
  const [isEditingLocation, setIsEditingLocation] = React.useState(false)

  // Separate state for "Different Location" data
  // This prevents provider location data from leaking into different location display
  const [differentLocationData, setDifferentLocationData] = React.useState<{
    locationPlaceId: string
    locationName: string
    locationAddress: string
    locationLat: number
    locationLng: number
  } | null>(null)

  const [previousLocation, setPreviousLocation] = React.useState<{
    locationPlaceId: string
    locationName: string
    locationAddress: string
    locationLat: number
    locationLng: number
  } | null>(null)

  // Initialize differentLocationData from formData ONLY if locationType is 'different'
  useEffect(() => {
    if (
      formData.locationType === 'different' &&
      formData.locationPlaceId &&
      formData.locationLat &&
      formData.locationLng &&
      formData.locationName
    ) {
      setDifferentLocationData({
        locationPlaceId: formData.locationPlaceId,
        locationName: formData.locationName,
        locationAddress: formData.locationAddress,
        locationLat: formData.locationLat,
        locationLng: formData.locationLng,
      })
      setMapLocation({
        lat: formData.locationLat,
        lng: formData.locationLng,
        name: formData.locationName,
      })
    }
  }, []) // Only run once on mount

  // Update mapLocation when differentLocationData changes
  useEffect(() => {
    if (differentLocationData) {
      setMapLocation({
        lat: differentLocationData.locationLat,
        lng: differentLocationData.locationLng,
        name: differentLocationData.locationName,
      })
    }
  }, [differentLocationData])

  // Google Places Autocomplete initialization
  useEffect(() => {
    if (formData.locationType !== 'different') {
      return
    }

    let retryTimeout: NodeJS.Timeout | null = null
    let isCleanedUp = false

    const initAutocomplete = () => {
      if (isCleanedUp) return

      if (typeof google === 'undefined' || !google.maps?.places) {
        console.warn('Google Maps Places API not yet loaded, retrying...')
        retryTimeout = setTimeout(initAutocomplete, 100)
        return
      }

      // Helper function to create autocomplete for a given input
      const createAutocomplete = (
        inputRef: React.RefObject<HTMLInputElement | null>,
        autocompleteRefObj: { current: google.maps.places.Autocomplete | null },
        label: string
      ): boolean => {
        if (!inputRef.current) {
          return false
        }

        // Clean up existing instance if any
        if (autocompleteRefObj.current) {
          google.maps.event.clearInstanceListeners(autocompleteRefObj.current)
          autocompleteRefObj.current = null
        }

        try {
          const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
            types: ['establishment'],
            fields: ['place_id', 'name', 'formatted_address', 'geometry'],
          })

          // Handle place selection
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace()

            if (!place.place_id || !place.geometry?.location) {
              console.warn('No place details available')
              return
            }

            const lat = place.geometry.location.lat()
            const lng = place.geometry.location.lng()

            const locationData = {
              locationPlaceId: place.place_id || '',
              locationName: place.name || '',
              locationAddress: place.formatted_address || '',
              locationLat: lat,
              locationLng: lng,
            }

            // Update form data with selected location
            onChange(locationData)

            // Update map location
            setMapLocation({
              lat,
              lng,
              name: place.name || '',
            })

            // Update different location data
            setDifferentLocationData(locationData)

            // Exit edit mode
            setIsEditingLocation(false)
            setPreviousLocation(null)

            // Clear search query
            setSearchQuery('')
          })

          autocompleteRefObj.current = autocomplete
          return true
        } catch (error) {
          console.error(`Error initializing ${label} autocomplete:`, error)
          return false
        }
      }

      // Initialize both desktop and mobile autocomplete
      createAutocomplete(searchInputRef, autocompleteRef, 'desktop')
      createAutocomplete(mobileSearchInputRef, mobileAutocompleteRef, 'mobile')
    }

    initAutocomplete()

    return () => {
      isCleanedUp = true
      if (retryTimeout) {
        clearTimeout(retryTimeout)
      }
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }
      if (mobileAutocompleteRef.current) {
        google.maps.event.clearInstanceListeners(mobileAutocompleteRef.current)
        mobileAutocompleteRef.current = null
      }
    }
  }, [formData.locationType, onChange])

  const handleNameChange = (name: string) => {
    if (onNameChange) {
      onNameChange(name)
    } else {
      onChange({ name })
    }
  }

  const handleSlugChange = (slug: string) => {
    if (onSlugChange) {
      onSlugChange(slug)
    } else {
      onChange({ slug })
    }
  }

  const handleEditLocation = () => {
    // Save current location before editing
    if (formData.locationPlaceId) {
      setPreviousLocation({
        locationPlaceId: formData.locationPlaceId,
        locationName: formData.locationName,
        locationAddress: formData.locationAddress,
        locationLat: formData.locationLat!,
        locationLng: formData.locationLng!,
      })
    }
    setIsEditingLocation(true)
  }

  const handleCancelEdit = () => {
    // Restore previous location
    if (previousLocation) {
      onChange(previousLocation)
      setMapLocation({
        lat: previousLocation.locationLat,
        lng: previousLocation.locationLng,
        name: previousLocation.locationName,
      })
    }
    setIsEditingLocation(false)
    setPreviousLocation(null)
    setSearchQuery('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Camp Name */}
        <Input
          label="Camp Name"
          placeholder="e.g., American International Summer Camp – Salzburg"
          value={formData.name}
          onChange={e => handleNameChange(e.target.value)}
          maxLength={120}
          isRequired
          description={`${formData.name.length} / 120 characters`}
        />

        {/* Camp Slug */}
        <div className="relative">
          <Input
            label="Camp URL Slug"
            placeholder="e.g., american-international-summer-camp-salzburg"
            value={formData.slug}
            onChange={e => handleSlugChange(e.target.value)}
            onBlur={onSlugBlur}
            maxLength={150}
            isRequired
            isInvalid={!!slugError}
            errorMessage={slugError}
            description={
              !slugError ? "For the camp's public URL. Auto-generated from camp name." : undefined
            }
          />
          {isCheckingSlug && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-5 w-5 animate-spin rounded-full border border-primary border-t-transparent"></div>
            </div>
          )}
        </div>
      </div>

      {/* Camp Type */}
      <div className="form-group">
        <div className="mb-2 flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">
            Camp Type
            <span className="ml-1 text-danger">*</span>
          </label>
        </div>
        <div className="flex gap-4">
          <label
            className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-4 py-3 transition-all ${
              formData.type === 'day'
                ? 'border-primary bg-primary/10'
                : 'border-default-200 hover:border-primary'
            }`}
          >
            <input
              type="radio"
              name="campType"
              value="day"
              checked={formData.type === 'day'}
              onChange={e => onChange({ type: e.target.value as CampType })}
              className="hidden"
            />
            <div className="text-xl">☀️</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Day Camp</div>
              <div className="text-xs leading-tight text-default-500">Campers go home daily</div>
            </div>
          </label>
          <label
            className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-4 py-3 transition-all ${
              formData.type === 'residential'
                ? 'border-primary bg-primary/10'
                : 'border-default-200 hover:border-primary'
            }`}
          >
            <input
              type="radio"
              name="campType"
              value="residential"
              checked={formData.type === 'residential'}
              onChange={e => onChange({ type: e.target.value as CampType })}
              className="hidden"
            />
            <div className="text-xl">🏕️</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Residential Camp</div>
              <div className="text-xs leading-tight text-default-500">Overnight stays</div>
            </div>
          </label>
        </div>
        <div className="mt-3 text-sm leading-normal text-default-500">
          💡 If you offer both day and residential programs, create separate listings for each
        </div>
      </div>

      {/* Location */}
      <div className="form-group">
        <div className="mb-2 flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">
            Location
            <span className="ml-1 text-danger">*</span>
          </label>
        </div>
        <div className="flex gap-4">
          <label
            className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-4 py-3 transition-all ${
              formData.locationType === 'provider'
                ? 'border-primary bg-primary/10'
                : 'border-default-200 hover:border-primary'
            }`}
          >
            <input
              type="radio"
              name="locationType"
              value="provider"
              checked={formData.locationType === 'provider'}
              onChange={e => {
                // Clear form location fields but preserve cached location
                onChange({
                  locationType: e.target.value as LocationType,
                  locationPlaceId: '',
                  locationName: '',
                  locationAddress: '',
                  locationLat: undefined,
                  locationLng: undefined,
                })
                // Note: cachedLocation is NOT cleared, so it persists
              }}
              className="hidden"
            />
            <div className="text-xl">🏢</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Provider Address</div>
              <div className="text-xs leading-tight text-default-500">
                Use organization location
              </div>
            </div>
          </label>
          <label
            className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-4 py-3 transition-all ${
              formData.locationType === 'different'
                ? 'border-primary bg-primary/10'
                : 'border-default-200 hover:border-primary'
            }`}
          >
            <input
              type="radio"
              name="locationType"
              value="different"
              checked={formData.locationType === 'different'}
              onChange={e => {
                // Restore different location data if it exists
                if (differentLocationData) {
                  onChange({
                    locationType: e.target.value as LocationType,
                    ...differentLocationData,
                  })
                  // Restore map location
                  setMapLocation({
                    lat: differentLocationData.locationLat,
                    lng: differentLocationData.locationLng,
                    name: differentLocationData.locationName,
                  })
                  // Exit edit mode when switching back
                  setIsEditingLocation(false)
                  setPreviousLocation(null)
                } else {
                  // No cached location, just update location type
                  onChange({ locationType: e.target.value as LocationType })
                  // Make sure we're not in edit mode
                  setIsEditingLocation(false)
                  setPreviousLocation(null)
                }
              }}
              className="hidden"
            />
            <div className="text-xl">📍</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Different Location</div>
              <div className="text-xs leading-tight text-default-500">Camp at external venue</div>
            </div>
          </label>
        </div>

        {/* Provider Address Display */}
        {formData.locationType === 'provider' && (
          <div className="mt-4 rounded-lg bg-default-100 p-4">
            {googleBusinessProfile ? (
              <>
                <div className="mb-1 flex items-center gap-2">
                  <div className="text-xl">🏢</div>
                  <div className="text-sm font-semibold text-foreground">
                    {googleBusinessProfile.businessName}
                  </div>
                </div>
                <div className="pl-7 text-xs text-default-500">
                  {googleBusinessProfile.formattedAddress}
                </div>
              </>
            ) : (
              <>
                <div className="mb-1 text-sm font-semibold text-default-500">
                  Loading business address...
                </div>
                <div className="text-xs text-default-400">
                  Please complete your business profile in onboarding if not already done
                </div>
              </>
            )}
          </div>
        )}

        {/* Google Maps for Different Location */}
        {formData.locationType === 'different' && (
          <div className="mt-4 flex flex-col gap-4">
            {/* Show selected location card when location is selected AND not editing */}
            {differentLocationData && !isEditingLocation && (
              <div className="flex items-center gap-4 rounded-lg bg-default-100 p-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xl">📍</span>
                    <div className="text-sm font-semibold text-foreground">
                      {differentLocationData.locationName}
                    </div>
                  </div>
                  <div className="pl-7 text-xs text-default-500">
                    {differentLocationData.locationAddress}
                  </div>
                </div>
                {!isEditingLocation && (
                  <Button
                    size="sm"
                    variant="light"
                    color="primary"
                    onPress={handleEditLocation}
                    className="shrink-0"
                  >
                    Change
                  </Button>
                )}
                {isEditingLocation && (
                  <Button
                    size="sm"
                    variant="light"
                    color="default"
                    onPress={handleCancelEdit}
                    className="shrink-0"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}

            {/* Show map when no location selected OR when editing existing location */}
            {(!differentLocationData || isEditingLocation) && (
              <>
                {/* Map Container with Search - Desktop */}
                <div className="hidden h-80 overflow-hidden rounded-2xl md:block">
                  <div className="relative h-full w-full">
                    {/* Google Maps */}
                    <GoogleMapWithSearch selectedPlace={mapLocation} className="h-full w-full" />

                    {/* Search Overlay */}
                    <div className="absolute left-1/2 top-8 w-[90%] max-w-[500px] -translate-x-1/2">
                      <Input
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search for camp location..."
                        startContent={<Search size={18} className="text-gray-500" />}
                        classNames={{
                          base: 'w-full',
                          inputWrapper:
                            'rounded-full h-12 border-2 border-primary bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:border-primary focus-within:border-primary',
                          input: 'text-base',
                        }}
                      />
                      {/* Google Places Autocomplete provides its own dropdown */}
                    </div>
                  </div>
                </div>

                {/* Mobile Search - Clean, no map */}
                <div className="md:hidden">
                  <Input
                    ref={mobileSearchInputRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search for camp location..."
                    startContent={
                      <svg
                        className="text-foreground"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    }
                    classNames={{
                      base: 'w-full',
                      inputWrapper:
                        'rounded-full h-12 border-2 border-primary bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:border-primary focus-within:border-primary',
                      input: 'text-base',
                    }}
                  />
                  {/* Google Places Autocomplete provides its own dropdown */}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Short Description */}
      <Textarea
        label="Short Description"
        placeholder="Describe what makes your camp special, your location, and the unique experience you offer..."
        value={formData.description}
        onChange={e => onChange({ description: e.target.value })}
        maxLength={500}
        minRows={4}
        isRequired
        showCharacterCount
      />
    </div>
  )
}
