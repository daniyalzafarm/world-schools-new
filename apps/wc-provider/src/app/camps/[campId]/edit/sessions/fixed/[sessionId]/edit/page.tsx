'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import {
  FixedSessionForm,
  type FixedSessionFormData,
} from '@/components/sessions/fixed/FixedSessionForm'
import { useSessionsData } from '@/hooks/useSessionsData'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import type { FixedSession } from '@/types/sessions'

/**
 * Edit Fixed Session Page
 * Standalone page for editing an existing fixed session
 */
export default function EditFixedSessionPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string
  const sessionId = params.sessionId as string

  const { fixedSessions, isLoading } = useSessionsData(campId)
  const { updateFixedSession, isUpdatingFixed } = useSessionMutations(campId)

  const [session, setSession] = useState<FixedSession | null>(null)

  // Find the session to edit
  useEffect(() => {
    if (!isLoading && fixedSessions) {
      const foundSession = fixedSessions.find(s => s.id === sessionId)
      if (foundSession) {
        setSession(foundSession)
      }
    }
  }, [isLoading, fixedSessions, sessionId])

  // Handle form submit
  const handleSubmit = async (data: FixedSessionFormData) => {
    await updateFixedSession(sessionId, data, {
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
    <div>
      <SessionBreadcrumb
        campId={campId}
        title={`Edit Session: ${session.name}`}
        subtitle="Update the fixed session details."
      />

      <FixedSessionForm
        session={session}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isUpdatingFixed}
      />
    </div>
  )
}
