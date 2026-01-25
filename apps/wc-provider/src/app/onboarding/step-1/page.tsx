'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardBody, CardHeader, Chip, Spinner } from '@heroui/react'
import { Input } from '@world-schools/ui-web'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { GoogleMapsLoader } from '../../../components/onboarding/GoogleMapsLoader'
import { GoogleMapWithSearch } from '../../../components/onboarding/GoogleMapWithSearch'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import type { GoogleBusinessSearchResult } from '../../../types/onboarding'
import { Search } from 'lucide-react'

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

    // Call the store method - it will handle errors and set them in the store's error state
    await saveGoogleBusinessProfile(selectedBusiness.placeId)

    // Get the latest error state from the store after the async operation completes
    const currentError = useOnboardingStore.getState().error

    // Check if there was an error (store will have set it)
    if (currentError) {
      // Error is already set in the store, just display it locally as well
      setSaveError(currentError)
      setIsConfirming(false)
    } else {
      // Success - navigate to next step
      setIsConfirming(false)
      router.push('/onboarding/step-2')
    }
  }

  const handleReset = () => {
    setSelectedBusiness(null)
    setSearchQuery('')
    // Clear any error messages when user attempts to select a different business
    setSaveError(null)
    clearError()
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
                <Button color="primary" size="lg" onPress={handleConfirm} isLoading={isConfirming}>
                  Save & Continue →
                </Button>
              ) : googleBusinessProfile && !isEditing ? (
                <Button color="primary" size="lg" onPress={() => router.push('/onboarding/step-2')}>
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
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-3xl font-bold leading-tight text-foreground">
                Find your camp on Google
              </h1>
              <TrustScoreBadge section="step1" maxPoints={30} />
            </div>
            <p className="text-base text-default-500">
              Help us understand your programs so we can review your application
            </p>
          </div>

          {/* Show saved business profile if exists and not editing */}
          {googleBusinessProfile && !isEditing && !selectedBusiness ? (
            <Card className="mb-6 border-2 border-primary bg-primary-50" shadow="none" radius="lg">
              <CardHeader className="flex items-center justify-between pb-2">
                <h3 className="text-lg">Selected Business</h3>
                {!isReadOnly && (
                  <Button
                    variant="bordered"
                    color="secondary"
                    onPress={() => {
                      setIsEditing(true)
                      // Clear any error messages when entering edit mode
                      setSaveError(null)
                      clearError()
                    }}
                  >
                    Update Business
                  </Button>
                )}
              </CardHeader>
              <CardBody className="pt-2">
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-default-100">
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
              </CardBody>
            </Card>
          ) : !selectedBusiness ? (
            <>
              {/* Show current business details when in edit mode */}
              {isEditing && googleBusinessProfile && (
                <Card
                  className="mb-6 border border-default-200 bg-default-50"
                  shadow="none"
                  radius="lg"
                >
                  <CardBody>
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-default-100">
                        {googleBusinessProfile.photos?.[0] && (
                          <img
                            src={googleBusinessProfile.photos[0]}
                            alt={googleBusinessProfile.businessName}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="font-semibold text-foreground">
                          {googleBusinessProfile.businessName}
                        </div>
                        <div className="text-xs text-default-500">
                          {googleBusinessProfile.formattedAddress}
                        </div>
                      </div>
                      <Chip className="ml-auto" size="sm" color="primary" variant="flat">
                        Currently Selected
                      </Chip>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Map Container with Search - Desktop */}
              {!isReadOnly && (
                <div className="mb-8 hidden h-80 overflow-hidden rounded-2xl md:block">
                  {/* Map Background */}
                  <div className="relative h-full w-full">
                    {/* Google Maps */}
                    <GoogleMapWithSearch selectedPlace={mapLocation} className="h-full w-full" />

                    {/* Search Overlay */}
                    <div className="absolute left-1/2 top-8 w-[90%] max-w-[500px] -translate-x-1/2">
                      <Input
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Business name"
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
              )}

              {/* Mobile Search - Clean, no map */}
              {!isReadOnly && (
                <div className="mb-8 md:hidden">
                  <Input
                    ref={mobileSearchInputRef}
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Business name"
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
              )}
            </>
          ) : (
            <>
              {/* Confirmation Card */}
              {/* Business Preview */}
              <Card className="mb-8 bg-default-100" shadow="none" radius="lg">
                <CardBody>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-default-100">
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
                      <div className="mb-1 text-sm text-default-500">
                        {selectedBusiness.formattedAddress}
                      </div>
                      {selectedBusiness.rating && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-foreground">⭐ {selectedBusiness.rating}</span>
                          {selectedBusiness.reviewsCount && (
                            <span className="text-default-500">
                              ({selectedBusiness.reviewsCount} reviews)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button variant="bordered" size="sm" onPress={handleReset} className="shrink-0">
                      Change
                    </Button>
                  </div>
                </CardBody>
              </Card>

              {/* Form Fields */}
              <div className="flex flex-col gap-4">
                <Input
                  label="Legal Company Name"
                  defaultValue={selectedBusiness.businessName}
                  isRequired
                />

                <Input
                  label="Business Address"
                  defaultValue={selectedBusiness.formattedAddress}
                  isRequired
                />
              </div>

              {/* Error Message - Display prominently in body */}
              {(saveError || error) && (
                <div className="mt-4 rounded-lg border border-danger bg-danger-50 px-4 py-3">
                  <p className="text-sm text-danger">{saveError || error}</p>
                </div>
              )}
            </>
          )}
        </div>
      </OnboardingPageLayout>
    </GoogleMapsLoader>
  )
}
