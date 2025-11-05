'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { SchoolForm } from '@/components/forms/school-form'

export default function SchoolDetailsPage() {
  const params = useParams()
  const schoolId = params.id as string

  return <SchoolForm schoolId={schoolId} />
}
