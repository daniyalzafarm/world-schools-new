'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@heroui/react'
import { Input, Textarea } from '@world-schools/ui-web'
import { useCampsStore } from '../../../../stores/camps-store'
import { useOnboardingStore } from '../../../../stores/onboarding-store'
import type { CampType, CreateCampDto, LocationType } from '../../../../types/camps'
import { GoogleMapsLoader } from '../../../../components/onboarding/GoogleMapsLoader'
import { GoogleMapWithSearch } from '../../../../components/onboarding/GoogleMapWithSearch'
import { checkSlugAvailability } from '../../../../services/camps.services'
import { Search } from 'lucide-react'

/* eslint-disable no-undef */
// Google Maps API types are loaded via script tag

// Helper function to generate slug from camp name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

export default function BasicInfoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campId = searchParams.get('id')

  const {
    createCamp,
    updateBasicInfo,
    fetchCamp,
    wizardCamp,
    setWizardCamp,
    setWizardStep,
    resetWizard,
  } = useCampsStore()

  const { googleBusinessProfile, fetchGoogleBusinessProfile } = useOnboardingStore()

  const [formData, setFormData] = useState<CreateCampDto>({
    name: '',
    slug: '',
    type: 'day',
    description: '',
    locationType: 'provider',
    locationPlaceId: '',
    locationName: '',
    locationAddress: '',
    locationLat: undefined,
    locationLng: undefined,
  })
  const [localHasUnsavedChanges, setLocalHasUnsavedChanges] = useState(false)

  const [slugError, setSlugError] = useState<string>('')
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)

  // Google Maps state
  const [searchQuery, setSearchQuery] = useState('')
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number; name: string } | null>(
    null
  )
  const [isEditingLocation, setIsEditingLocation] = useState(false) // Track if user is changing location

  // Cache for previously selected location (persists when toggling location types)
  const [cachedLocation, setCachedLocation] = useState<{
    locationPlaceId: string
    locationName: string
    locationAddress: string
    locationLat: number
    locationLng: number
  } | null>(null)

  // Temporary storage for location before user confirms change
  const [previousLocation, setPreviousLocation] = useState<{
    locationPlaceId: string
    locationName: string
    locationAddress: string
    locationLat: number
    locationLng: number
  } | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const mobileSearchInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const mobileAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

  useEffect(() => {
    setWizardStep(1)

    // If campId exists, fetch the camp data and set it as wizardCamp
    if (campId) {
      fetchCamp(campId)
        .then(() => {
          // Get the fetched camp from currentCamp and set it as wizardCamp
          const currentCamp = useCampsStore.getState().currentCamp
          if (currentCamp) {
            setWizardCamp(currentCamp)
          }
        })
        .catch(error => {
          console.error('Failed to fetch camp:', error)
        })
    } else {
      // Starting a new camp creation - reset wizard state to ensure clean slate
      resetWizard()
    }

    // Fetch Google Business Profile for provider address display
    void fetchGoogleBusinessProfile()
  }, [campId, fetchCamp, setWizardCamp, setWizardStep, resetWizard, fetchGoogleBusinessProfile])

  useEffect(() => {
    // Populate form with existing data
    if (wizardCamp) {
      setFormData({
        name: wizardCamp.name,
        slug: wizardCamp.slug,
        type: wizardCamp.type,
        description: wizardCamp.description,
        locationType: wizardCamp.locationType,
        locationPlaceId: wizardCamp.locationPlaceId,
        locationName: wizardCamp.locationName,
        locationAddress: wizardCamp.locationAddress,
        locationLat: wizardCamp.locationLat,
        locationLng: wizardCamp.locationLng,
      })

      // Set map location and cache if different location is selected
      if (
        wizardCamp.locationType === 'different' &&
        wizardCamp.locationLat &&
        wizardCamp.locationLng &&
        wizardCamp.locationPlaceId
      ) {
        const locationData = {
          lat: wizardCamp.locationLat,
          lng: wizardCamp.locationLng,
          name: wizardCamp.locationName || '',
        }
        setMapLocation(locationData)

        // Cache the location data
        setCachedLocation({
          locationPlaceId: wizardCamp.locationPlaceId,
          locationName: wizardCamp.locationName || '',
          locationAddress: wizardCamp.locationAddress || '',
          locationLat: wizardCamp.locationLat,
          locationLng: wizardCamp.locationLng,
        })

        // Make sure we're not in edit mode when loading existing data
        setIsEditingLocation(false)
        setPreviousLocation(null)
      }
    }
  }, [wizardCamp])

  // Initialize Google Places Autocomplete
  useEffect(() => {
    // Only initialize when "different" location is selected and either:
    // - No location is selected yet, OR
    // - User is editing an existing location
    const shouldShowMap = !formData.locationPlaceId || isEditingLocation
    if (formData.locationType !== 'different' || !shouldShowMap) {
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
            setFormData(prev => ({
              ...prev,
              ...locationData,
            }))

            // Cache the location for persistence when toggling location types
            setCachedLocation(locationData)

            // Update map location
            setMapLocation({
              lat,
              lng,
              name: place.name || '',
            })

            // Clear search query and exit edit mode
            setSearchQuery('')
            setIsEditingLocation(false)
            setPreviousLocation(null)
          })

          autocompleteRefObj.current = autocomplete
          return true
        } catch (error) {
          console.error(`Error initializing autocomplete (${label}):`, error)
          return false
        }
      }

      // Initialize desktop autocomplete (always present)
      const desktopInitialized = createAutocomplete(searchInputRef, autocompleteRef, 'desktop')

      // Initialize mobile autocomplete (only if element exists in DOM)
      // Mobile input is conditionally rendered with md:hidden, so it won't exist on desktop
      createAutocomplete(mobileSearchInputRef, mobileAutocompleteRef, 'mobile')

      // Only retry if desktop autocomplete failed (which means inputs aren't ready yet)
      if (!desktopInitialized && !isCleanedUp) {
        retryTimeout = setTimeout(initAutocomplete, 100)
      }
    }

    initAutocomplete()

    // Cleanup
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
  }, [formData.locationType, formData.locationPlaceId, isEditingLocation])

  // Handle name change with auto-slug generation
  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name),
    }))
    setSlugError('')
  }

  // Validate slug availability
  const validateSlug = async (slug: string) => {
    if (!slug) {
      setSlugError('Slug is required')
      return false
    }

    // Check format
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setSlugError('Slug must be lowercase, alphanumeric, and use hyphens to separate words')
      return false
    }

    // Check availability
    setIsCheckingSlug(true)
    try {
      const result = await checkSlugAvailability(slug, campId || undefined)
      if (!result.available) {
        setSlugError('This slug is already taken. Please choose a different one.')
        return false
      }
      setSlugError('')
      return true
    } catch (error) {
      console.error('Failed to check slug availability:', error)
      setSlugError('Failed to validate slug. Please try again.')
      return false
    } finally {
      setIsCheckingSlug(false)
    }
  }

  const handleSubmit = async () => {
    // Validate slug before submitting
    const isSlugValid = await validateSlug(formData.slug)
    if (!isSlugValid) {
      return
    }

    try {
      if (campId) {
        // Update existing camp with new data
        const camp = await updateBasicInfo(campId, formData)
        setWizardCamp(camp)
        setLocalHasUnsavedChanges(false)
        router.push(`/camps/create/audience?id=${campId}`)
      } else {
        // Create new camp
        const camp = await createCamp(formData)
        setWizardCamp(camp)
        setLocalHasUnsavedChanges(false)
        router.push(`/camps/create/audience?id=${camp.id}`)
      }
    } catch (error) {
      console.error('Failed to save basic info:', error)
    }
  }

  // Track when form data changes (to enable "Save & Continue" button)
  useEffect(() => {
    // Only mark as having unsaved changes if we have a campId (editing existing camp)
    // For new camps, we always need to save to create the camp
    if (campId && wizardCamp) {
      // Check if any field has changed from the original wizardCamp data
      const hasChanges =
        formData.name !== wizardCamp.name ||
        formData.slug !== wizardCamp.slug ||
        formData.type !== wizardCamp.type ||
        formData.description !== wizardCamp.description ||
        formData.locationType !== wizardCamp.locationType ||
        formData.locationPlaceId !== wizardCamp.locationPlaceId

      setLocalHasUnsavedChanges(hasChanges)
    } else if (!campId) {
      // For new camps, always mark as having unsaved changes if form has data
      const hasData = formData.name.trim() !== '' || formData.description.trim() !== ''
      setLocalHasUnsavedChanges(hasData)
    }
  }, [formData, wizardCamp, campId])

  // Expose form validation and submit handler to parent layout
  useEffect(() => {
    const isFormValid =
      formData.name.trim() !== '' &&
      formData.slug.trim() !== '' &&
      !slugError &&
      formData.description.trim() !== '' &&
      (formData.locationType === 'provider' || formData.locationPlaceId !== '')

    // Store validation state and handler in the store
    useCampsStore.setState({
      wizardFormValid: isFormValid,
      wizardFormSubmit: handleSubmit,
      hasUnsavedChanges: localHasUnsavedChanges,
    })
  }, [formData, slugError, localHasUnsavedChanges])

  return (
    <GoogleMapsLoader apiKey={googleMapsApiKey}>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">
            Let's add info for your camp
          </h1>
          <p className="text-base leading-normal text-default-500">
            Start with the basics: name, type, location, and a short description
          </p>
        </div>

        {/* Form */}
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
                onChange={e => {
                  setFormData({ ...formData, slug: e.target.value })
                  setSlugError('')
                }}
                onBlur={() => validateSlug(formData.slug)}
                maxLength={150}
                isRequired
                isInvalid={!!slugError}
                errorMessage={slugError}
                description={
                  !slugError
                    ? "For the camp's public URL. Auto-generated from camp name."
                    : undefined
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
                  onChange={e => setFormData({ ...formData, type: e.target.value as CampType })}
                  className="hidden"
                />
                <div className="text-xl">☀️</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">Day Camp</div>
                  <div className="text-xs leading-tight text-default-500">
                    Campers go home daily
                  </div>
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
                  onChange={e => setFormData({ ...formData, type: e.target.value as CampType })}
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
                    setFormData({
                      ...formData,
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
                    // Restore cached location if it exists
                    if (cachedLocation) {
                      setFormData({
                        ...formData,
                        locationType: e.target.value as LocationType,
                        ...cachedLocation,
                      })
                      // Restore map location
                      setMapLocation({
                        lat: cachedLocation.locationLat,
                        lng: cachedLocation.locationLng,
                        name: cachedLocation.locationName,
                      })
                      // Exit edit mode when switching back
                      setIsEditingLocation(false)
                      setPreviousLocation(null)
                    } else {
                      // No cached location, just update location type
                      setFormData({ ...formData, locationType: e.target.value as LocationType })
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
                  <div className="text-xs leading-tight text-default-500">
                    Camp at external venue
                  </div>
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
                {/* Show selected location card when location is selected */}
                {formData.locationPlaceId && (
                  <div className="flex items-center gap-4 rounded-lg bg-default-100 p-4">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xl">📍</span>
                        <div className="text-sm font-semibold text-foreground">
                          {formData.locationName}
                        </div>
                      </div>
                      <div className="pl-7 text-xs text-default-500">
                        {formData.locationAddress}
                      </div>
                    </div>
                    {isEditingLocation ? (
                      <Button
                        size="sm"
                        variant="bordered"
                        color="default"
                        onPress={() => {
                          // Cancel editing - restore previous location
                          if (previousLocation) {
                            setFormData(prev => ({
                              ...prev,
                              ...previousLocation,
                            }))
                            setCachedLocation(previousLocation)
                            setMapLocation({
                              lat: previousLocation.locationLat,
                              lng: previousLocation.locationLng,
                              name: previousLocation.locationName,
                            })
                          }
                          setIsEditingLocation(false)
                          setPreviousLocation(null)
                          setSearchQuery('')
                        }}
                        className="shrink-0 w-16"
                      >
                        Cancel
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        color="primary"
                        onPress={() => {
                          // Save current location before editing
                          setPreviousLocation({
                            locationPlaceId: formData.locationPlaceId || '',
                            locationName: formData.locationName || '',
                            locationAddress: formData.locationAddress || '',
                            locationLat: formData.locationLat ?? 0,
                            locationLng: formData.locationLng ?? 0,
                          })
                          setIsEditingLocation(true)
                        }}
                        className="shrink-0 w-16"
                      >
                        Change
                      </Button>
                    )}
                  </div>
                )}

                {/* Show map when no location selected OR when editing */}
                {(!formData.locationPlaceId || isEditingLocation) && (
                  <>
                    {/* Map Container with Search - Desktop */}
                    <div className="hidden h-80 overflow-hidden rounded-2xl md:block">
                      <div className="relative h-full w-full">
                        {/* Google Maps */}
                        <GoogleMapWithSearch
                          selectedPlace={mapLocation}
                          className="h-full w-full"
                        />

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
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            maxLength={500}
            minRows={4}
            isRequired
            showCharacterCount
          />
        </div>
      </div>
    </GoogleMapsLoader>
  )
}
