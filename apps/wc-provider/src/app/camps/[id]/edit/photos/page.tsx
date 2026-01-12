'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Card, CardBody } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { Star, Upload, X } from 'lucide-react'
import type { CampPhoto } from '../../../../../types/camps'

export default function PhotosEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const {
    currentCamp,
    updateCampPhotos,
    setHasUnsavedChanges,
    isLoading: _isLoading,
  } = useCampsStore()

  const [photos, setPhotos] = useState<CampPhoto[]>([])
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (currentCamp?.photos) {
      // Sort photos by order
      const sortedPhotos = [...(currentCamp.photos as CampPhoto[])].sort(
        (a, b) => a.order - b.order
      )
      setPhotos(sortedPhotos)
    }
  }, [currentCamp])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      // TODO: Implement actual file upload to storage service
      const newPhotos: CampPhoto[] = Array.from(files).map((file, index) => ({
        id: `photo-${Date.now()}-${index}`,
        url: URL.createObjectURL(file),
        thumbnail: URL.createObjectURL(file),
        isPrimary: photos.length === 0 && index === 0,
        order: photos.length + index,
      }))

      const updatedPhotos = [...photos, ...newPhotos]
      setPhotos(updatedPhotos)
      setHasUnsavedChanges(true)
    } catch (error) {
      console.error('Failed to upload photos:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemovePhoto = (photoId: string) => {
    const filteredPhotos = photos.filter(p => p.id !== photoId)
    // Reorder remaining photos
    const reorderedPhotos = filteredPhotos.map((photo, index) => ({
      ...photo,
      order: index,
      isPrimary: index === 0,
    }))
    setPhotos(reorderedPhotos)
    setHasUnsavedChanges(true)
  }

  const handleSetPrimary = (photoId: string) => {
    // Find the photo to make primary
    const photoIndex = photos.findIndex(p => p.id === photoId)
    if (photoIndex === -1) return

    // Reorder: move selected photo to first position
    const newPhotos = [...photos]
    const [selectedPhoto] = newPhotos.splice(photoIndex, 1)
    newPhotos.unshift(selectedPhoto)

    // Update order and isPrimary for all photos
    const reorderedPhotos = newPhotos.map((photo, index) => ({
      ...photo,
      order: index,
      isPrimary: index === 0,
    }))

    setPhotos(reorderedPhotos)
    setHasUnsavedChanges(true)
  }

  const handleSave = async () => {
    if (!campId) return

    try {
      await updateCampPhotos(campId, photos)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save photos:', error)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Camp Photos</h1>
        <p className="text-sm text-gray-600">
          Manage your camp photos. Set one as the primary image.
        </p>
      </div>

      <div className="space-y-6">
        {/* Upload Zone */}
        <Card>
          <CardBody>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 transition-colors hover:border-primary-400 hover:bg-primary-50">
              <Upload className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-1 text-sm font-medium text-gray-700">Click to upload photos</p>
              <p className="text-xs text-gray-500">PNG, JPG up to 10MB each</p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          </CardBody>
        </Card>

        {/* Photo Grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {photos.map(photo => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-lg"
              >
                <img src={photo.url} alt="Camp photo" className="h-full w-full object-cover" />

                {/* Primary Badge */}
                {photo.isPrimary && (
                  <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary-600 px-2 py-1 text-xs font-medium text-white">
                    <Star className="h-3 w-3 fill-current" />
                    Primary
                  </div>
                )}

                {/* Actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {!photo.isPrimary && (
                    <Button size="sm" color="primary" onPress={() => handleSetPrimary(photo.id)}>
                      Set Primary
                    </Button>
                  )}
                  <Button
                    size="sm"
                    color="danger"
                    isIconOnly
                    onPress={() => handleRemovePhoto(photo.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {photos.length === 0 && (
          <div className="rounded-lg bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-600">No photos uploaded yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
