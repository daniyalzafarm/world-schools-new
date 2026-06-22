'use client'

import { useEffect, useState } from 'react'
import { addToast } from '@heroui/react'
import { useRouter } from 'next/navigation'
import { CatalogueScaleForm } from '@/components/catalogue/scale-form'
import { catalogueService, type CreateScalePayload } from '@/services/catalogue.services'
import { usePermissions } from '@/hooks/use-permissions'

function getApiErrorMessage(result: unknown, fallback: string) {
  const maybe: any = result
  return maybe?.data?.message ?? fallback
}

export default function CreateCatalogueScalePage() {
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!hasPermission('catalogue.create')) {
      router.push('/catalogue')
    }
  }, [hasPermission, router])

  const handleSubmit = async (payload: CreateScalePayload) => {
    setIsSaving(true)
    const res = await catalogueService.createScale(payload)
    setIsSaving(false)

    if (res.success) {
      addToast({ title: 'Scale created', color: 'success' })
      router.push('/catalogue')
      return true
    }

    addToast({ title: getApiErrorMessage(res, 'Failed to create scale'), color: 'danger' })
    return false
  }

  return <CatalogueScaleForm mode="create" isSaving={isSaving} onSubmit={handleSubmit} />
}
