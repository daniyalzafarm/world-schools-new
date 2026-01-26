'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useOnboardingStore } from '../../../../../stores/onboarding-store'
import { GoogleMapsLoader } from '../../../../../components/onboarding/GoogleMapsLoader'
import { checkSlugAvailability } from '../../../../../services/camps.services'
import {
  BasicInfoForm,
  type BasicInfoFormData,
} from '../../../../../components/camp-forms/BasicInfoForm'

// Google Maps API types are loaded via script tag

export default function BasicInfoEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.campId as string

  const {
    updateBasicInfo,
    fetchCamp,
    currentCamp,
    setHasUnsavedChanges,
    setWizardFormValid,
    setWizardFormSubmit,
  } = useCampsStore()

  const { googleBusinessProfile, fetchGoogleBusinessProfile } = useOnboardingStore()

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

  const [formData, setFormData] = useState<BasicInfoFormData>({
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

  // Store original data for comparison
  const [originalData, setOriginalData] = useState<BasicInfoFormData | null>(null)

  const [slugError, setSlugError] = useState<string>('')
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)

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
      const campData: BasicInfoFormData = {
        name: currentCamp.name,
        slug: currentCamp.slug,
        type: currentCamp.type,
        description: currentCamp.description,
        locationType: currentCamp.locationType,
        locationPlaceId: currentCamp.locationPlaceId || '',
        locationName: currentCamp.locationName || '',
        locationAddress: currentCamp.locationAddress || '',
        locationLat: currentCamp.locationLat,
        locationLng: currentCamp.locationLng,
      }

      setFormData(campData)
      setOriginalData(campData)
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
      const result = await checkSlugAvailability(slug, campId)
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

  // Update form validity in store
  useEffect(() => {
    const isValid =
      formData.name.trim() !== '' &&
      formData.slug.trim() !== '' &&
      !slugError &&
      formData.description.trim() !== '' &&
      (formData.locationType === 'provider' || formData.locationPlaceId !== '')

    setWizardFormValid(isValid)
  }, [formData, slugError, setWizardFormValid])

  // Register submit handler for footer
  useEffect(() => {
    const handleFormSubmit = async () => {
      if (!campId) return

      // Validate slug before submitting
      const isSlugValid = await validateSlug(formData.slug)
      if (!isSlugValid) {
        throw new Error('Invalid slug')
      }

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
        <BasicInfoForm
          formData={formData}
          onChange={data => setFormData(prev => ({ ...prev, ...data }))}
          onSlugChange={slug => {
            setFormData(prev => ({ ...prev, slug }))
            setSlugError('')
          }}
          onSlugBlur={() => validateSlug(formData.slug)}
          slugError={slugError}
          isCheckingSlug={isCheckingSlug}
          googleBusinessProfile={googleBusinessProfile}
        />
      </div>
    </GoogleMapsLoader>
  )
}
