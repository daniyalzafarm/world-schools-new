'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { addToast } from '@heroui/react'
import { useParams, useRouter } from 'next/navigation'
import { CatalogueScaleForm } from '@/components/catalogue/scale-form'
import {
  catalogueService,
  type CreateScalePayload,
  type ScaleWithUsage,
  type UpdateScalePayload,
} from '@/services/catalogue.services'
import { usePermissions } from '@/hooks/use-permissions'

function getApiErrorMessage(result: unknown, fallback: string) {
  const maybe: any = result
  return maybe?.data?.message ?? fallback
}

export default function EditCatalogueScalePage() {
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const params = useParams()
  const scaleId = params.id as string

  useEffect(() => {
    if (!hasPermission('catalogue.update')) {
      router.push('/catalogue')
    }
  }, [hasPermission, router])

  const [scales, setScales] = useState<ScaleWithUsage[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const requestedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!scaleId) return
    if (requestedRef.current === scaleId) return
    requestedRef.current = scaleId

    setLoading(true)
    void catalogueService
      .getScales()
      .then(res => {
        if (res.success && res.data) {
          setScales(Array.isArray(res.data) ? res.data : [])
        } else {
          setScales([])
        }
      })
      .catch(() => {
        requestedRef.current = null
        setScales([])
      })
      .finally(() => setLoading(false))
  }, [scaleId])

  const scale = useMemo(() => (scales ?? []).find(s => s.id === scaleId) ?? null, [scales, scaleId])

  const handleSubmit = async (payload: UpdateScalePayload | CreateScalePayload) => {
    if (!scaleId) return false

    setIsSaving(true)
    const res = await catalogueService.updateScale(scaleId, payload as UpdateScalePayload)
    setIsSaving(false)

    if (res.success) {
      addToast({ title: 'Scale updated', color: 'success' })
      router.push('/catalogue')
      return true
    }

    addToast({ title: getApiErrorMessage(res, 'Failed to update scale'), color: 'danger' })
    return false
  }

  const handleDelete = async () => {
    if (!scaleId) return false

    setIsDeleting(true)
    const res = await catalogueService.deleteScale(scaleId)
    setIsDeleting(false)

    if (res.success) {
      addToast({ title: 'Scale deleted', color: 'success' })
      router.push('/catalogue')
      return true
    }

    addToast({ title: getApiErrorMessage(res, 'Failed to delete scale'), color: 'danger' })
    return false
  }

  if (loading && !scales) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-sm text-default-500">Loading scale...</p>
        </div>
      </div>
    )
  }

  if (!loading && (!scales || scales.length === 0)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Scale Not Found</h1>
          <p className="text-default-500">The scale you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  if (!scale) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Scale Not Found</h1>
          <p className="text-default-500">The scale you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  return (
    <CatalogueScaleForm
      mode="edit"
      scale={scale}
      isSaving={isSaving}
      isDeleting={isDeleting}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
    />
  )
}
