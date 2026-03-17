'use client'

import { useState } from 'react'
import { addToast } from '@heroui/react'
import { useRouter } from 'next/navigation'
import { CatalogueCategoryForm } from '@/components/catalogue/category-form'
import { catalogueService, type CreateCategoryPayload } from '@/services/catalogue.services'

function getApiErrorMessage(result: unknown, fallback: string) {
  const maybe: any = result
  return maybe?.data?.message ?? fallback
}

export default function CreateCatalogueCategoryPage() {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (payload: CreateCategoryPayload) => {
    setIsSaving(true)
    const res = await catalogueService.createCategory(payload)
    setIsSaving(false)

    if (res.success) {
      addToast({ title: 'Category created', color: 'success' })
      router.push('/catalogue')
      return true
    }

    addToast({ title: getApiErrorMessage(res, 'Failed to create category'), color: 'danger' })
    return false
  }

  return <CatalogueCategoryForm mode="create" isSaving={isSaving} onSubmit={handleSubmit} />
}
