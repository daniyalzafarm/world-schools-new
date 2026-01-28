'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Card,
  CardBody,
  Chip,
  Spinner,
} from '@heroui/react'
import { Input, PhoneInput } from '@world-schools/ui-web'
import { Controller, useForm } from 'react-hook-form'
import { isValidPhoneNumber, parsePhoneNumber } from 'react-phone-number-input'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { OnboardingFooter } from '../../../components/onboarding/OnboardingFooter'
import { GoogleMapsLoader } from '../../../components/onboarding/GoogleMapsLoader'
import { GoogleMapWithSearch } from '../../../components/onboarding/GoogleMapWithSearch'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import type { GoogleBusinessSearchResult, LegalBusinessInfo } from '../../../types/onboarding'
import { Search } from 'lucide-react'

/* eslint-disable no-undef */
// Google Maps API types are loaded via script tag

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'INR', label: 'INR - Indian Rupee' },
]

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' },
]

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

  // React Hook Form for legal business information
  const {
    handleSubmit,
    formState: { errors },
    reset,
    control,
    watch,
  } = useForm<LegalBusinessInfo>()

  // Track saved legal info for comparison (to show warning borders)
  const [savedLegalInfo, setSavedLegalInfo] = useState<LegalBusinessInfo | null>(null)

  // Watch all form fields to detect changes
  const watchedFields = watch()

  // Check if onboarding is completed (read-only mode)
  const isReadOnly = status?.isCompleted ?? false

  // Helper function to check if a field has changed from saved value
  // This should ONLY return true when:
  // 1. There's previously saved legal info (from a saved business profile)
  // 2. A new business is selected
  // 3. The current field value differs from the saved value
  const hasFieldChanged = (fieldName: keyof LegalBusinessInfo): boolean => {
    // No warnings for first-time selection (no saved legal info to compare against)
    if (!savedLegalInfo) return false

    // No warnings when there's no previously saved Google Business Profile
    // This ensures we only show warnings when changing an EXISTING saved business
    if (!googleBusinessProfile?.placeId) return false

    // No warnings when no business is selected
    if (!selectedBusiness) return false

    const currentValue = watchedFields[fieldName]
    const savedValue = savedLegalInfo[fieldName]
    // Compare values, treating empty string and undefined as equal
    return (currentValue || '') !== (savedValue || '')
  }

  // Helper function to check if ANY fields have changed from saved values
  // This is used to determine if the "Save & Continue" button should be shown
  // and if the warning message should be displayed
  const hasAnyFieldChanged = (): boolean => {
    // Only check for changes when:
    // 1. We have saved legal info to compare against (from a previously saved business)
    // 2. We have a Google Business Profile (user has completed initial setup)
    if (!savedLegalInfo || !googleBusinessProfile?.placeId) return false

    // List of all fields to check
    const fieldsToCheck: (keyof LegalBusinessInfo)[] = [
      'legalCompanyName',
      'legalStreetAddress',
      'legalAptSuite',
      'legalCity',
      'legalStateProvince',
      'legalPostalCode',
      'legalCountry',
      'yearFounded',
      'providerPhone',
      'providerEmail',
      'website',
      'currency',
      'timezone',
    ]

    return fieldsToCheck.some(fieldName => {
      const currentValue = watchedFields[fieldName]
      const savedValue = savedLegalInfo[fieldName]
      // Compare values, treating empty string and undefined as equal
      return (currentValue || '') !== (savedValue || '')
    })
  }

  // Helper function to check if warning should be shown
  // Warning should ONLY appear when:
  // 1. A new business is selected from Google Places (selectedBusiness exists)
  // 2. There's previously saved legal info (savedLegalInfo exists)
  // 3. The auto-filled values differ from the saved values
  const shouldShowWarning = (): boolean => {
    // No warnings for first-time selection (no saved legal info)
    if (!savedLegalInfo) return false

    // Only show warning when a new business is selected from Google Places
    if (!selectedBusiness) return false

    // Check if any fields have changed from saved values
    return hasAnyFieldChanged()
  }

  // Fetch existing Google Business Profile and legal info on mount
  useEffect(() => {
    const loadProfile = async () => {
      await fetchGoogleBusinessProfile()
    }
    void loadProfile()
  }, [fetchGoogleBusinessProfile])

  // Load existing legal business information when profile is loaded
  useEffect(() => {
    if (googleBusinessProfile?.legalInfo) {
      const legalInfo = googleBusinessProfile.legalInfo
      const formData = {
        legalCompanyName: legalInfo.legalCompanyName || '',
        legalStreetAddress: legalInfo.legalStreetAddress || '',
        legalAptSuite: legalInfo.legalAptSuite || '',
        legalCity: legalInfo.legalCity || '',
        legalStateProvince: legalInfo.legalStateProvince || '',
        legalPostalCode: legalInfo.legalPostalCode || '',
        legalCountry: legalInfo.legalCountry || '',
        yearFounded: legalInfo.yearFounded ?? undefined,
        providerPhone: legalInfo.providerPhone || '',
        providerEmail: legalInfo.providerEmail || '',
        website: legalInfo.website || '',
        currency: legalInfo.currency || '',
        timezone: legalInfo.timezone || '',
      }
      reset(formData)
      // Save the loaded data for comparison (cast to match the partial type)
      setSavedLegalInfo(formData as LegalBusinessInfo)
    }
  }, [googleBusinessProfile]) // Only depend on googleBusinessProfile, not reset

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

  // Auto-fill legal business information when a business is selected
  useEffect(() => {
    if (selectedBusiness) {
      // Build street address
      // Combine street number and street name if available, otherwise use formatted address
      let streetAddress = ''
      if (selectedBusiness.streetNumber && selectedBusiness.streetName) {
        streetAddress = `${selectedBusiness.streetNumber} ${selectedBusiness.streetName}`
      } else if (selectedBusiness.formattedAddress) {
        streetAddress = selectedBusiness.formattedAddress
      }

      // Prepare form data with auto-filled values
      // For fields not available from Google Places, we'll set them to empty/undefined
      // and let the user fill them in manually

      // Parse and format phone number to E.164 format for proper country detection
      let formattedPhone = ''
      if (selectedBusiness.phone) {
        try {
          // Try to parse the phone number
          // Use the ISO country code (e.g., "PK", "US") for parsing
          // If the phone number doesn't have a country code prefix, parsePhoneNumber will use this as a hint
          const phoneNumber = parsePhoneNumber(
            selectedBusiness.phone,
            selectedBusiness.countryCode as any
          )
          if (phoneNumber) {
            // Convert to E.164 format (e.g., "+923221562")
            // This ensures the PhoneInput component can auto-detect the country
            formattedPhone = phoneNumber.number
          } else {
            // If parsing fails, use the original phone number
            formattedPhone = selectedBusiness.phone
          }
        } catch (error) {
          // If parsing fails, use the original phone number
          console.error('Failed to parse phone number:', error)
          formattedPhone = selectedBusiness.phone
        }
      }

      const autoFilledData: Partial<LegalBusinessInfo> = {
        legalCompanyName: selectedBusiness.businessName || '',
        legalStreetAddress: streetAddress,
        legalAptSuite: '', // Not available from Google Places - clear it
        legalCity: selectedBusiness.city || '',
        legalStateProvince: selectedBusiness.state || '',
        legalPostalCode: selectedBusiness.postalCode || '',
        legalCountry: selectedBusiness.country || '',
        yearFounded: undefined, // Not available from Google Places - clear it
        providerPhone: formattedPhone,
        providerEmail: '', // Not available from Google Places - clear it
        website: selectedBusiness.website || '',
        currency: '', // Not available from Google Places - user must select
        timezone: '', // Not available from Google Places - user must select
      }

      // Use reset() to update all fields at once (more reliable than individual setValue calls)
      reset(autoFilledData)
    }
  }, [selectedBusiness, reset])

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
              'address_components',
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
              return
            }

            const lat = place.geometry.location.lat()
            const lng = place.geometry.location.lng()

            // Parse address components
            let streetNumber = ''
            let streetName = ''
            let city = ''
            let state = ''
            let postalCode = ''
            let country = ''
            let countryCode = '' // ISO 2-letter country code (e.g., "PK", "US", "CH")

            if (place.address_components) {
              for (const component of place.address_components) {
                const types = component.types
                if (types.includes('street_number')) {
                  streetNumber = component.long_name
                } else if (types.includes('route')) {
                  streetName = component.long_name
                } else if (types.includes('locality')) {
                  city = component.long_name
                } else if (types.includes('administrative_area_level_1')) {
                  state = component.long_name
                } else if (types.includes('postal_code')) {
                  postalCode = component.long_name
                } else if (types.includes('country')) {
                  country = component.long_name // Full country name (e.g., "Pakistan")
                  countryCode = component.short_name // ISO code (e.g., "PK")
                }
              }
            }

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
              streetNumber,
              streetName,
              city,
              state,
              postalCode,
              country,
              countryCode,
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

  const onSubmit = async (data: LegalBusinessInfo) => {
    // Determine which placeId to use:
    // - If a new business is selected, use selectedBusiness.placeId
    // - If only fields changed, use the existing googleBusinessProfile.placeId
    const placeId = selectedBusiness?.placeId || googleBusinessProfile?.placeId

    if (!placeId) {
      // This shouldn't happen, but guard against it
      setSaveError('No business profile selected')
      return
    }

    // Clear any previous errors
    setSaveError(null)
    clearError()
    setIsConfirming(true)

    // Call the store method with both business profile and legal info
    await saveGoogleBusinessProfile(placeId, data)

    // Get the latest error state from the store after the async operation completes
    const currentError = useOnboardingStore.getState().error

    // Check if there was an error (store will have set it)
    if (currentError) {
      // Error is already set in the store, just display it locally as well
      setSaveError(currentError)
      setIsConfirming(false)
    } else {
      // Success - update saved legal info and navigate to next step
      setSavedLegalInfo(data)
      setIsConfirming(false)
      router.push('/onboarding/about-your-camp')
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
          <OnboardingFooter
            onBack={() => {
              if (isEditing) {
                // Exit edit mode and return to saved business view
                setIsEditing(false)
                setSearchQuery('')
              } else {
                // Use default back navigation to contact page
                router.push('/onboarding/contact')
              }
            }}
            onNext={async () => {
              // Read-only mode: just navigate to next step
              if (isReadOnly) {
                router.push('/onboarding/about-your-camp')
                return
              }

              // Check if a business is selected (either new selection or previously saved)
              const hasBusinessSelected = selectedBusiness ?? googleBusinessProfile?.placeId

              if (!hasBusinessSelected) {
                // No business selected - button should be disabled, but handle edge case
                return
              }

              // Business is selected - check if we need to save or just navigate
              if (
                googleBusinessProfile?.placeId &&
                !isEditing &&
                !selectedBusiness &&
                !hasAnyFieldChanged()
              ) {
                // Previously saved business, no changes, not editing - just navigate
                router.push('/onboarding/about-your-camp')
              } else {
                // New business selected OR changes made - trigger form submission
                // Form validation will be checked by react-hook-form
                await handleSubmit(onSubmit)()
              }
            }}
            isLoading={isConfirming}
            isDisabled={(() => {
              // Read-only mode: never disabled
              if (isReadOnly) return false

              // Check if a business is selected (either new selection or previously saved)
              const hasBusinessSelected = selectedBusiness ?? googleBusinessProfile?.placeId

              // No business selected: disable button
              if (!hasBusinessSelected) return true

              // Business is selected: always enable button
              // Form validation will be handled by react-hook-form's handleSubmit()
              // which will show validation errors when user clicks the button
              return false
            })()}
            nextButtonText={(() => {
              // Read-only mode: always "Next"
              if (isReadOnly) return 'Next →'

              // Check if a business is selected (either new selection or previously saved)
              const hasBusinessSelected = selectedBusiness ?? googleBusinessProfile?.placeId

              // No business selected: show "Next" (will be disabled)
              if (!hasBusinessSelected) return 'Next →'

              // Business is selected - check if we need to save
              if (
                googleBusinessProfile?.placeId &&
                !isEditing &&
                !selectedBusiness &&
                !hasAnyFieldChanged()
              ) {
                // Previously saved business, no changes, not editing - show "Next"
                return 'Next →'
              } else {
                // New business selected OR changes made - show "Save & Continue"
                return 'Save & Continue →'
              }
            })()}
          />
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
          {googleBusinessProfile?.placeId && !isEditing && !selectedBusiness ? (
            <Card className="mb-6 border-2 border-primary bg-primary-50" shadow="none" radius="lg">
              <CardBody className="flex-row items-center justify-between">
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
              {/* Confirmation Card - Business Preview */}
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
            </>
          )}

          {/* Legal Business Information Form - Always visible except when desktop map is shown */}
          {/* Hide on desktop only when map is visible: !isReadOnly && !selectedBusiness && (!googleBusinessProfile || isEditing) */}
          <form
            id="legal-business-form"
            onSubmit={handleSubmit(onSubmit)}
            className={
              !isReadOnly && !selectedBusiness && (!googleBusinessProfile || isEditing)
                ? 'md:hidden'
                : ''
            }
          >
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold text-foreground">Legal Business Information</h2>

              {/* Warning message when fields have changed from selected business */}
              {shouldShowWarning() && (
                <div className="rounded-lg border border-warning bg-warning-50 px-4 py-3">
                  <p className="text-sm text-warning-700">
                    ⚠️ Some fields have been updated from your selected business. Please review the
                    highlighted fields before saving.
                  </p>
                </div>
              )}

              {/* Legal Company Name */}
              <Controller
                name="legalCompanyName"
                control={control}
                rules={{ required: 'Legal company name is required' }}
                render={({ field }) => (
                  <Input
                    label="Legal Company Name"
                    placeholder="Adventure Camps LLC"
                    value={field.value || ''}
                    onChange={e => field.onChange(e.target.value)}
                    isDisabled={isReadOnly}
                    isRequired
                    isInvalid={!!errors.legalCompanyName}
                    errorMessage={errors.legalCompanyName?.message}
                    classNames={{
                      inputWrapper: hasFieldChanged('legalCompanyName')
                        ? 'border-2 border-warning'
                        : '',
                    }}
                  />
                )}
              />

              <Controller
                name="legalStreetAddress"
                control={control}
                rules={{ required: 'Street address is required' }}
                render={({ field }) => (
                  <Input
                    className="md:col-span-2"
                    label="Street Address"
                    placeholder="123 Main Street"
                    value={field.value || ''}
                    onChange={e => field.onChange(e.target.value)}
                    isDisabled={isReadOnly}
                    isRequired
                    isInvalid={!!errors.legalStreetAddress}
                    errorMessage={errors.legalStreetAddress?.message}
                    classNames={{
                      inputWrapper: hasFieldChanged('legalStreetAddress')
                        ? 'border-2 border-warning'
                        : '',
                    }}
                  />
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Controller
                  name="legalAptSuite"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label="Apt/Suite (Optional)"
                      placeholder="Suite 100"
                      value={field.value || ''}
                      onChange={e => field.onChange(e.target.value)}
                      isDisabled={isReadOnly}
                      classNames={{
                        inputWrapper: hasFieldChanged('legalAptSuite')
                          ? 'border-2 border-warning'
                          : '',
                      }}
                    />
                  )}
                />
                <Controller
                  name="legalCity"
                  control={control}
                  rules={{ required: 'City is required' }}
                  render={({ field }) => (
                    <Input
                      label="City"
                      placeholder="Los Angeles"
                      value={field.value || ''}
                      onChange={e => field.onChange(e.target.value)}
                      isDisabled={isReadOnly}
                      isRequired
                      isInvalid={!!errors.legalCity}
                      errorMessage={errors.legalCity?.message}
                      classNames={{
                        inputWrapper: hasFieldChanged('legalCity') ? 'border-2 border-warning' : '',
                      }}
                    />
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Controller
                  name="legalStateProvince"
                  control={control}
                  rules={{ required: 'State/Province is required' }}
                  render={({ field }) => (
                    <Input
                      label="State/Province"
                      placeholder="California"
                      value={field.value || ''}
                      onChange={e => field.onChange(e.target.value)}
                      isDisabled={isReadOnly}
                      isRequired
                      isInvalid={!!errors.legalStateProvince}
                      errorMessage={errors.legalStateProvince?.message}
                      classNames={{
                        inputWrapper: hasFieldChanged('legalStateProvince')
                          ? 'border-2 border-warning'
                          : '',
                      }}
                    />
                  )}
                />
                <Controller
                  name="legalPostalCode"
                  control={control}
                  rules={{ required: 'Postal code is required' }}
                  render={({ field }) => (
                    <Input
                      label="Postal Code"
                      placeholder="90001"
                      value={field.value || ''}
                      onChange={e => field.onChange(e.target.value)}
                      isDisabled={isReadOnly}
                      isRequired
                      isInvalid={!!errors.legalPostalCode}
                      errorMessage={errors.legalPostalCode?.message}
                      classNames={{
                        inputWrapper: hasFieldChanged('legalPostalCode')
                          ? 'border-2 border-warning'
                          : '',
                      }}
                    />
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Controller
                  name="legalCountry"
                  control={control}
                  rules={{ required: 'Country is required' }}
                  render={({ field }) => (
                    <Input
                      label="Country"
                      placeholder="United States"
                      value={field.value || ''}
                      onChange={e => field.onChange(e.target.value)}
                      isDisabled={isReadOnly}
                      isRequired
                      isInvalid={!!errors.legalCountry}
                      errorMessage={errors.legalCountry?.message}
                      classNames={{
                        inputWrapper: hasFieldChanged('legalCountry')
                          ? 'border-2 border-warning'
                          : '',
                      }}
                    />
                  )}
                />
                <Controller
                  name="yearFounded"
                  control={control}
                  rules={{ required: 'Year founded is required' }}
                  render={({ field }) => (
                    <Input
                      type="number"
                      label="Year Founded"
                      placeholder="2010"
                      value={field.value?.toString() || ''}
                      onChange={e =>
                        field.onChange(e.target.value ? Number(e.target.value) : undefined)
                      }
                      isDisabled={isReadOnly}
                      isRequired
                      isInvalid={!!errors.yearFounded}
                      errorMessage={errors.yearFounded?.message}
                      classNames={{
                        inputWrapper: hasFieldChanged('yearFounded')
                          ? 'border-2 border-warning'
                          : '',
                      }}
                    />
                  )}
                />
              </div>

              {/* Business Contact Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <Controller
                  name="providerPhone"
                  control={control}
                  rules={{
                    validate: value =>
                      !value || isValidPhoneNumber(value) || 'Please enter a valid phone number',
                  }}
                  render={({ field }) => (
                    <PhoneInput
                      label="Business Phone (Optional)"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isReadOnly}
                      error={errors.providerPhone?.message}
                      placeholder="+1 (555) 123-4567"
                      classNames={{
                        inputWrapper: hasFieldChanged('providerPhone') ? 'has-warning' : '',
                      }}
                    />
                  )}
                />

                <Controller
                  name="providerEmail"
                  control={control}
                  rules={{
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Please enter a valid email address',
                    },
                  }}
                  render={({ field }) => (
                    <Input
                      type="email"
                      label="Business Email (Optional)"
                      placeholder="info@example.com"
                      value={field.value || ''}
                      onChange={e => field.onChange(e.target.value)}
                      isDisabled={isReadOnly}
                      isInvalid={!!errors.providerEmail}
                      errorMessage={errors.providerEmail?.message}
                      classNames={{
                        inputWrapper: hasFieldChanged('providerEmail')
                          ? 'border-2 border-warning'
                          : '',
                      }}
                    />
                  )}
                />
              </div>

              {/* Website */}
              <Controller
                name="website"
                control={control}
                rules={{
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Please enter a valid URL starting with http:// or https://',
                  },
                }}
                render={({ field }) => (
                  <Input
                    type="url"
                    label="Website (Optional)"
                    placeholder="https://example.com"
                    value={field.value || ''}
                    onChange={e => field.onChange(e.target.value)}
                    isDisabled={isReadOnly}
                    isInvalid={!!errors.website}
                    errorMessage={errors.website?.message}
                    classNames={{
                      inputWrapper: hasFieldChanged('website') ? 'border-2 border-warning' : '',
                    }}
                  />
                )}
              />

              {/* Currency and Timezone */}
              <div className="grid gap-4 md:grid-cols-2">
                <Controller
                  name="currency"
                  control={control}
                  rules={{ required: 'Currency is required' }}
                  render={({ field }) => (
                    <Autocomplete
                      label="Currency"
                      labelPlacement="outside"
                      placeholder="Select currency"
                      selectedKey={field.value || ''}
                      onSelectionChange={key => field.onChange(key as string)}
                      isDisabled={isReadOnly}
                      isRequired
                      isInvalid={!!errors.currency}
                      errorMessage={errors.currency?.message}
                      classNames={{
                        base: 'w-full',
                        listboxWrapper: 'max-h-[320px]',
                      }}
                      inputProps={{
                        classNames: {
                          inputWrapper: hasFieldChanged('currency')
                            ? 'border-2 border-warning'
                            : 'rounded-lg bg-white border border-gray-200 hover:border-gray-300 focus-within:border-primary! focus-within:bg-white! dark:border-gray-600',
                        },
                      }}
                    >
                      {CURRENCIES.map(curr => (
                        <AutocompleteItem key={curr.value}>{curr.label}</AutocompleteItem>
                      ))}
                    </Autocomplete>
                  )}
                />

                <Controller
                  name="timezone"
                  control={control}
                  rules={{ required: 'Timezone is required' }}
                  render={({ field }) => (
                    <Autocomplete
                      label="Timezone"
                      labelPlacement="outside"
                      placeholder="Select timezone"
                      selectedKey={field.value || ''}
                      onSelectionChange={key => field.onChange(key as string)}
                      isDisabled={isReadOnly}
                      isRequired
                      isInvalid={!!errors.timezone}
                      errorMessage={errors.timezone?.message}
                      classNames={{
                        base: 'w-full',
                        listboxWrapper: 'max-h-[320px]',
                      }}
                      inputProps={{
                        classNames: {
                          inputWrapper: hasFieldChanged('timezone')
                            ? 'border-2 border-warning'
                            : 'rounded-lg bg-white border border-gray-200 hover:border-gray-300 focus-within:border-primary! focus-within:bg-white! dark:border-gray-600',
                        },
                      }}
                    >
                      {TIMEZONES.map(tz => (
                        <AutocompleteItem key={tz.value}>{tz.label}</AutocompleteItem>
                      ))}
                    </Autocomplete>
                  )}
                />
              </div>
            </div>
          </form>

          {/* Error Message - Display prominently in body */}
          {(saveError || error) && (
            <div className="mt-4 rounded-lg border border-danger bg-danger-50 px-4 py-3">
              <p className="text-sm text-danger">{saveError || error}</p>
            </div>
          )}
        </div>
      </OnboardingPageLayout>
    </GoogleMapsLoader>
  )
}
