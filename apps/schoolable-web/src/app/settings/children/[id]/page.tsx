'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { ChildForm } from '@/components/forms/child-form'
import { ProtectedRoute } from '@/components/auth/protected-route'

export default function ChildDetailsPage() {
  const params = useParams()
  const childId = params.id as string

  return (
    <ProtectedRoute requireAuth={true} requireUser={true}>
      <ChildForm childId={childId} />
    </ProtectedRoute>
  )
}
