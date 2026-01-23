'use client'

import React, { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { ChildForm } from '@/components/forms/child-form'
import { useChildrenStore } from '@/stores/children-store'

export default function ChildDetailsPage() {
  const params = useParams()
  const childId = params.id as string
  const { children, isLoading, fetchChildren, getChildById } = useChildrenStore()

  // Fetch children data if store is empty (e.g., after page reload)
  useEffect(() => {
    if (children.length === 0 && !isLoading && childId !== 'new') {
      fetchChildren().catch(error => {
        console.error('Failed to fetch children:', error)
      })
    }
  }, [children.length, isLoading, childId, fetchChildren])

  // Show loading spinner while fetching data for existing child
  if (childId !== 'new' && children.length === 0 && isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" label="Loading child data..." />
      </div>
    )
  }

  // Show loading spinner if we're editing but child not found yet and still loading
  if (childId !== 'new' && !getChildById(childId) && isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" label="Loading child data..." />
      </div>
    )
  }

  return <ChildForm childId={childId} />
}
