'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { addToast } from '@heroui/react'
import { useParams, useRouter } from 'next/navigation'
import { CatalogueCategoryForm } from '@/components/catalogue/category-form'
import {
  type AdminCategory,
  catalogueService,
  type UpdateCategoryPayload,
} from '@/services/catalogue.services'

function getApiErrorMessage(result: unknown, fallback: string) {
  const maybe: any = result
  return maybe?.data?.message ?? fallback
}

export default function EditCatalogueCategoryPage() {
  const router = useRouter()
  const params = useParams()
  const categoryId = params.id as string

  const [categories, setCategories] = useState<AdminCategory[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const requestedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!categoryId) return
    if (requestedRef.current === categoryId) return
    requestedRef.current = categoryId

    setLoading(true)
    void catalogueService
      .getCategories()
      .then(res => {
        if (res.success && res.data) {
          setCategories(Array.isArray(res.data) ? res.data : [])
        } else {
          setCategories([])
        }
      })
      .catch(() => {
        requestedRef.current = null
        setCategories([])
      })
      .finally(() => setLoading(false))
  }, [categoryId])

  const category = useMemo(
    () => (categories ?? []).find(c => c.id === categoryId) ?? null,
    [categories, categoryId]
  )

  const handleSubmit = async (payload: UpdateCategoryPayload) => {
    if (!categoryId) return false

    setIsSaving(true)
    const res = await catalogueService.updateCategory(categoryId, payload)
    setIsSaving(false)

    if (res.success) {
      addToast({ title: 'Category updated', color: 'success' })
      router.push('/catalogue')
      return true
    }

    addToast({ title: getApiErrorMessage(res, 'Failed to update category'), color: 'danger' })
    return false
  }

  const handleDelete = async () => {
    if (!categoryId) return false

    setIsDeleting(true)
    const res = await catalogueService.deleteCategory(categoryId)
    setIsDeleting(false)

    if (res.success) {
      addToast({ title: 'Category deleted', color: 'success' })
      router.push('/catalogue')
      return true
    }

    addToast({
      title: getApiErrorMessage(res, 'Delete failed (may be in use)'),
      color: 'danger',
    })
    return false
  }

  if (loading && !categories) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-sm text-default-500">Loading category...</p>
        </div>
      </div>
    )
  }

  if (!loading && (!categories || categories.length === 0)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Category Not Found</h1>
          <p className="text-default-500">
            The category you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Category Not Found</h1>
          <p className="text-default-500">
            The category you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    )
  }

  return (
    <CatalogueCategoryForm
      mode="edit"
      category={category}
      isSaving={isSaving}
      isDeleting={isDeleting}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
    />
  )
}
