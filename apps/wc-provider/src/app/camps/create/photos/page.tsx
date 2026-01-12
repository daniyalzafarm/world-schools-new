'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addToast, Button } from '@heroui/react'
import { useCampsStore } from '../../../../stores/camps-store'
import { GripVertical, Trash2 } from 'lucide-react'
import type { CampPhoto } from '../../../../types/camps'

export default function PhotosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campId = searchParams.get('id')

  const { uploadCampPhotos, fetchCamp, wizardCamp, setWizardStep, isLoading } = useCampsStore()

  const [photos, setPhotos] = useState<CampPhoto[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [localHasUnsavedChanges, setLocalHasUnsavedChanges] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    setWizardStep(4)

    if (campId) {
      fetchCamp(campId).catch(error => {
        console.error('Failed to fetch camp:', error)
        router.push('/camps/create/basic-info')
      })
    } else {
      router.push('/camps/create/basic-info')
    }
  }, [campId, fetchCamp, setWizardStep, router])

  useEffect(() => {
    if (wizardCamp?.photos) {
      // Sort photos by order and set them
      const sortedPhotos = [...(wizardCamp.photos as CampPhoto[])].sort((a, b) => a.order - b.order)
      setPhotos(sortedPhotos)
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
        isPrimary: photos.length === 0 && index === 0,
        order: photos.length + index,
      }))

      const updatedPhotos = [...photos, ...newPhotos]
      setPhotos(updatedPhotos)
      setPendingFiles(prev => [...prev, ...fileArray])
      setLocalHasUnsavedChanges(true)
      setSaveSuccess(false)
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
    setLocalHasUnsavedChanges(true)
    setSaveSuccess(false)
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
    setLocalHasUnsavedChanges(true)
    setSaveSuccess(false)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleSave = async () => {
    if (!campId) return

    // Update store loading state
    useCampsStore.setState({ isLoading: true })
    setSaveSuccess(false)
    try {
      // Separate existing photos (already uploaded) from new ones (temp IDs)
      const existingPhotos = photos.filter(p => !p.id.startsWith('temp-'))

      // Upload new files along with existing photos metadata
      await uploadCampPhotos(campId, pendingFiles, existingPhotos)

      // Clear pending files and mark as saved
      setPendingFiles([])
      setLocalHasUnsavedChanges(false)
      setSaveSuccess(true)

      // Refresh camp data to get updated photos with SAS URLs
      await fetchCamp(campId)

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
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

  const handleSubmit = async () => {
    // Save photos if there are unsaved changes
    if (localHasUnsavedChanges) {
      await handleSave()
    }
  }

  // Expose form validation and submit handler to parent layout
  useEffect(() => {
    // Require minimum 5 photos
    const isFormValid = photos.length >= 5

    useCampsStore.setState({
      wizardFormValid: isFormValid,
      wizardFormSubmit: handleSubmit,
      hasUnsavedChanges: localHasUnsavedChanges,
    })
  }, [photos, campId, localHasUnsavedChanges])

  return (
    <div>
      {/* Header - matching reference design */}
      <div className="mb-8">
        <h1 className="text-[32px] font-bold leading-tight text-[#222222]">
          Add photos of your camp
        </h1>
        <p className="text-[16px] text-[#717171]">
          Parents want to see your facilities and activities. Upload at least 5 photos.
        </p>
      </div>

      <div className="space-y-6">
        {/* Form Group */}
        <div className="mb-7">
          {/* Label with Tooltip */}
          <div className="mb-2.5 flex items-center gap-2">
            <label className="text-[15px] font-semibold text-[#222222] after:ml-1 after:text-[#FF385C] after:content-['*']">
              Camp Photos
            </label>
            <span
              className="relative inline-flex h-[18px] w-[18px] cursor-help items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F7F7F7] text-[12px] font-semibold text-[#717171] transition-all hover:border-[#222222] hover:bg-[#222222] hover:text-white"
              title="High-quality photos increase inquiries by 3x"
            >
              ⓘ
            </span>
          </div>

          {/* Photo Dropzone - only show when no photos */}
          {photos.length === 0 && (
            <>
              <div
                onClick={() => document.getElementById('photoInput')?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-[#E5E5E5] bg-[#F7F7F7] px-6 py-12 text-center transition-all hover:border-[#45F0B5] hover:bg-[#E8FDF7]"
              >
                <div className="mb-3 text-5xl">📸</div>
                <div className="mb-1.5 text-[16px] font-semibold text-[#222222]">
                  Drag photos here or click to browse
                </div>
                <div className="text-[13px] text-[#717171]">
                  JPG, PNG or WebP • Max 5MB each • Minimum 5 photos
                </div>
              </div>

              {/* Photo Tips - only show when no photos */}
              <div className="mt-4 text-[14px] leading-relaxed text-[#717171]">
                <strong className="text-[#222222]">Photo tips:</strong>
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
              <p className="text-[13px] text-[#717171]">
                You can drag to arrange the order of the images.
              </p>
              {/* Photo Count */}
              <div className="ml-auto text-[13px] text-[#717171]">
                {photos.length} photo{photos.length !== 1 ? 's' : ''} selected
                {photos.length < 5 && (
                  <span className="ml-1 text-[#FF385C]"> (minimum 5 required)</span>
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
                      ? 'border-[#45F0B5] bg-[#E8FDF7]'
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
                  <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[#45F0B5] px-2 py-1 text-[10px] font-semibold text-[#222222]">
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
                        ? 'border-[#45F0B5] bg-[#E8FDF7]'
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
                    <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] font-semibold text-white">
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
                    className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[#E5E5E5] bg-[#F7F7F7] transition-all hover:border-[#45F0B5] hover:bg-[#E8FDF7]"
                    style={{ aspectRatio: '4/3' }}
                  >
                    <div className="text-center">
                      <div className="mb-1 text-3xl opacity-30">📸</div>
                      <div className="text-[10px] text-[#717171]">Add photo</div>
                    </div>
                  </div>
                ))}

              {/* Persistent Add Photo button when exactly 5 photos */}
              {photos.length === 5 && (
                <div
                  onClick={() => document.getElementById('photoInput')?.click()}
                  className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[#E5E5E5] bg-[#F7F7F7] transition-all hover:border-[#45F0B5] hover:bg-[#E8FDF7]"
                  style={{ aspectRatio: '4/3' }}
                >
                  <div className="text-center">
                    <div className="mb-1 text-3xl opacity-30">📸</div>
                    <div className="text-[10px] text-[#717171]">Add photo</div>
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
                          ? 'border-[#45F0B5] bg-[#E8FDF7]'
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
                      <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] font-semibold text-white">
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
                  className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[#E5E5E5] bg-[#F7F7F7] transition-all hover:border-[#45F0B5] hover:bg-[#E8FDF7]"
                  style={{ aspectRatio: '4/3' }}
                >
                  <div className="text-center">
                    <div className="mb-1 text-3xl opacity-30">📸</div>
                    <div className="text-[10px] text-[#717171]">Add photo</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Indicators - Show when there are photos */}
        {photos.length > 0 && (
          <div className="mt-8 flex items-center gap-4">
            {/* Success Message */}
            {saveSuccess && (
              <div className="flex items-center gap-2 text-[14px] font-medium text-green-600">
                <span className="text-xl">✓</span>
                Photos saved successfully!
              </div>
            )}

            {/* Unsaved Changes Indicator */}
            {localHasUnsavedChanges && !isLoading && (
              <div className="text-[13px] text-[#717171]">You have unsaved changes</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
