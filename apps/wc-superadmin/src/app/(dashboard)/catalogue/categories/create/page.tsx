'use client'

import { useEffect, useState } from 'react'
import { addToast } from '@heroui/react'
import { useRouter } from 'next/navigation'
import { CatalogueCategoryForm } from '@/components/catalogue/category-form'
import { catalogueService, type CreateCategoryPayload } from '@/services/catalogue.services'
import { usePermissions } from '@/hooks/use-permissions'

function getApiErrorMessage(result: unknown, fallback: string) {
  const maybe: any = result
  return maybe?.data?.message ?? fallback
}

export default function CreateCatalogueCategoryPage() {
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!hasPermission('catalogue.create')) {
      router.push('/catalogue')
    }
  }, [hasPermission, router])

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
