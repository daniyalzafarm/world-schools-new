'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { addToast, Button, Tooltip } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { GripVertical, Trash2 } from 'lucide-react'
import type { CampPhoto } from '../../../../../types/camps'

export default function PhotosEditorPage() {
  const router = useRouter()
  const params = useParams()
  const campId = params.campId as string

  const {
    uploadCampPhotos,
    fetchCamp,
    currentCamp,
    isLoading,
    setHasUnsavedChanges,
    setWizardFormValid,
    setWizardFormSubmit,
  } = useCampsStore()

  const [photos, setPhotos] = useState<CampPhoto[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [originalPhotos, setOriginalPhotos] = useState<CampPhoto[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

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
      setPhotos(sortedPhotos)
      setOriginalPhotos(sortedPhotos)
    }
  }, [currentCamp])

  // Detect form changes
  useEffect(() => {
    if (originalPhotos.length === 0 && photos.length === 0) return

    const hasChanges =
      pendingFiles.length > 0 ||
      photos.length !== originalPhotos.length ||
      JSON.stringify(photos.map(p => ({ id: p.id, order: p.order }))) !==
        JSON.stringify(originalPhotos.map(p => ({ id: p.id, order: p.order })))

    setHasUnsavedChanges(hasChanges)
  }, [photos, originalPhotos, pendingFiles, setHasUnsavedChanges])

  // Update form validity
  useEffect(() => {
    const isValid = photos.length >= 5

    setWizardFormValid(isValid)
  }, [photos, setWizardFormValid])

  // Register submit handler for footer
  useEffect(() => {
    const handleFormSubmit = async () => {
      if (!campId) return

      try {
        // Separate existing photos (already uploaded) from new ones (temp IDs)
        const existingPhotos = photos.filter(p => !p.id.startsWith('temp-'))

        // Upload new files along with existing photos metadata
        await uploadCampPhotos(campId, pendingFiles, existingPhotos)

        // Clear pending files and update original photos
        setPendingFiles([])
        setOriginalPhotos(photos)

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
  }, [campId, photos, pendingFiles, uploadCampPhotos, fetchCamp, setWizardFormSubmit])

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
        isPrimary: photos.length === 0 && index === 0,
        order: photos.length + index,
      }))

      const updatedPhotos = [...photos, ...newPhotos]
      setPhotos(updatedPhotos)
      setPendingFiles(prev => [...prev, ...fileArray])
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
    const filteredPhotos = photos.filter(p => p.id !== photoId)
    // Reorder remaining photos
    const reorderedPhotos = filteredPhotos.map((photo, index) => ({
      ...photo,
      order: index,
      isPrimary: index === 0,
    }))
    setPhotos(reorderedPhotos)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const newPhotos = [...photos]
    const draggedPhoto = newPhotos[draggedIndex]

    // Remove from old position
    newPhotos.splice(draggedIndex, 1)
    // Insert at new position
    newPhotos.splice(dropIndex, 0, draggedPhoto)

    // Update order and isPrimary for all photos
    const reorderedPhotos = newPhotos.map((photo, index) => ({
      ...photo,
      order: index,
      isPrimary: index === 0,
    }))

    setPhotos(reorderedPhotos)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div>
      {/* Header - matching reference design */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold leading-tight text-foreground">Edit Camp Photos</h1>
        <p className="text-base text-default-500">
          Parents want to see your facilities and activities. Upload at least 5 photos.
        </p>
      </div>

      <div className="space-y-6">
        {/* Form Group */}
        <div className="mb-7">
          {/* Label with Tooltip */}
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-base font-semibold text-foreground after:ml-1 after:text-danger after:content-['*']">
              Camp Photos
            </label>
            <Tooltip content="High-quality photos increase inquiries by 3x" showArrow={true}>
              <span className="cursor-help text-sm text-default-400">ⓘ</span>
            </Tooltip>
          </div>

          {/* Photo Dropzone - only show when no photos */}
          {photos.length === 0 && (
            <>
              <div
                onClick={() => document.getElementById('photoInput')?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-default-200 bg-default-100 px-6 py-12 text-center transition-all hover:border-primary hover:bg-primary/5"
              >
                <div className="mb-3 text-5xl">📸</div>
                <div className="mb-1.5 text-base font-semibold text-foreground">
                  Drag photos here or click to browse
                </div>
                <div className="text-xs text-default-500">
                  JPG, PNG or WebP • Max 5MB each • Minimum 5 photos
                </div>
              </div>

              {/* Photo Tips - only show when no photos */}
              <div className="mt-4 text-sm leading-relaxed text-default-500">
                <strong className="text-foreground">Photo tips:</strong>
                <br />• Show kids actively participating in activities
                <br />• Include wide shots of facilities and grounds
                <br />• Capture staff interacting with campers
                <br />• Camps with 5+ photos get 3x more inquiries
              </div>
            </>
          )}

          <input
            type="file"
            id="photoInput"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
        </div>

        {/* Photo Gallery with Drag and Drop */}
        {photos.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between">
              <p className="text-xs text-default-500">
                You can drag to arrange the order of the images.
              </p>
              {/* Photo Count */}
              <div className="ml-auto text-xs text-default-500">
                {photos.length} photo{photos.length !== 1 ? 's' : ''} selected
                {photos.length < 5 && (
                  <span className="ml-1 text-danger"> (minimum 5 required)</span>
                )}
              </div>
            </div>

            {/* Gallery Layout - 4 column grid with 2x2 primary photo */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {/* Primary Photo (First Photo) - 2x2 grid space */}
              {photos[0] && (
                <div
                  draggable
                  onDragStart={() => handleDragStart(0)}
                  onDragOver={e => handleDragOver(e, 0)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, 0)}
                  onDragEnd={handleDragEnd}
                  className={`group relative col-span-2 row-span-2 cursor-move overflow-hidden rounded-lg border-2 transition-all ${
                    dragOverIndex === 0 && draggedIndex !== 0
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent'
                  } ${draggedIndex === 0 ? 'opacity-50' : ''}`}
                  style={{ aspectRatio: '4/3' }}
                >
                  <img
                    src={photos[0].url}
                    alt="Primary camp photo"
                    className="h-full w-full object-cover"
                  />

                  {/* Primary Badge */}
                  <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-foreground">
                    Primary
                  </div>

                  {/* Drag Handle */}
                  <div className="absolute right-2 top-2 rounded-md bg-black/50 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <GripVertical className="h-4 w-4 text-white" />
                  </div>

                  {/* Remove Button */}
                  <Button
                    size="sm"
                    color="danger"
                    isIconOnly
                    onPress={() => handleRemovePhoto(photos[0].id)}
                    className="absolute bottom-2 right-2 h-7 w-7 min-w-0 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* First 4 Thumbnails (positions 2-5) - 1x1 grid items */}
              {photos.slice(1, 5).map((photo, index) => {
                const actualIndex = index + 1
                return (
                  <div
                    key={photo.id}
                    draggable
                    onDragStart={() => handleDragStart(actualIndex)}
                    onDragOver={e => handleDragOver(e, actualIndex)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, actualIndex)}
                    onDragEnd={handleDragEnd}
                    className={`group relative cursor-move overflow-hidden rounded-lg border-2 transition-all ${
                      dragOverIndex === actualIndex && draggedIndex !== actualIndex
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent'
                    } ${draggedIndex === actualIndex ? 'opacity-50' : ''}`}
                    style={{ aspectRatio: '4/3' }}
                  >
                    <img
                      src={photo.url}
                      alt={`Camp photo ${actualIndex + 1}`}
                      className="h-full w-full object-cover"
                    />

                    {/* Position Number */}
                    <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/50 text-[10px] font-semibold text-background">
                      {actualIndex + 1}
                    </div>

                    {/* Drag Handle */}
                    <div className="absolute right-2 top-2 rounded-md bg-black/50 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <GripVertical className="h-4 w-4 text-white" />
                    </div>

                    {/* Remove Button */}
                    <Button
                      size="sm"
                      color="danger"
                      isIconOnly
                      onPress={() => handleRemovePhoto(photo.id)}
                      className="absolute bottom-2 right-2 h-7 w-7 min-w-0 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}

              {/* Empty slots when less than 5 photos */}
              {photos.length < 5 &&
                Array.from({ length: 5 - photos.length }).map((_, index) => (
                  <div
                    key={`empty-top-${index}`}
                    onClick={() => document.getElementById('photoInput')?.click()}
                    className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-default-200 bg-default-100 transition-all hover:border-primary hover:bg-primary/5"
                    style={{ aspectRatio: '4/3' }}
                  >
                    <div className="text-center">
                      <div className="mb-1 text-3xl opacity-30">📸</div>
                      <div className="text-[10px] text-default-500">Add photo</div>
                    </div>
                  </div>
                ))}

              {/* Persistent Add Photo button when exactly 5 photos */}
              {photos.length === 5 && (
                <div
                  onClick={() => document.getElementById('photoInput')?.click()}
                  className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-default-200 bg-default-100 transition-all hover:border-primary hover:bg-primary/5"
                  style={{ aspectRatio: '4/3' }}
                >
                  <div className="text-center">
                    <div className="mb-1 text-3xl opacity-30">📸</div>
                    <div className="text-[10px] text-default-500">Add photo</div>
                  </div>
                </div>
              )}
            </div>

            {/* Additional Photos Row (6+) */}
            {photos.length > 5 && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {photos.slice(5).map((photo, index) => {
                  const actualIndex = index + 5
                  return (
                    <div
                      key={photo.id}
                      draggable
                      onDragStart={() => handleDragStart(actualIndex)}
                      onDragOver={e => handleDragOver(e, actualIndex)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, actualIndex)}
                      onDragEnd={handleDragEnd}
                      className={`group relative cursor-move overflow-hidden rounded-lg border-2 transition-all ${
                        dragOverIndex === actualIndex && draggedIndex !== actualIndex
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent'
                      } ${draggedIndex === actualIndex ? 'opacity-50' : ''}`}
                      style={{ aspectRatio: '4/3' }}
                    >
                      <img
                        src={photo.url}
                        alt={`Camp photo ${actualIndex + 1}`}
                        className="h-full w-full object-cover"
                      />

                      {/* Position Number */}
                      <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/50 text-[10px] font-semibold text-background">
                        {actualIndex + 1}
                      </div>

                      {/* Drag Handle */}
                      <div className="absolute right-2 top-2 rounded-md bg-black/50 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <GripVertical className="h-4 w-4 text-white" />
                      </div>

                      {/* Remove Button */}
                      <Button
                        size="sm"
                        color="danger"
                        isIconOnly
                        onPress={() => handleRemovePhoto(photo.id)}
                        className="absolute bottom-2 right-2 h-7 w-7 min-w-0 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}

                {/* Always show Add Photo button */}
                <div
                  onClick={() => document.getElementById('photoInput')?.click()}
                  className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-default-200 bg-default-100 transition-all hover:border-primary hover:bg-primary/5"
                  style={{ aspectRatio: '4/3' }}
                >
                  <div className="text-center">
                    <div className="mb-1 text-3xl opacity-30">📸</div>
                    <div className="text-[10px] text-default-500">Add photo</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
