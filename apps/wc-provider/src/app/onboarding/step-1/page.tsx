'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Spinner } from '@heroui/react'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { GoogleMapsLoader } from '../../../components/onboarding/GoogleMapsLoader'
import { GoogleMapWithSearch } from '../../../components/onboarding/GoogleMapWithSearch'
import type { GoogleBusinessSearchResult } from '../../../types/onboarding'

/* eslint-disable no-undef */
// Google Maps API types are loaded via script tag

export default function OnboardingStep1Page() {
  const router = useRouter()
  const {
    status,
    googleBusinessProfile,
    saveGoogleBusinessProfile,
    fetchGoogleBusinessProfile,
    error,
    clearError,
  } = useOnboardingStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBusiness, setSelectedBusiness] = useState<GoogleBusinessSearchResult | null>(null)
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number; name: string } | null>(
    null
  )
  const [isConfirming, setIsConfirming] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const mobileSearchInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const mobileAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

  // Check if onboarding is completed (read-only mode)
  const isReadOnly = status?.isCompleted ?? false

  // Fetch existing Google Business Profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      await fetchGoogleBusinessProfile()
    }
    void loadProfile()
  }, [fetchGoogleBusinessProfile])

  // Set map location when profile is loaded or when entering edit mode
  useEffect(() => {
    if (googleBusinessProfile) {
      setMapLocation({
        lat: Number(googleBusinessProfile.lat),
        lng: Number(googleBusinessProfile.lng),
        name: googleBusinessProfile.businessName,
      })
    }
  }, [googleBusinessProfile, isEditing])

  // Initialize Google Places Autocomplete for both desktop and mobile
  useEffect(() => {
    // Only initialize when search inputs should be visible
    // Inputs are visible when: no business is selected OR in edit mode
    const shouldShowInputs = !selectedBusiness || isEditing
    if (!shouldShowInputs) {
      return
    }

    let retryTimeout: NodeJS.Timeout | null = null
    let isCleanedUp = false

    // Wait for Google Maps to be loaded
    const initAutocomplete = () => {
      if (isCleanedUp) return

      if (typeof google === 'undefined' || !google.maps?.places) {
        console.warn('Google Maps Places API not yet loaded, retrying...')
        retryTimeout = setTimeout(initAutocomplete, 100)
        return
      }

      // Helper function to create autocomplete instance
      const createAutocomplete = (
        inputRef: React.RefObject<HTMLInputElement | null>,
        autocompleteRefObj: { current: google.maps.places.Autocomplete | null },
        label: string
      ) => {
        if (isCleanedUp) return false

        if (!inputRef.current) {
          // Don't log warnings or retry - the input might not be rendered due to responsive design
          // Mobile input is hidden on desktop (md:hidden), so it won't exist in DOM on larger screens
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
            fields: [
              'place_id',
              'name',
              'formatted_address',
              'geometry',
              'photos',
              'rating',
              'user_ratings_total',
              'formatted_phone_number',
              'website',
            ],
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

            // Convert to our business result format
            const business: GoogleBusinessSearchResult = {
              placeId: place.place_id,
              businessName: place.name || '',
              formattedAddress: place.formatted_address || '',
              lat,
              lng,
              rating: place.rating,
              reviewsCount: place.user_ratings_total,
              phone: place.formatted_phone_number,
              website: place.website,
              photos: place.photos?.map((photo: any) => photo.getUrl({ maxWidth: 400 })),
            }

            setSelectedBusiness(business)
            setSearchQuery('')

            // Update map location
            setMapLocation({
              lat,
              lng,
              name: place.name || '',
            })
          })

          autocompleteRefObj.current = autocomplete
          console.log(`Autocomplete initialized successfully for ${label}`)
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
  }, [isEditing, selectedBusiness])

  // Simple search handler - autocomplete handles the search automatically
  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleConfirm = async () => {
    if (!selectedBusiness) return

    // Clear any previous errors
    setSaveError(null)
    clearError()
    setIsConfirming(true)

    try {
      await saveGoogleBusinessProfile(selectedBusiness.placeId)
      // Only navigate if successful (no error in store)
      router.push('/onboarding/step-2')
    } catch (err: any) {
      console.error('Error saving business profile:', err)
      // Set local error state for display
      const errorMessage =
        err?.response?.data?.data?.message ||
        err?.message ||
        'Failed to save business profile. Please try again.'
      setSaveError(errorMessage)
      setIsConfirming(false)
    }
  }

  const handleReset = () => {
    setSelectedBusiness(null)
    setSearchQuery('')
  }

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <GoogleMapsLoader apiKey={googleMapsApiKey}>
      <OnboardingPageLayout
        breadcrumb="Provider Onboarding / Find Your Camp"
        footer={
          <>
            {/* Error Message */}
            {(saveError || error) && (
              <div className="mb-4 rounded-lg border border-danger bg-danger-50 px-4 py-3">
                <p className="text-sm text-danger">{saveError || error}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              {/* Show back button only when editing or when a business is selected for confirmation */}
              {(isEditing || selectedBusiness) && !isReadOnly && (
                <Button
                  variant="light"
                  onPress={() => {
                    if (isEditing) {
                      // Exit edit mode and return to saved business view
                      setIsEditing(false)
                      setSearchQuery('')
                    } else {
                      // Go back to onboarding home
                      router.push('/onboarding')
                    }
                  }}
                >
                  ← Back
                </Button>
              )}
              {/* Spacer when back button is hidden */}
              {!isEditing && !selectedBusiness && googleBusinessProfile && <div />}

              {selectedBusiness && !isReadOnly ? (
                <Button
                  className="bg-primary font-semibold text-foreground hover:bg-primary-600"
                  size="lg"
                  onPress={handleConfirm}
                  isLoading={isConfirming}
                >
                  Save & Continue →
                </Button>
              ) : googleBusinessProfile && !isEditing ? (
                <Button
                  className="bg-primary font-semibold text-foreground hover:bg-primary-600"
                  size="lg"
                  onPress={() => router.push('/onboarding/step-2')}
                >
                  {isReadOnly ? 'Next →' : 'Continue →'}
                </Button>
              ) : null}
            </div>
          </>
        }
      >
        {/* Content */}
        <div>
          {/* Header */}
          <div className="mb-8">
            <h1 className="mb-2 text-[32px] font-bold leading-tight text-foreground">
              Find your camp on Google
            </h1>
            <p className="text-[16px] text-default-500">
              Help us understand your programs so we can review your application
            </p>
          </div>

          {/* Show saved business profile if exists and not editing */}
          {googleBusinessProfile && !isEditing && !selectedBusiness ? (
            <div className="mb-8">
              <div className="mb-6 rounded-xl border-2 border-primary bg-primary-50 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Selected Business</h3>
                  {!isReadOnly && (
                    <Button
                      variant="bordered"
                      size="sm"
                      onPress={() => setIsEditing(true)}
                      className="border-foreground text-foreground"
                    >
                      Update Business
                    </Button>
                  )}
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-default-100">
                    {googleBusinessProfile.photos?.[0] && (
                      <img
                        src={googleBusinessProfile.photos[0]}
                        alt={googleBusinessProfile.businessName}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="mb-2 text-xl font-semibold text-foreground">
                      {googleBusinessProfile.businessName}
                    </div>
                    <div className="mb-1 text-sm text-default-500">
                      {googleBusinessProfile.formattedAddress}
                    </div>
                    {googleBusinessProfile.rating && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-foreground">⭐ {googleBusinessProfile.rating}</span>
                        {googleBusinessProfile.reviewsCount && (
                          <span className="text-default-500">
                            ({googleBusinessProfile.reviewsCount} reviews)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : !selectedBusiness ? (
            <>
              {/* Show current business details when in edit mode */}
              {isEditing && googleBusinessProfile && (
                <div className="mb-6 rounded-xl border border-default-200 bg-default-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-default-100">
                      {googleBusinessProfile.photos?.[0] && (
                        <img
                          src={googleBusinessProfile.photos[0]}
                          alt={googleBusinessProfile.businessName}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 text-sm font-semibold text-foreground">
                        Currently Selected:
                      </div>
                      <div className="mb-1 font-semibold text-foreground">
                        {googleBusinessProfile.businessName}
                      </div>
                      <div className="text-xs text-default-500">
                        {googleBusinessProfile.formattedAddress}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Map Container with Search - Desktop */}
              {!isReadOnly && (
                <div className="mb-8 hidden h-[320px] overflow-hidden rounded-2xl md:block">
                  {/* Map Background */}
                  <div className="relative h-full w-full">
                    {/* Google Maps */}
                    <GoogleMapWithSearch selectedPlace={mapLocation} className="h-full w-full" />

                    {/* Search Overlay */}
                    <div className="absolute left-1/2 top-8 w-[90%] max-w-[500px] -translate-x-1/2">
                      <div className="relative">
                        {/* Search Icon */}
                        <svg
                          className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground pointer-events-none"
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
                          onChange={e => handleSearch(e.target.value)}
                          placeholder="Business name"
                          className="w-full rounded-full border-2 border-primary bg-white px-6 py-4 pl-[52px] text-base shadow-[0_4px_16px_rgba(0,0,0,0.15)] focus:border-primary focus:outline-none"
                        />
                        {/* Google Places Autocomplete provides its own dropdown */}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile Search - Clean, no map */}
              {!isReadOnly && (
                <div className="mb-8 md:hidden">
                  <div className="relative">
                    {/* Search Icon */}
                    <svg
                      className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground"
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
                      ref={mobileSearchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={e => handleSearch(e.target.value)}
                      placeholder="Business name"
                      className="w-full rounded-full border border-default-200 bg-white px-6 py-4 pl-[52px] text-base shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all focus:border-default-500 focus:shadow-[0_4px_12px_rgba(0,0,0,0.12)] focus:outline-none"
                    />
                    {/* Google Places Autocomplete provides its own dropdown */}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Confirmation Card */}
              <div className="mb-8">
                {/* Business Preview */}
                <div className="mb-8 flex items-center gap-4 rounded-xl bg-default-100 p-5">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-default-100">
                    {selectedBusiness.photos?.[0] && (
                      <img
                        src={selectedBusiness.photos[0]}
                        alt={selectedBusiness.businessName}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 text-base font-semibold text-foreground">
                      {selectedBusiness.businessName}
                    </div>
                    <div className="text-sm text-default-500">
                      {selectedBusiness.formattedAddress}
                    </div>
                  </div>
                  <Button
                    variant="bordered"
                    size="sm"
                    onPress={handleReset}
                    className="flex-shrink-0"
                  >
                    Change
                  </Button>
                </div>

                {/* Form Fields */}
                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">
                      Legal Company Name
                      <span className="ml-1 text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      defaultValue={selectedBusiness.businessName}
                      className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors focus:border-default-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">
                      Business Address
                      <span className="ml-1 text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      defaultValue={selectedBusiness.formattedAddress}
                      className="w-full rounded-lg border border-default-200 bg-white px-4 py-3 text-base transition-colors focus:border-default-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </OnboardingPageLayout>
    </GoogleMapsLoader>
  )
}
