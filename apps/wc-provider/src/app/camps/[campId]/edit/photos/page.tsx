'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { addToast } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import type { CampPhoto } from '../../../../../types/camps'
import { PhotosForm, type PhotosFormData } from '../../../../../components/camp-forms/PhotosForm'

export default function PhotosEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.campId as string

  const {
    uploadCampPhotos,
    fetchCamp,
    currentCamp,
    setHasUnsavedChanges,
    setWizardFormValid,
    setWizardFormSubmit,
  } = useCampsStore()

  const [formData, setFormData] = useState<PhotosFormData>({
    photos: [],
    pendingFiles: [],
  })
  const [originalPhotos, setOriginalPhotos] = useState<CampPhoto[]>([])
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (campId) {
      fetchCamp(campId).catch(error => {
        console.error('Failed to fetch camp:', error)
        router.push('/camps')
      })
    }

    // Cleanup on unmount
    return () => {
      setHasUnsavedChanges(false)
      setWizardFormValid(false)
      setWizardFormSubmit(null)
    }
  }, [campId, fetchCamp, router, setHasUnsavedChanges, setWizardFormValid, setWizardFormSubmit])

  useEffect(() => {
    if (currentCamp?.photos) {
      // Sort photos by order and set them
      const sortedPhotos = [...(currentCamp.photos as CampPhoto[])].sort(
        (a, b) => a.order - b.order
      )
      setFormData({ photos: sortedPhotos, pendingFiles: [] })
      setOriginalPhotos(sortedPhotos)
    }
  }, [currentCamp])

  // Detect form changes
  useEffect(() => {
    if (originalPhotos.length === 0 && formData.photos.length === 0) return

    const hasChanges =
      formData.pendingFiles.length > 0 ||
      formData.photos.length !== originalPhotos.length ||
      JSON.stringify(formData.photos.map(p => ({ id: p.id, order: p.order }))) !==
        JSON.stringify(originalPhotos.map(p => ({ id: p.id, order: p.order })))

    setHasUnsavedChanges(hasChanges)
  }, [formData, originalPhotos, setHasUnsavedChanges])

  // Update form validity
  useEffect(() => {
    const isValid = formData.photos.length >= 5

    setWizardFormValid(isValid)
  }, [formData.photos, setWizardFormValid])

  // Register submit handler for footer
  useEffect(() => {
    const handleFormSubmit = async () => {
      if (!campId) return

      try {
        // Separate existing photos (already uploaded) from new ones (temp IDs)
        const existingPhotos = formData.photos.filter(p => !p.id.startsWith('temp-'))

        // Upload new files along with existing photos metadata
        await uploadCampPhotos(campId, formData.pendingFiles, existingPhotos)

        // Clear pending files and update original photos
        setFormData({ ...formData, pendingFiles: [] })
        setOriginalPhotos(formData.photos)

        // Refresh camp data to get updated photos with SAS URLs
        await fetchCamp(campId)
      } catch (error) {
        console.error('Failed to save photos:', error)
        throw error
      }
    }

    setWizardFormSubmit(handleFormSubmit)

    return () => {
      setWizardFormSubmit(null)
    }
  }, [campId, formData, uploadCampPhotos, fetchCamp, setWizardFormSubmit])

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
      setFormData({
        photos: updatedPhotos,
        pendingFiles: [...formData.pendingFiles, ...fileArray],
      })
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
    setFormData({ ...formData, photos: reorderedPhotos })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Edit Camp Photos</h1>
        <p className="text-base leading-normal text-default-500">
          Parents want to see your facilities and activities. Upload at least 5 photos.
        </p>
      </div>

      {/* Form */}
      <PhotosForm
        formData={formData}
        onChange={data => setFormData({ ...formData, ...data })}
        onFileSelect={handleFileSelect}
        onRemovePhoto={handleRemovePhoto}
        isUploading={isUploading}
      />
    </div>
  )
}
