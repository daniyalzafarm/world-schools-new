'use client'

import { useState } from 'react'
import { addToast } from '@heroui/react'
import { useRouter } from 'next/navigation'
import { CatalogueScaleForm } from '@/components/catalogue/scale-form'
import { catalogueService, type CreateScalePayload } from '@/services/catalogue.services'

function getApiErrorMessage(result: unknown, fallback: string) {
  const maybe: any = result
  return maybe?.data?.message ?? fallback
}

export default function CreateCatalogueScalePage() {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

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
