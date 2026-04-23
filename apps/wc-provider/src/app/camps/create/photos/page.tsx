'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addToast } from '@heroui/react'
import { useCampsStore } from '../../../../stores/camps-store'
import * as campsService from '../../../../services/camps.services'
import type { CampPhoto } from '../../../../types/camps'
import { PhotosForm, type PhotosFormData } from '../../../../components/camp-forms/PhotosForm'

const sortByOrder = (photos: CampPhoto[]) => [...photos].sort((a, b) => a.order - b.order)

const applyOrderFlags = (photos: CampPhoto[]): CampPhoto[] =>
  photos.map((photo, index) => ({
    ...photo,
    order: index,
    isPrimary: index === 0,
  }))

export default function PhotosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campId = searchParams.get('id')

  const { fetchCamp, wizardCamp, setWizardCamp, setWizardStep } = useCampsStore()

  const [formData, setFormData] = useState<PhotosFormData>({ photos: [] })
  const [busyPhotoIds, setBusyPhotoIds] = useState<Set<string>>(new Set())

  // Latest server-confirmed photo list. Used to revert optimistic changes on failure.
  const committedPhotosRef = useRef<CampPhoto[]>([])
  const reorderTimeoutRef = useRef<number | null>(null)

  const addBusy = (ids: string[]) =>
    setBusyPhotoIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      return next
    })

  const removeBusy = (ids: string[]) =>
    setBusyPhotoIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.delete(id))
      return next
    })

  const setPendingAutoSave = (pending: boolean, status: 'saving' | 'saved' | 'error' | 'idle') => {
    useCampsStore.setState({ hasPendingAutoSave: pending, autoSaveStatus: status })
  }

  const flashSavedThenIdle = () => {
    setPendingAutoSave(false, 'saved')
    setTimeout(() => {
      if (useCampsStore.getState().autoSaveStatus === 'saved') {
        useCampsStore.setState({ autoSaveStatus: 'idle' })
      }
    }, 2000)
  }

  useEffect(() => {
    const init = async () => {
      setWizardStep(4)
      if (!campId) {
        router.push('/camps/create/basic-info')
        return
      }
      await fetchCamp(campId)
      if (useCampsStore.getState().error) {
        router.push('/camps/create/basic-info')
        return
      }
      const currentCamp = useCampsStore.getState().currentCamp
      if (currentCamp) setWizardCamp(currentCamp)
    }
    void init()
  }, [campId, fetchCamp, setWizardCamp, setWizardStep, router])

  useEffect(() => {
    if (wizardCamp?.photos) {
      const sorted = sortByOrder(wizardCamp.photos as CampPhoto[])
      setFormData({ photos: sorted })
      committedPhotosRef.current = sorted
    }
  }, [wizardCamp])

  // Keep store-level wizard state in sync: photos are persisted per-action, so
  // there are no "unsaved changes" and no wizardFormSubmit hook — the Next
  // button just needs the 5-photo minimum.
  useEffect(() => {
    useCampsStore.setState({
      wizardFormValid: formData.photos.length >= 5,
      wizardFormSubmit: null,
      hasUnsavedChanges: false,
    })
  }, [formData.photos.length])

  const handleFilesSelected = async (files: File[]) => {
    if (!campId || !files || files.length === 0) return

    const snapshot = formData.photos
    const stamp = Date.now()
    const temps: CampPhoto[] = files.map((file, index) => ({
      id: `temp-${stamp}-${index}`,
      url: URL.createObjectURL(file),
      thumbnail: URL.createObjectURL(file),
      isPrimary: snapshot.length === 0 && index === 0,
      order: snapshot.length + index,
    }))
    const tempIds = temps.map(t => t.id)

    setFormData({ photos: [...snapshot, ...temps] })
    addBusy(tempIds)
    setPendingAutoSave(true, 'saving')

    const res = await campsService.uploadCampPhotos(campId, files, snapshot)
    removeBusy(tempIds)

    if (!res.success) {
      setFormData({ photos: snapshot })
      setPendingAutoSave(false, 'error')
      addToast({
        title: 'Error',
        description: res.data.message || 'Failed to upload photos. Please try again.',
        color: 'danger',
      })
      return
    }

    const serverPhotos = sortByOrder((res.data.camp.photos as CampPhoto[]) ?? [])
    committedPhotosRef.current = serverPhotos
    setFormData({ photos: serverPhotos })
    useCampsStore.setState({ currentCamp: res.data.camp, wizardCamp: res.data.camp })
    flashSavedThenIdle()
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    void handleFilesSelected(Array.from(files))
  }

  const handleRemovePhoto = async (photoId: string) => {
    if (!campId) return
    const snapshot = formData.photos
    const remaining = applyOrderFlags(snapshot.filter(p => p.id !== photoId))

    setFormData({ photos: remaining })
    addBusy([photoId])
    setPendingAutoSave(true, 'saving')

    const res = await campsService.uploadCampPhotos(campId, [], remaining)
    removeBusy([photoId])

    if (!res.success) {
      setFormData({ photos: snapshot })
      setPendingAutoSave(false, 'error')
      addToast({
        title: 'Error',
        description: res.data.message || 'Failed to remove photo. Please try again.',
        color: 'danger',
      })
      return
    }

    const serverPhotos = sortByOrder((res.data.camp.photos as CampPhoto[]) ?? [])
    committedPhotosRef.current = serverPhotos
    setFormData({ photos: serverPhotos })
    useCampsStore.setState({ currentCamp: res.data.camp, wizardCamp: res.data.camp })
    flashSavedThenIdle()
  }

  const persistReorder = async (photos: CampPhoto[]) => {
    if (!campId) return
    const rollback = committedPhotosRef.current
    setPendingAutoSave(true, 'saving')

    const res = await campsService.uploadCampPhotos(campId, [], photos)
    if (!res.success) {
      setFormData({ photos: rollback })
      setPendingAutoSave(false, 'error')
      addToast({
        title: 'Error',
        description: res.data.message || 'Failed to reorder photos. Please try again.',
        color: 'danger',
      })
      return
    }

    const serverPhotos = sortByOrder((res.data.camp.photos as CampPhoto[]) ?? [])
    committedPhotosRef.current = serverPhotos
    setFormData({ photos: serverPhotos })
    useCampsStore.setState({ currentCamp: res.data.camp, wizardCamp: res.data.camp })
    flashSavedThenIdle()
  }

  const handleReorder = (photos: CampPhoto[]) => {
    setFormData({ photos })
    if (reorderTimeoutRef.current !== null) {
      window.clearTimeout(reorderTimeoutRef.current)
    }
    reorderTimeoutRef.current = window.setTimeout(() => {
      reorderTimeoutRef.current = null
      void persistReorder(photos)
    }, 500)
  }

  useEffect(() => {
    return () => {
      if (reorderTimeoutRef.current !== null) {
        window.clearTimeout(reorderTimeoutRef.current)
      }
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  const isUploading = busyPhotoIds.size > 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold leading-tight text-foreground">
          Add photos of your camp
        </h1>
        <p className="text-base text-default-500">
          Parents want to see your facilities and activities. Upload at least 5 photos.
        </p>
      </div>

      <PhotosForm
        formData={formData}
        onChange={data => {
          if (data.photos) handleReorder(data.photos)
        }}
        onFileSelect={handleFileSelect}
        onFilesSelected={files => void handleFilesSelected(files)}
        onRemovePhoto={id => void handleRemovePhoto(id)}
        isUploading={isUploading}
        busyPhotoIds={busyPhotoIds}
      />
    </div>
  )
}
