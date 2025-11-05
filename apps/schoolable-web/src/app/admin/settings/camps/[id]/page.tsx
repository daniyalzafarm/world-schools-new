'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { CampForm } from '@/components/forms/camp-form'

export default function CampDetailsPage() {
  const params = useParams()
  const campId = params.id as string

  return <CampForm campId={campId} />
}
