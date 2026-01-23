'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { ChildForm } from '@/components/forms/child-form'

export default function ChildDetailsPage() {
  const params = useParams()
  const childId = params.id as string

  return <ChildForm childId={childId} />
}
