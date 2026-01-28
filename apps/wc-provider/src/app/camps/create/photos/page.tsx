'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addToast } from '@heroui/react'
import { useCampsStore } from '../../../../stores/camps-store'
import type { CampPhoto } from '../../../../types/camps'
import { PhotosForm, type PhotosFormData } from '../../../../components/camp-forms/PhotosForm'

export default function PhotosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campId = searchParams.get('id')

  const { uploadCampPhotos, fetchCamp, wizardCamp, setWizardCamp, setWizardStep } = useCampsStore()

  const [formData, setFormData] = useState<PhotosFormData>({
    photos: [],
    pendingFiles: [],
  })
  const [isUploading, setIsUploading] = useState(false)
  const [localHasUnsavedChanges, setLocalHasUnsavedChanges] = useState(false)

  useEffect(() => {
    setWizardStep(4)

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
          router.push('/camps/create/basic-info')
        })
    } else {
      router.push('/camps/create/basic-info')
    }
  }, [campId, fetchCamp, setWizardCamp, setWizardStep, router])

  useEffect(() => {
    if (wizardCamp?.photos) {
      // Sort photos by order and set them
      const sortedPhotos = [...(wizardCamp.photos as CampPhoto[])].sort((a, b) => a.order - b.order)
      setFormData(prev => ({ ...prev, photos: sortedPhotos }))
    }
  }, [wizardCamp])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      // Create temporary preview objects for selected files
      const fileArray = Array.from(files)
      const newPhotos: CampPhoto[] = fileArray.map((file, index) => ({
        id: `temp-${Date.now()}-${index}`,
        url: URL.createObjectURL(file),
        thumbnail: URL.createObjectURL(file),
        isPrimary: formData.photos.length === 0 && index === 0,
        order: formData.photos.length + index,
      }))

      const updatedPhotos = [...formData.photos, ...newPhotos]
      setFormData(prev => ({
        ...prev,
        photos: updatedPhotos,
        pendingFiles: [...prev.pendingFiles, ...fileArray],
      }))
      setLocalHasUnsavedChanges(true)
    } catch (error) {
      console.error('Failed to select photos:', error)
      addToast({
        title: 'Error',
        description: 'Failed to select photos. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleFilesSelected = async (files: File[]) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      // Create temporary preview objects for selected files
      const newPhotos: CampPhoto[] = files.map((file, index) => ({
        id: `temp-${Date.now()}-${index}`,
        url: URL.createObjectURL(file),
        thumbnail: URL.createObjectURL(file),
        isPrimary: formData.photos.length === 0 && index === 0,
        order: formData.photos.length + index,
      }))

      const updatedPhotos = [...formData.photos, ...newPhotos]
      setFormData(prev => ({
        ...prev,
        photos: updatedPhotos,
        pendingFiles: [...prev.pendingFiles, ...files],
      }))
      setLocalHasUnsavedChanges(true)
    } catch (error) {
      console.error('Failed to select photos:', error)
      addToast({
        title: 'Error',
        description: 'Failed to select photos. Please try again.',
        color: 'danger',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemovePhoto = (photoId: string) => {
    const filteredPhotos = formData.photos.filter(p => p.id !== photoId)
    // Reorder remaining photos
    const reorderedPhotos = filteredPhotos.map((photo, index) => ({
      ...photo,
      order: index,
      isPrimary: index === 0,
    }))
    setFormData(prev => ({ ...prev, photos: reorderedPhotos }))
    setLocalHasUnsavedChanges(true)
  }

  const handleSubmit = async () => {
    if (!campId) return

    // Update store loading state
    useCampsStore.setState({ isLoading: true })
    try {
      // Separate existing photos (already uploaded) from new ones (temp IDs)
      const existingPhotos = formData.photos.filter(p => !p.id.startsWith('temp-'))

      // Upload new files along with existing photos metadata
      // The API now returns the camp with SAS URLs, so no need to fetch again
      await uploadCampPhotos(campId, formData.pendingFiles, existingPhotos)

      // Clear pending files and mark as saved
      setFormData(prev => ({ ...prev, pendingFiles: [] }))
      setLocalHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save photos:', error)
      addToast({
        title: 'Error',
        description: 'Failed to save photos. Please try again.',
        color: 'danger',
      })
    } finally {
      useCampsStore.setState({ isLoading: false })
    }
  }

  // Expose form validation and submit handler to parent layout
  useEffect(() => {
    // Require minimum 5 photos
    const isFormValid = formData.photos.length >= 5

    useCampsStore.setState({
      wizardFormValid: isFormValid,
      wizardFormSubmit: handleSubmit,
      hasUnsavedChanges: localHasUnsavedChanges,
    })
  }, [formData.photos, campId, localHasUnsavedChanges])

  return (
    <div>
      {/* Header - matching reference design */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold leading-tight text-foreground">
          Add photos of your camp
        </h1>
        <p className="text-base text-default-500">
          Parents want to see your facilities and activities. Upload at least 5 photos.
        </p>
      </div>

      {/* Form */}
      <PhotosForm
        formData={formData}
        onChange={data => {
          setFormData({ ...formData, ...data })
          setLocalHasUnsavedChanges(true)
        }}
        onFileSelect={handleFileSelect}
        onFilesSelected={handleFilesSelected}
        onRemovePhoto={handleRemovePhoto}
        isUploading={isUploading}
      />
    </div>
  )
}
