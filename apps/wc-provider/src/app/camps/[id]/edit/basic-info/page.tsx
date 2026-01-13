'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useOnboardingStore } from '../../../../../stores/onboarding-store'
import type { CampType, CreateCampDto, LocationType } from '../../../../../types/camps'
import { GoogleMapsLoader } from '../../../../../components/onboarding/GoogleMapsLoader'
import { GoogleMapWithSearch } from '../../../../../components/onboarding/GoogleMapWithSearch'

/* eslint-disable no-undef */
// Google Maps API types are loaded via script tag

export default function BasicInfoEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.id as string

  const {
    updateBasicInfo,
    fetchCamp,
    currentCamp,
    isLoading,
    setHasUnsavedChanges,
    setWizardFormValid,
    setWizardFormSubmit,
  } = useCampsStore()

  const { googleBusinessProfile, fetchGoogleBusinessProfile } = useOnboardingStore()

  const [formData, setFormData] = useState<CreateCampDto>({
    name: '',
    type: 'day',
    description: '',
    locationType: 'provider',
    locationPlaceId: '',
    locationName: '',
    locationAddress: '',
    locationLat: undefined,
    locationLng: undefined,
  })

  // Store original data for comparison
  const [originalData, setOriginalData] = useState<CreateCampDto | null>(null)

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
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

  useEffect(() => {
    if (campId) {
      fetchCamp(campId).catch(error => {
        console.error('Failed to fetch camp:', error)
        router.push('/camps')
      })
    }

    // Fetch Google Business Profile for provider address display
    void fetchGoogleBusinessProfile()

    // Cleanup on unmount
    return () => {
      setHasUnsavedChanges(false)
      setWizardFormValid(false)
      setWizardFormSubmit(null)
    }
  }, [
    campId,
    fetchCamp,
    router,
    fetchGoogleBusinessProfile,
    setHasUnsavedChanges,
    setWizardFormValid,
    setWizardFormSubmit,
  ])

  useEffect(() => {
    // Populate form with existing data
    if (currentCamp) {
      const campData = {
        name: currentCamp.name,
        type: currentCamp.type,
        description: currentCamp.description,
        locationType: currentCamp.locationType,
        locationPlaceId: currentCamp.locationPlaceId,
        locationName: currentCamp.locationName,
        locationAddress: currentCamp.locationAddress,
        locationLat: currentCamp.locationLat,
        locationLng: currentCamp.locationLng,
      }

      setFormData(campData)
      setOriginalData(campData)

      // Set map location and cache if different location is selected
      if (
        currentCamp.locationType === 'different' &&
        currentCamp.locationLat &&
        currentCamp.locationLng &&
        currentCamp.locationPlaceId
      ) {
        const locationData = {
          lat: currentCamp.locationLat,
          lng: currentCamp.locationLng,
          name: currentCamp.locationName || '',
        }
        setMapLocation(locationData)

        // Cache the location data
        setCachedLocation({
          locationPlaceId: currentCamp.locationPlaceId,
          locationName: currentCamp.locationName || '',
          locationAddress: currentCamp.locationAddress || '',
          locationLat: currentCamp.locationLat,
          locationLng: currentCamp.locationLng,
        })

        // Make sure we're not in edit mode when loading existing data
        setIsEditingLocation(false)
        setPreviousLocation(null)
      }
    }
  }, [currentCamp])

  // Detect form changes and update store state
  useEffect(() => {
    if (!originalData) return

    // Compare current form data with original data
    const hasChanges =
      formData.name !== originalData.name ||
      formData.type !== originalData.type ||
      formData.description !== originalData.description ||
      formData.locationType !== originalData.locationType ||
      formData.locationPlaceId !== originalData.locationPlaceId ||
      formData.locationName !== originalData.locationName ||
      formData.locationAddress !== originalData.locationAddress ||
      formData.locationLat !== originalData.locationLat ||
      formData.locationLng !== originalData.locationLng

    setHasUnsavedChanges(hasChanges)
  }, [formData, originalData, setHasUnsavedChanges])

  // Update form validity in store
  useEffect(() => {
    const isValid =
      formData.name.trim() !== '' &&
      formData.description.trim() !== '' &&
      (formData.locationType === 'provider' || formData.locationPlaceId !== '')

    setWizardFormValid(isValid)
  }, [formData, setWizardFormValid])

  // Register submit handler for footer
  useEffect(() => {
    const handleFormSubmit = async () => {
      if (!campId) return

      try {
        await updateBasicInfo(campId, formData)
        // Refresh the camp data
        await fetchCamp(campId)
      } catch (error) {
        console.error('Failed to save basic info:', error)
        throw error
      }
    }

    setWizardFormSubmit(handleFormSubmit)

    // Cleanup
    return () => {
      setWizardFormSubmit(null)
    }
  }, [campId, formData, updateBasicInfo, fetchCamp, setWizardFormSubmit])

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

      if (!searchInputRef.current) {
        retryTimeout = setTimeout(initAutocomplete, 100)
        return
      }

      // Clean up existing instance if any
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }

      try {
        const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
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

        autocompleteRef.current = autocomplete
      } catch (error) {
        console.error('Error initializing autocomplete:', error)
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
    }
  }, [formData.locationType, formData.locationPlaceId, isEditingLocation])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!campId) return

    try {
      await updateBasicInfo(campId, formData)
      // Refresh the camp data
      await fetchCamp(campId)
    } catch (error) {
      console.error('Failed to save basic info:', error)
    }
  }

  const isFormValid =
    formData.name.trim() !== '' &&
    formData.description.trim() !== '' &&
    (formData.locationType === 'provider' || formData.locationPlaceId !== '')

  return (
    <GoogleMapsLoader apiKey={googleMapsApiKey}>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Edit Basic Information</h1>
          <p className="text-base leading-normal text-default-500">
            Update your camp's name, type, location, and description
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Camp Name */}
          <div className="form-group">
            <div className="mb-2 flex items-center gap-2">
              <label className="text-base font-semibold text-foreground">
                Camp Name
                <span className="ml-1 text-danger">*</span>
              </label>
              <span className="relative inline-flex cursor-help items-center justify-center text-xs text-default-400">
                ⓘ
              </span>
            </div>
            <input
              type="text"
              className="w-full rounded-lg border border-default-300 bg-background px-4 py-3 text-base text-foreground transition-all placeholder:text-default-400 hover:border-default-400 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20"
              placeholder="e.g., American International Summer Camp – Salzburg"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              maxLength={120}
            />
            <div className="mt-1.5 text-right text-xs text-default-400">
              {formData.name.length} / 120 characters
            </div>
          </div>

          {/* Camp Type */}
          <div className="form-group">
            <div className="mb-2 flex items-center gap-2">
              <label className="text-base font-semibold text-foreground">
                Camp Type
                <span className="ml-1 text-danger">*</span>
              </label>
              <span className="relative inline-flex cursor-help items-center justify-center text-xs text-default-400">
                ⓘ
              </span>
            </div>
            <div className="flex gap-4">
              <label
                className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border-2 bg-background px-4 py-3 transition-all ${
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
                className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border-2 bg-background px-4 py-3 transition-all ${
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
              <label className="text-base font-semibold text-foreground">
                Location
                <span className="ml-1 text-danger">*</span>
              </label>
              <span className="relative inline-flex cursor-help items-center justify-center text-xs text-default-400">
                ⓘ
              </span>
            </div>
            <div className="flex gap-4">
              <label
                className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border-2 bg-background px-4 py-3 transition-all ${
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
                className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border-2 bg-background px-4 py-3 transition-all ${
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
                      // No cached location, clear location fields to show map
                      setFormData({
                        ...formData,
                        locationType: e.target.value as LocationType,
                        locationPlaceId: '',
                        locationName: '',
                        locationAddress: '',
                        locationLat: undefined,
                        locationLng: undefined,
                      })
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
              <div className="mt-4 space-y-4">
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
                    {/* Map Container with Search */}
                    <div className="h-80 overflow-hidden rounded-2xl">
                      <div className="relative h-full w-full">
                        {/* Google Maps */}
                        <GoogleMapWithSearch
                          selectedPlace={mapLocation}
                          className="h-full w-full"
                        />

                        {/* Search Overlay */}
                        <div className="absolute left-1/2 top-8 w-[90%] max-w-[500px] -translate-x-1/2">
                          <div className="relative">
                            {/* Search Icon */}
                            <svg
                              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-foreground"
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

                            {/* Search Input with Google Places Autocomplete */}
                            <input
                              ref={searchInputRef}
                              type="text"
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              placeholder="Search for camp location..."
                              className="w-full rounded-full border-2 border-primary bg-white px-6 py-4 pl-[52px] text-base shadow-[0_4px_16px_rgba(0,0,0,0.15)] focus:border-primary focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Short Description */}
          <div className="form-group">
            <div className="mb-2 flex items-center gap-2">
              <label className="text-base font-semibold text-foreground">
                Short Description
                <span className="ml-1 text-danger">*</span>
              </label>
              <span className="relative inline-flex cursor-help items-center justify-center text-xs text-default-400">
                ⓘ
              </span>
            </div>
            <textarea
              className="min-h-[120px] w-full resize-y rounded-lg border border-default-300 bg-background px-4 py-3 text-base leading-relaxed text-foreground transition-all placeholder:text-default-400 hover:border-default-400 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20"
              placeholder="Describe what makes your camp special, your location, and the unique experience you offer..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              maxLength={500}
            />
            <div className="mt-1.5 text-right text-xs text-default-400">
              {formData.description.length} / 500 characters
            </div>
          </div>
        </form>
      </div>
    </GoogleMapsLoader>
  )
}
