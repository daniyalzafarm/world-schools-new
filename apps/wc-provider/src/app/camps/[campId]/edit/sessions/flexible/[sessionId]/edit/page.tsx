'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import {
  FlexibleSessionForm,
  type FlexibleSessionFormData,
} from '@/components/sessions/flexible/FlexibleSessionForm'
import { useSessionsData } from '@/hooks/useSessionsData'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import type { FlexibleSession } from '@/types/sessions'

/**
 * Edit Flexible Session Page
 * Standalone page for editing an existing flexible session
 */
export default function EditFlexibleSessionPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string
  const sessionId = params.sessionId as string

  const { flexibleSessions, isLoading } = useSessionsData(campId)
  const { updateFlexibleSession, isUpdatingFlexible } = useSessionMutations(campId)

  const [session, setSession] = useState<FlexibleSession | null>(null)

  // Find the session to edit
  useEffect(() => {
    if (!isLoading && flexibleSessions) {
      const foundSession = flexibleSessions.find(s => s.id === sessionId)
      if (foundSession) {
        setSession(foundSession)
      }
    }
  }, [isLoading, flexibleSessions, sessionId])

  // Handle form submit
  const handleSubmit = async (data: FlexibleSessionFormData) => {
    await updateFlexibleSession(sessionId, data, {
      onSuccess: () => {
        router.push(`/camps/${campId}/edit/sessions`)
      },
    })
  }

  // Handle cancel
  const handleCancel = () => {
    router.push(`/camps/${campId}/edit/sessions`)
  }

  // Loading state
  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <SessionBreadcrumb
        campId={campId}
        title={`Edit Session: ${session.name}`}
        subtitle="Update the flexible session details."
      />

      <FlexibleSessionForm
        session={session}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isUpdatingFlexible}
      />
    </div>
  )
}
