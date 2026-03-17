'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { addToast } from '@heroui/react'
import { useParams, useRouter } from 'next/navigation'
import { CatalogueActivityForm } from '@/components/catalogue/activity-form'
import {
  type AdminActivity,
  type AdminCategory,
  catalogueService,
  type ScaleWithUsage,
  type UpdateActivityPayload,
} from '@/services/catalogue.services'

function getApiErrorMessage(result: unknown, fallback: string) {
  const maybe: any = result
  return maybe?.data?.message ?? fallback
}

export default function EditCatalogueActivityPage() {
  const router = useRouter()
  const params = useParams()
  const activityId = params.id as string

  const [categories, setCategories] = useState<AdminCategory[] | null>(null)
  const [scales, setScales] = useState<ScaleWithUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const requestedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!activityId) return
    if (requestedRef.current === activityId) return
    requestedRef.current = activityId

    setLoading(true)
    void Promise.all([catalogueService.getCategories(), catalogueService.getScales()])
      .then(([cats, sc]) => {
        if (cats.success && cats.data) setCategories(Array.isArray(cats.data) ? cats.data : [])
        else setCategories([])
        if (sc.success && sc.data) setScales(Array.isArray(sc.data) ? sc.data : [])
        else setScales([])
      })
      .catch(() => {
        requestedRef.current = null
        setCategories([])
      })
      .finally(() => setLoading(false))
  }, [activityId])

  const resolved = useMemo(() => {
    const cats = categories ?? []
    for (const c of cats) {
      const a = (c.activities ?? []).find(act => act.id === activityId)
      if (a) {
        return { activity: a as AdminActivity, categoryId: c.id }
      }
    }
    return { activity: null as AdminActivity | null, categoryId: '' }
  }, [activityId, categories])

  const handleSubmit = async (id: string, payload: UpdateActivityPayload) => {
    if (!id) return false
    setIsSaving(true)
    const res = await catalogueService.updateActivity(id, payload)
    setIsSaving(false)

    if (res.success) {
      addToast({ title: 'Activity updated', color: 'success' })
      router.push('/catalogue')
      return true
    }

    addToast({ title: getApiErrorMessage(res, 'Failed to update activity'), color: 'danger' })
    return false
  }

  const handleDelete = async () => {
    if (!activityId) return false
    setIsDeleting(true)
    const res = await catalogueService.deleteActivity(activityId)
    setIsDeleting(false)

    if (res.success) {
      addToast({ title: 'Activity deleted', color: 'success' })
      router.push('/catalogue')
      return true
    }

    addToast({ title: getApiErrorMessage(res, 'Delete failed'), color: 'danger' })
    return false
  }

  if (loading && !categories) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-sm text-default-500">Loading activity…</p>
        </div>
      </div>
    )
  }

  if (!loading && (!categories || categories.length === 0)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Activity Not Found</h1>
          <p className="text-default-500">
            The activity you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    )
  }

  if (!resolved.activity) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Activity Not Found</h1>
          <p className="text-default-500">
            The activity you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    )
  }

  return (
    <CatalogueActivityForm
      mode="edit"
      categories={categories ?? []}
      scales={scales}
      activity={resolved.activity}
      categoryId={resolved.categoryId}
      isSaving={isSaving}
      isDeleting={isDeleting}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
    />
  )
}
