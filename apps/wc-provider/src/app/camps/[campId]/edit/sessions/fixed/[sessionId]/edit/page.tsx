'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Spinner } from '@heroui/react'
import { SessionBreadcrumb } from '@/components/sessions/SessionBreadcrumb'
import {
  FixedSessionForm,
  type FixedSessionFormData,
} from '@/components/sessions/fixed/FixedSessionForm'
import { SessionFormFooter } from '@/components/sessions/SessionFormFooter'
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
  const submitRef = useRef<(() => void) | undefined>(undefined)

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

  // Handle footer submit
  const handleFooterSubmit = () => {
    if (submitRef.current) {
      submitRef.current()
    }
  }

  // Hide the main CampEditorFooter when this component mounts
  useEffect(() => {
    // Add a class to the body to indicate we're on a session form page
    document.body.classList.add('session-form-page')

    // Cleanup: remove the class when component unmounts
    return () => {
      document.body.classList.remove('session-form-page')
    }
  }, [])

  // Loading state
  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      {/* Add padding-bottom to prevent content from being hidden behind fixed footer */}
      <div className="pb-20">
        <SessionBreadcrumb
          title={`Edit Session: ${session.name}`}
          subtitle="Update the fixed session details."
        />

        <FixedSessionForm session={session} onSubmit={handleSubmit} onSubmitRef={submitRef} />
      </div>

      <SessionFormFooter
        campId={campId}
        onCancel={handleCancel}
        onSubmit={handleFooterSubmit}
        isSubmitting={isUpdatingFixed}
        mode="edit"
      />
    </>
  )
}
