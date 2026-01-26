'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCampsStore } from '../../../../stores/camps-store'
import { useOnboardingStore } from '../../../../stores/onboarding-store'
import { GoogleMapsLoader } from '../../../../components/onboarding/GoogleMapsLoader'
import { checkSlugAvailability } from '../../../../services/camps.services'
import {
  BasicInfoForm,
  type BasicInfoFormData,
} from '../../../../components/camp-forms/BasicInfoForm'

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
  const [localHasUnsavedChanges, setLocalHasUnsavedChanges] = useState(false)

  const [slugError, setSlugError] = useState<string>('')
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)

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
        locationPlaceId: wizardCamp.locationPlaceId || '',
        locationName: wizardCamp.locationName || '',
        locationAddress: wizardCamp.locationAddress || '',
        locationLat: wizardCamp.locationLat,
        locationLng: wizardCamp.locationLng,
      })
    }
  }, [wizardCamp])

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
        <BasicInfoForm
          formData={formData}
          onChange={data => {
            setFormData({ ...formData, ...data })
            setLocalHasUnsavedChanges(true)
          }}
          onSlugChange={slug => {
            setFormData({ ...formData, slug })
            setSlugError('')
          }}
          onSlugBlur={() => validateSlug(formData.slug)}
          slugError={slugError}
          isCheckingSlug={isCheckingSlug}
          googleBusinessProfile={googleBusinessProfile}
          onNameChange={handleNameChange}
        />
      </div>
    </GoogleMapsLoader>
  )
}
