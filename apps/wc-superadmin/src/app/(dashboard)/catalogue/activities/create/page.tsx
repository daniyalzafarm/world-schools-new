'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { addToast } from '@heroui/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CatalogueActivityForm } from '@/components/catalogue/activity-form'
import {
  type AdminCategory,
  catalogueService,
  type CreateActivityPayload,
  type ScaleWithUsage,
} from '@/services/catalogue.services'
import { usePermissions } from '@/hooks/use-permissions'

function getApiErrorMessage(result: unknown, fallback: string) {
  const maybe: any = result
  return maybe?.data?.message ?? fallback
}

export default function CreateCatalogueActivityPage() {
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const searchParams = useSearchParams()
  const initialCategoryId = searchParams.get('categoryId')

  useEffect(() => {
    if (!hasPermission('catalogue.create')) {
      router.push('/catalogue')
    }
  }, [hasPermission, router])

  const [categories, setCategories] = useState<AdminCategory[] | null>(null)
  const [scales, setScales] = useState<ScaleWithUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const requestedRef = useRef(false)

  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true
    setLoading(true)
    void Promise.all([catalogueService.getCategories(), catalogueService.getScales()])
      .then(([cats, sc]) => {
        if (cats.success && cats.data) setCategories(Array.isArray(cats.data) ? cats.data : [])
        else setCategories([])
        if (sc.success && sc.data) setScales(Array.isArray(sc.data) ? sc.data : [])
        else setScales([])
      })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }, [])

  const safeCategories = useMemo(() => categories ?? [], [categories])

  const handleSubmit = async (categoryId: string, payload: CreateActivityPayload) => {
    setIsSaving(true)
    const res = await catalogueService.addActivity(categoryId, payload)
    setIsSaving(false)

    if (res.success) {
      addToast({ title: 'Activity created', color: 'success' })
      router.push('/catalogue')
      return true
    }

    addToast({ title: getApiErrorMessage(res, 'Failed to create activity'), color: 'danger' })
    return false
  }

  if (loading && !categories) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-sm text-default-500">Loading catalogue…</p>
        </div>
      </div>
    )
  }

  if (!loading && (!categories || safeCategories.length === 0)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">No Categories Found</h1>
          <p className="text-default-500">Create a category first, then add activities.</p>
        </div>
      </div>
    )
  }

  return (
    <CatalogueActivityForm
      mode="create"
      categories={safeCategories}
      scales={scales}
      initialCategoryId={initialCategoryId}
      isSaving={isSaving}
      onSubmit={handleSubmit}
    />
  )
}
