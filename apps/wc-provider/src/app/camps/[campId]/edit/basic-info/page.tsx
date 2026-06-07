'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCampsStore } from '../../../../../stores/camps-store'
import { useOnboardingStore } from '../../../../../stores/onboarding-store'
import { useAutosave } from '../../../../../hooks/useAutosave'
import { GoogleMapsLoader } from '../../../../../components/onboarding/GoogleMapsLoader'
import { checkSlugAvailability } from '../../../../../services/camps.services'
import {
  BasicInfoForm,
  type BasicInfoFormData,
} from '../../../../../components/camp-forms/BasicInfoForm'
import { getRuntimeConfig } from '../../../../../config/runtime-config'

export default function BasicInfoEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.campId as string

  const { updateBasicInfo, fetchCamp, currentCamp } = useCampsStore()

  const { googleBusinessProfile, fetchGoogleBusinessProfile } = useOnboardingStore()

  const googleMapsApiKey = getRuntimeConfig().googleMapsApiKey ?? ''

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

  const [isLoaded, setIsLoaded] = useState(false)
  const [slugError, setSlugError] = useState<string>('')
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)

  useEffect(() => {
    if (campId) {
      fetchCamp(campId).catch(error => {
        console.error('Failed to fetch camp:', error)
        router.push('/camps')
      })
    }
    void fetchGoogleBusinessProfile()
  }, [campId, fetchCamp, router, fetchGoogleBusinessProfile])

  useEffect(() => {
    if (currentCamp) {
      setFormData({
        name: currentCamp.name,
        slug: currentCamp.slug,
        type: currentCamp.type,
        description: currentCamp.description,
        locationType: currentCamp.locationType,
        locationPlaceId: currentCamp.locationPlaceId || '',
        locationName: currentCamp.locationName || '',
        locationAddress: currentCamp.locationAddress || '',
        locationLat: currentCamp.locationLat ? Number(currentCamp.locationLat) : undefined,
        locationLng: currentCamp.locationLng ? Number(currentCamp.locationLng) : undefined,
      })
      setIsLoaded(true)
    }
  }, [currentCamp])

  const validateSlug = async (slug: string) => {
    if (!slug) {
      setSlugError('Slug is required')
      return false
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setSlugError('Slug must be lowercase, alphanumeric, and use hyphens to separate words')
      return false
    }

    setIsCheckingSlug(true)
    const response = await checkSlugAvailability(slug, campId)
    setIsCheckingSlug(false)
    if (!response.success) {
      setSlugError(response.data.message || 'Failed to validate slug. Please try again.')
      return false
    }
    if (!response.data.available) {
      setSlugError('This slug is already taken. Please choose a different one.')
      return false
    }
    setSlugError('')
    return true
  }

  const autosaveEnabled =
    isLoaded &&
    formData.name.trim() !== '' &&
    formData.slug.trim() !== '' &&
    !slugError &&
    !isCheckingSlug &&
    formData.description.trim() !== '' &&
    (formData.locationType === 'provider' || formData.locationPlaceId !== '')

  useAutosave(formData, {
    enabled: autosaveEnabled,
    save: async data => {
      await updateBasicInfo(campId, data)
      if (!useCampsStore.getState().error) {
        await fetchCamp(campId)
      }
    },
  })

  return (
    <GoogleMapsLoader apiKey={googleMapsApiKey}>
      <div>
        <div className="mb-8">
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Edit Basic Information</h1>
          <p className="text-base leading-normal text-default-500">
            Update your camp's name, type, location, and description
          </p>
        </div>

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
